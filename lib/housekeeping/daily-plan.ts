import { randomUUID } from "node:crypto"; // Node helper to create a unique UUID for new rows
import type { PrismaClient } from "../../app/generated/prisma/client"; // Type of the Prisma client passed in from the script

/**
 * Stay selection and upserts stay as SQL: Postgres DISTINCT ON, FOR UPDATE, and
 * ON CONFLICT ... WHERE / CASE cannot be expressed with Prisma findMany/upsert.
 * They run through Prisma $queryRaw/$executeRaw in one transaction — same pattern
 * as the housekeeping API routes — not a separate pg Pool.
 */

// Shape of one stay row returned by the DISTINCT ON query below
type StayRow = { stay_id: string; room_id: string; arrival_date: string; departure_date: string; normal_minutes: number | null; express_minutes: number | null; departure_minutes: number | null; cleaning_frequency: string | null; cleaning_weekdays: number[] | null; linen_frequency: string | null; linen_weekdays: number[] | null; assigned_to_id: string | null };

// Convert "now" into YYYY-MM-DD in a hotel time zone (e.g. Europe/Rome), not the server clock
export function hotelLocalDate(timeZone: string, now = new Date()) {
  // Ask Intl for year/month/day parts in that time zone (en-CA = YYYY-MM-DD order)
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  // Turn [{type:'year',value:'2026'}, ...] into { year: '2026', month: '09', day: '16' }
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`; // e.g. "2026-09-16"
}

// How many calendar days between two YYYY-MM-DD dates (0 = same day)
function dayDifference(from: string, to: string) {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000);
}

// ISO weekday: Monday=1 ... Sunday=7 (JS getUTCDay is Sunday=0)
function isoWeekday(date: string) {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  return day === 0 ? 7 : day;
}

// Decide cleaning type + minutes for one stay on one work date
export function cleaningPlan(stay: Pick<StayRow, "arrival_date" | "departure_date" | "normal_minutes" | "express_minutes" | "departure_minutes" | "cleaning_frequency" | "cleaning_weekdays">, date: string) {
  // Checkout day → departure clean (longer). Fall back to normal minutes if departure minutes are missing.
  if (date === stay.departure_date) return { type: "DEPARTURE", minutes: stay.departure_minutes ?? stay.normal_minutes ?? 0 } as const;
  const elapsed = dayDifference(stay.arrival_date, date); // nights since arrival (0 on arrival day)
  // Regular (full) clean when the category schedule says so; otherwise express (short) clean
  const regular = stay.cleaning_frequency === "DAILY" // every day
    || stay.cleaning_frequency === "EVERY_SECOND_DAY" && elapsed % 2 === 0 // arrival, then every other day
    || stay.cleaning_frequency === "WEEKLY" && elapsed % 7 === 0 // arrival, then weekly
    || stay.cleaning_frequency === "ON_REQUEST" && (stay.cleaning_weekdays ?? []).includes(isoWeekday(date)); // only listed weekdays
  return regular
    ? { type: "REGULAR", minutes: stay.normal_minutes ?? 0 } as const
    : { type: "EXPRESS", minutes: stay.express_minutes ?? 0 } as const;
}

export function linenDueToday(stay: Pick<StayRow, "arrival_date" | "linen_frequency" | "linen_weekdays">, date: string) {
  const elapsed = dayDifference(stay.arrival_date, date);
  return stay.linen_frequency === "DAILY"
    || stay.linen_frequency === "EVERY_SECOND_DAY" && elapsed % 2 === 0
    || stay.linen_frequency === "WEEKLY" && elapsed % 7 === 0
    || stay.linen_frequency === "ON_REQUEST" && (stay.linen_weekdays ?? []).includes(isoWeekday(date));
}

// Build/refresh one hotel's housekeeping plan for one local calendar day (idempotent)
export async function generateHotelDailyPlan(prisma: PrismaClient, hotelTenantId: string, workDate: string) {
  const runId = randomUUID(); // id for the housekeeping_daily_runs row we are about to write
  try {
    // All reads/writes below succeed together or roll back together. 120s max for a large hotel.
    return await prisma.$transaction(async (tx) => {
      // Lock this hotel+date run row so two cron starts cannot generate the same day at once
      await tx.$queryRaw<{ status: string }[]>`
        SELECT status FROM housekeeping_daily_runs
        WHERE hotel_tenant_id=${hotelTenantId}::uuid AND work_date=${workDate}::date
        FOR UPDATE`;
      // Create a RUNNING row, or reuse today's row if the command is retried
      await tx.$executeRaw`
        INSERT INTO housekeeping_daily_runs (id,hotel_tenant_id,work_date,status,started_at)
        VALUES (${runId}::uuid,${hotelTenantId}::uuid,${workDate}::date,'RUNNING',NOW())
        ON CONFLICT (hotel_tenant_id,work_date) DO UPDATE
        SET status='RUNNING', started_at=NOW(), finished_at=NULL, error_summary=NULL`;

      // Room/arrival checks belong to this work_date. Clear today's ticks so the new plan starts unchecked.
      // Older days stay in the table as history.
      await tx.$executeRaw`
        DELETE FROM housekeeping_checklist_completions
        WHERE hotel_tenant_id=${hotelTenantId}::uuid AND work_date=${workDate}::date`;

      // Occupied rooms today: one stay per room (latest arrival if two overlap).
      // Joins reservation (skip cancelled/no-show), room, category minutes/frequency, permanent cleaner.
      const stays = await tx.$queryRaw<StayRow[]>`
        SELECT DISTINCT ON (s.room_id)
          s.id AS stay_id, s.room_id, s.arrival_date::text, s.departure_date::text,
          c.normal_minutes, c.express_minutes, c.departure_minutes, c.cleaning_frequency, c.cleaning_weekdays,
          c.linen_frequency, c.linen_weekdays,
          p.assigned_to_id
        FROM reservation_room_stays s
        JOIN reservations v ON v.id=s.reservation_id AND v.hotel_tenant_id=s.hotel_tenant_id
        JOIN rooms r ON r.id=s.room_id AND r.hotel_tenant_id=s.hotel_tenant_id
        LEFT JOIN room_categories c ON c.id=r.category_id AND c.hotel_tenant_id=r.hotel_tenant_id
        LEFT JOIN housekeeping_permanent_room_assignments p ON p.room_id=r.id AND p.hotel_tenant_id=r.hotel_tenant_id
        WHERE s.hotel_tenant_id=${hotelTenantId}::uuid
          AND ${workDate}::date BETWEEN s.arrival_date AND s.departure_date
          AND v.source_present=true
          AND v.status NOT IN ('CANCELLED','NO_SHOW')
          AND r.is_active=true AND r.archived_at IS NULL
        ORDER BY s.room_id, s.arrival_date DESC`;

      for (const stay of stays) {
        const plan = cleaningPlan(stay, workDate); // REGULAR / EXPRESS / DEPARTURE + planned minutes
        const linenChange = linenDueToday(stay, workDate);
        // Insert today's room assignment, or update stay/type/minutes if it already exists.
        // If origin is PERMANENT, also refresh the cleaner; if TODAY_ONLY, keep the person already assigned.
        await tx.$executeRaw`
          INSERT INTO housekeeping_room_assignments
            (id,hotel_tenant_id,work_date,room_id,assigned_to_id,reservation_stay_id,cleaning_type,assignment_origin,planned_minutes,updated_at)
          VALUES (
            ${randomUUID()}::uuid, ${hotelTenantId}::uuid, ${workDate}::date, ${stay.room_id}::uuid,
            ${stay.assigned_to_id}::uuid, ${stay.stay_id}::uuid,
            ${plan.type}::"HousekeepingCleaningType",
            ${stay.assigned_to_id ? "PERMANENT" : "TODAY_ONLY"}::"HousekeepingAssignmentOrigin",
            ${plan.minutes}, NOW()
          )
          ON CONFLICT (hotel_tenant_id,work_date,room_id) DO UPDATE SET
            reservation_stay_id=EXCLUDED.reservation_stay_id,
            cleaning_type=EXCLUDED.cleaning_type,
            planned_minutes=EXCLUDED.planned_minutes,
            assigned_to_id=CASE
              WHEN housekeeping_room_assignments.assignment_origin='PERMANENT' THEN EXCLUDED.assigned_to_id
              ELSE housekeeping_room_assignments.assigned_to_id
            END,
            updated_at=NOW()`;

        // Every daily run: occupied rooms become DIRTY. Express = dirty + ⚡ (is_express), regular = dirty only.
        await tx.$executeRaw`
          INSERT INTO room_operational_states (id,hotel_tenant_id,room_id,cleanliness,is_express,linen_change,updated_at)
          VALUES (${randomUUID()}::uuid,${hotelTenantId}::uuid,${stay.room_id}::uuid,'DIRTY',${plan.type === "EXPRESS"},${linenChange},NOW())
          ON CONFLICT (hotel_tenant_id,room_id) DO UPDATE
          SET cleanliness='DIRTY', is_express=EXCLUDED.is_express, linen_change=EXCLUDED.linen_change, updated_at=NOW()`;
      }

      // Permanent extra jobs (not rooms): default assignee + minutes + a description snapshot
      const extras = await tx.$queryRaw<{ extra_job_id: string; assigned_to_id: string; minutes: number; description: string }[]>`
        SELECT p.extra_job_id, p.assigned_to_id, e.minutes,
          COALESCE(NULLIF(e.description_en,''), NULLIF(e.description_de,''), e.description_it, '') AS description
        FROM housekeeping_permanent_extra_job_assignments p
        JOIN extra_jobs e ON e.id=p.extra_job_id AND e.hotel_tenant_id=p.hotel_tenant_id
        WHERE p.hotel_tenant_id=${hotelTenantId}::uuid`;

      for (const extra of extras) {
        // Copy each permanent extra onto today's plan; update minutes/description if the row already exists
        await tx.$executeRaw`
          INSERT INTO housekeeping_extra_job_assignments
            (id,hotel_tenant_id,work_date,extra_job_id,assigned_to_id,planned_minutes,assignment_origin,description_snapshot,updated_at)
          VALUES (
            ${randomUUID()}::uuid, ${hotelTenantId}::uuid, ${workDate}::date,
            ${extra.extra_job_id}::uuid, ${extra.assigned_to_id}::uuid, ${extra.minutes},
            'PERMANENT', ${extra.description}, NOW()
          )
          ON CONFLICT (hotel_tenant_id,work_date,extra_job_id,assigned_to_id) DO UPDATE SET
            planned_minutes=EXCLUDED.planned_minutes,
            description_snapshot=EXCLUDED.description_snapshot,
            updated_at=NOW()`;
      }

      // Mark this hotel+date run finished and store how many rooms/extras were generated
      await tx.$executeRaw`
        UPDATE housekeeping_daily_runs
        SET status='SUCCEEDED', rooms_generated=${stays.length}, extras_generated=${extras.length}, finished_at=NOW()
        WHERE hotel_tenant_id=${hotelTenantId}::uuid AND work_date=${workDate}::date`;

      return { rooms: stays.length, extras: extras.length }; // logged as JSON by the CLI script
    }, { timeout: 120_000 });
  } catch (error) {
    await recordFailure(prisma, hotelTenantId, workDate, error); // write FAILED outside the rolled-back transaction
    throw error; // let the script print the error and exit non-zero
  }
}

// Persist a FAILED daily-run row after the transaction rolled back (so cron/logs can see it)
async function recordFailure(prisma: PrismaClient, hotelTenantId: string, workDate: string, error: unknown) {
  const message = error instanceof Error ? error.message.slice(0, 2000) : "Daily plan generation failed"; // cap length for the column
  await prisma.$executeRaw`
    INSERT INTO housekeeping_daily_runs (id,hotel_tenant_id,work_date,status,error_summary,finished_at)
    VALUES (${randomUUID()}::uuid,${hotelTenantId}::uuid,${workDate}::date,'FAILED',${message},NOW())
    ON CONFLICT (hotel_tenant_id,work_date) DO UPDATE
    SET status='FAILED', error_summary=EXCLUDED.error_summary, finished_at=NOW()`;
}
