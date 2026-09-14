import { randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";

type StayRow = { stay_id: string; room_id: string; arrival_date: string; departure_date: string; normal_minutes: number | null; express_minutes: number | null; departure_minutes: number | null; cleaning_frequency: string | null; cleaning_weekdays: number[] | null; assigned_to_id: string | null };
export function hotelLocalDate(timeZone: string, now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}
function dayDifference(from: string, to: string) { return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000); }
function isoWeekday(date: string) { const day = new Date(`${date}T00:00:00Z`).getUTCDay(); return day === 0 ? 7 : day; }
export function cleaningPlan(stay: Pick<StayRow, "arrival_date" | "departure_date" | "normal_minutes" | "express_minutes" | "departure_minutes" | "cleaning_frequency" | "cleaning_weekdays">, date: string) {
  if (date === stay.departure_date) return { type: "DEPARTURE", minutes: stay.departure_minutes ?? stay.normal_minutes ?? 0 } as const;
  const elapsed = dayDifference(stay.arrival_date, date);
  const regular = stay.cleaning_frequency === "DAILY" || stay.cleaning_frequency === "EVERY_SECOND_DAY" && elapsed % 2 === 0 || stay.cleaning_frequency === "WEEKLY" && elapsed % 7 === 0 || stay.cleaning_frequency === "ON_REQUEST" && (stay.cleaning_weekdays ?? []).includes(isoWeekday(date));
  return regular ? { type: "REGULAR", minutes: stay.normal_minutes ?? 0 } as const : { type: "EXPRESS", minutes: stay.express_minutes ?? 0 } as const;
}

export async function generateHotelDailyPlan(pool: Pool, hotelTenantId: string, workDate: string) {
  const client = await pool.connect();
  const runId = randomUUID();
  try {
    // Checklist completions are isolated by work_date. The new daily plan therefore
    // starts with no completed checks while prior days remain available as history.
    await client.query("BEGIN");
    const previousRun = await client.query<{ status: string }>("SELECT status FROM housekeeping_daily_runs WHERE hotel_tenant_id=$1 AND work_date=$2::date FOR UPDATE", [hotelTenantId, workDate]);
    // A completed daily run is safe to repeat. Do not make already-clean rooms
    // dirty again when the cron command is retried during the same day.
    const resetRoomStates = previousRun.rows[0]?.status !== "SUCCEEDED";
    await client.query(`INSERT INTO housekeeping_daily_runs (id,hotel_tenant_id,work_date,status,started_at)
      VALUES ($1,$2,$3::date,'RUNNING',NOW()) ON CONFLICT (hotel_tenant_id,work_date) DO UPDATE SET status='RUNNING',started_at=NOW(),finished_at=NULL,error_summary=NULL`, [runId, hotelTenantId, workDate]);
    const stays = await client.query<StayRow>(`SELECT DISTINCT ON (s.room_id) s.id AS stay_id,s.room_id,s.arrival_date::text,s.departure_date::text,
      c.normal_minutes,c.express_minutes,c.departure_minutes,c.cleaning_frequency,c.cleaning_weekdays,p.assigned_to_id
      FROM reservation_room_stays s JOIN reservations v ON v.id=s.reservation_id AND v.hotel_tenant_id=s.hotel_tenant_id
      JOIN rooms r ON r.id=s.room_id AND r.hotel_tenant_id=s.hotel_tenant_id LEFT JOIN room_categories c ON c.id=r.category_id AND c.hotel_tenant_id=r.hotel_tenant_id
      LEFT JOIN housekeeping_permanent_room_assignments p ON p.room_id=r.id AND p.hotel_tenant_id=r.hotel_tenant_id
      WHERE s.hotel_tenant_id=$1 AND $2::date BETWEEN s.arrival_date AND s.departure_date AND v.source_present=true
      AND v.status NOT IN ('CANCELLED','NO_SHOW') AND r.is_active=true AND r.archived_at IS NULL ORDER BY s.room_id,s.arrival_date DESC`, [hotelTenantId, workDate]);
    for (const stay of stays.rows) {
      const plan = cleaningPlan(stay, workDate);
      await client.query(`INSERT INTO housekeeping_room_assignments
        (id,hotel_tenant_id,work_date,room_id,assigned_to_id,reservation_stay_id,cleaning_type,assignment_origin,planned_minutes,updated_at)
        VALUES ($1,$2,$3::date,$4,$5,$6,$7::"HousekeepingCleaningType",$8::"HousekeepingAssignmentOrigin",$9,NOW())
        ON CONFLICT (hotel_tenant_id,work_date,room_id) DO UPDATE SET reservation_stay_id=EXCLUDED.reservation_stay_id,cleaning_type=EXCLUDED.cleaning_type,
        planned_minutes=EXCLUDED.planned_minutes,assigned_to_id=CASE WHEN housekeeping_room_assignments.assignment_origin='PERMANENT' THEN EXCLUDED.assigned_to_id ELSE housekeeping_room_assignments.assigned_to_id END,
        updated_at=NOW()`, [randomUUID(), hotelTenantId, workDate, stay.room_id, stay.assigned_to_id, stay.stay_id, plan.type, stay.assigned_to_id ? "PERMANENT" : "TODAY_ONLY", plan.minutes]);
      if (resetRoomStates) await client.query(`INSERT INTO room_operational_states
        (id,hotel_tenant_id,room_id,cleanliness,is_express,updated_at)
        VALUES ($1,$2,$3,'DIRTY',$4,NOW())
        ON CONFLICT (hotel_tenant_id,room_id) DO UPDATE SET cleanliness='DIRTY',is_express=EXCLUDED.is_express,updated_at=NOW()`,
      [randomUUID(), hotelTenantId, stay.room_id, plan.type === "EXPRESS"]);
    }
    const extras = await client.query<{ extra_job_id: string; assigned_to_id: string; minutes: number; description: string }>(`SELECT p.extra_job_id,p.assigned_to_id,e.minutes,COALESCE(NULLIF(e.description_en,''),NULLIF(e.description_de,''),e.description_it,'') AS description
      FROM housekeeping_permanent_extra_job_assignments p JOIN extra_jobs e ON e.id=p.extra_job_id AND e.hotel_tenant_id=p.hotel_tenant_id WHERE p.hotel_tenant_id=$1`, [hotelTenantId]);
    for (const extra of extras.rows) await client.query(`INSERT INTO housekeeping_extra_job_assignments
      (id,hotel_tenant_id,work_date,extra_job_id,assigned_to_id,planned_minutes,assignment_origin,description_snapshot,updated_at)
      VALUES ($1,$2,$3::date,$4,$5,$6,'PERMANENT',$7,NOW()) ON CONFLICT (hotel_tenant_id,work_date,extra_job_id,assigned_to_id)
      DO UPDATE SET planned_minutes=EXCLUDED.planned_minutes,description_snapshot=EXCLUDED.description_snapshot,updated_at=NOW()`, [randomUUID(), hotelTenantId, workDate, extra.extra_job_id, extra.assigned_to_id, extra.minutes, extra.description]);
    await client.query(`UPDATE housekeeping_daily_runs SET status='SUCCEEDED',rooms_generated=$3,extras_generated=$4,finished_at=NOW()
      WHERE hotel_tenant_id=$1 AND work_date=$2::date`, [hotelTenantId, workDate, stays.rowCount ?? 0, extras.rowCount ?? 0]);
    await client.query("COMMIT");
    return { rooms: stays.rowCount ?? 0, extras: extras.rowCount ?? 0 };
  } catch (error) {
    await client.query("ROLLBACK");
    await recordFailure(client, hotelTenantId, workDate, error);
    throw error;
  } finally { client.release(); }
}
async function recordFailure(client: PoolClient, hotelTenantId: string, workDate: string, error: unknown) {
  const message = error instanceof Error ? error.message.slice(0, 2000) : "Daily plan generation failed";
  await client.query(`INSERT INTO housekeeping_daily_runs (id,hotel_tenant_id,work_date,status,error_summary,finished_at)
    VALUES ($1,$2,$3::date,'FAILED',$4,NOW()) ON CONFLICT (hotel_tenant_id,work_date) DO UPDATE SET status='FAILED',error_summary=EXCLUDED.error_summary,finished_at=NOW()`, [randomUUID(), hotelTenantId, workDate, message]);
}
