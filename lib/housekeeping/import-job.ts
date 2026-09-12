import { createHash, randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import type { HousekeepingImportJob } from "../jobs/queue";
import { createNotification } from "../notifications/service";
import { parseAsaXml } from "./xml-parser";
import { readAsaFile } from "./asa-file";

async function assertActor(client: PoolClient, data: HousekeepingImportJob) {
  const result = await client.query(`SELECT h.asa_xml_name FROM hotel_tenants h JOIN users u ON u.hotel_tenant_id=h.id
    WHERE h.id=$1 AND u.id=$2 AND h.is_active AND u.is_active AND NOT u.is_deleted
    AND h.subscription_status IN ('ACTIVE','COMPED')
    -- Housekeeping is enabled by default for all current staff roles; explicit can_view overrides it.
    -- Match accessibleModules(): admins always have access, no extra action/scope permission.
    AND (u.role='ADMIN' OR COALESCE((SELECT p.can_view FROM role_module_permissions p WHERE p.hotel_tenant_id=h.id
      AND p.role=u.role AND p.module_key='housekeeping'),true))
    FOR SHARE OF h,u`, [data.hotelTenantId, data.actorId]);
  if (result.rows[0]?.asa_xml_name?.trim() !== data.xmlName) throw new Error("Import settings or authorization changed");
}

async function log(client: PoolClient, data: HousekeepingImportJob, status: string, counts: object = {}) {
  await client.query(`INSERT INTO audit_logs (id,hotel_tenant_id,actor_id,action,entity_type,entity_id,changes,description)
    VALUES ($1,$2,$3,'STATUS_CHANGE','HOUSEKEEPING_IMPORT',$4,$5::jsonb,$6::jsonb)`,
  [randomUUID(), data.hotelTenantId, data.actorId, data.runId, JSON.stringify({ status, ...counts }),
    JSON.stringify({ en: `Housekeeping XML import: ${status}`, de: `Housekeeping-XML-Import: ${status}`, it: `Importazione XML Housekeeping: ${status}` })]);
}

export async function importHousekeeping(pool: Pool, data: HousekeepingImportJob, signal?: AbortSignal, readFile = readAsaFile) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SET LOCAL statement_timeout = '60s'");
    const run = await client.query("SELECT status FROM import_runs WHERE id=$1 AND hotel_tenant_id=$2 FOR UPDATE", [data.runId, data.hotelTenantId]);
    if (!run.rows[0]) throw new Error("Import run not found");
    if (run.rows[0].status === "SUCCEEDED") { await client.query("COMMIT"); return { alreadyCompleted: true }; }
    await assertActor(client, data);
    await client.query("UPDATE import_runs SET status='RUNNING',error_summary=NULL,updated_at=NOW() WHERE id=$1 AND hotel_tenant_id=$2", [data.runId, data.hotelTenantId]);
    await log(client, data, "RUNNING");
    await client.query("COMMIT");

    const xml = await readFile(data.xmlName);
    signal?.throwIfAborted();
    const parsed = parseAsaXml(xml);
    const checksum = createHash("sha256").update(xml).digest("hex");
    await client.query("BEGIN");
    await client.query("SET LOCAL statement_timeout = '60s'");
    // Serializes imports per hotel even if multiple worker processes are running.
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [data.hotelTenantId]);
    await assertActor(client, data);
    const currentRun = await client.query("SELECT status FROM import_runs WHERE id=$1 AND hotel_tenant_id=$2 FOR UPDATE", [data.runId, data.hotelTenantId]);
    if (currentRun.rows[0]?.status === "SUCCEEDED") { await client.query("COMMIT"); return { alreadyCompleted: true }; }
    if (currentRun.rows[0]?.status === "FAILED") throw new Error("Import already failed");
    const existing = await client.query("SELECT external_id FROM reservations WHERE hotel_tenant_id=$1 AND source_id=$2", [data.hotelTenantId, data.sourceId]);
    const oldKeys = new Set(existing.rows.map(row => row.external_id));
    let created = 0, updated = 0, guests = 0;
    // Snapshot membership, not deletion: absent records retain their history.
    await client.query(`UPDATE reservations r SET source_present=false,updated_at=NOW() FROM hotel_import_sources s
      WHERE r.source_id=s.id AND r.hotel_tenant_id=$1 AND s.hotel_tenant_id=$1 AND s.provider='ASA_XML' AND r.source_present`, [data.hotelTenantId]);
    for (const row of parsed.records) {
      signal?.throwIfAborted();
      const category = await client.query(`INSERT INTO room_categories (id,hotel_tenant_id,name_en,name_de,name_it,updated_at)
        VALUES ($1,$2,$3,$3,$3,NOW()) ON CONFLICT (hotel_tenant_id,name_en) DO UPDATE SET name_en=EXCLUDED.name_en RETURNING id`,
      [randomUUID(), data.hotelTenantId, row.category]);
      const room = await client.query(`INSERT INTO rooms (id,hotel_tenant_id,number,name_en,name_de,name_it,category_id,updated_at)
        VALUES ($1,$2,$3,$4,$4,$4,$5,NOW()) ON CONFLICT (hotel_tenant_id,number) DO UPDATE SET number=EXCLUDED.number RETURNING id`,
      [randomUUID(), data.hotelTenantId, row.room, `RN_${row.room}`, category.rows[0].id]);
      const roomId = room.rows[0].id;
      await client.query(`INSERT INTO room_operational_states (id,hotel_tenant_id,room_id,updated_at)
        VALUES ($1,$2,$3,NOW()) ON CONFLICT (hotel_tenant_id,room_id) DO NOTHING`, [randomUUID(), data.hotelTenantId, roomId]);
      const reservation = await client.query(`INSERT INTO reservations
        (id,hotel_tenant_id,source_id,external_id,source_status,status,booking_group,offer,board,last_seen_at,source_present,updated_at)
        VALUES ($1,$2,$3,$4,$5,$6::"ReservationStatus",$7,$8,$9,NOW(),true,NOW())
        ON CONFLICT (hotel_tenant_id,source_id,external_id) DO UPDATE SET source_status=EXCLUDED.source_status,status=EXCLUDED.status,
        booking_group=EXCLUDED.booking_group,offer=EXCLUDED.offer,board=EXCLUDED.board,last_seen_at=NOW(),source_present=true,updated_at=NOW() RETURNING id`,
      [randomUUID(), data.hotelTenantId, data.sourceId, row.key, row.sourceStatus, row.status, row.bookingGroup, row.offer, row.board]);
      const stay = await client.query(`INSERT INTO reservation_room_stays
        (id,hotel_tenant_id,reservation_id,room_id,source_segment_id,arrival_date,departure_date,source_status,adult_count,child_count,
         child_k1_count,child_k2_count,child_k3_count,service_remarks,source_from_room_number,source_to_room_number,updated_at)
        VALUES ($1,$2,$3,$4,$5,$6::date,$7::date,$8,$9,$10,$11,$12,$13,$14,$15,$16,NOW())
        ON CONFLICT (hotel_tenant_id,reservation_id,source_segment_id) DO UPDATE SET source_status=EXCLUDED.source_status,
        adult_count=EXCLUDED.adult_count,child_count=EXCLUDED.child_count,child_k1_count=EXCLUDED.child_k1_count,
        child_k2_count=EXCLUDED.child_k2_count,child_k3_count=EXCLUDED.child_k3_count,service_remarks=EXCLUDED.service_remarks,
        source_from_room_number=EXCLUDED.source_from_room_number,source_to_room_number=EXCLUDED.source_to_room_number,updated_at=NOW() RETURNING id`,
      [randomUUID(), data.hotelTenantId, reservation.rows[0].id, roomId, row.key, row.arrival, row.departure, row.sourceStatus,
        row.adults, row.children, row.k1, row.k2, row.k3, row.remarks, row.from, row.to]);
      const stayId = stay.rows[0].id;
      for (const guest of row.guests) {
        await client.query(`INSERT INTO reservation_guests
          (id,hotel_tenant_id,room_stay_id,source_guest_id,name,date_of_birth,language,vip,previous_stay_count,updated_at)
          VALUES ($1,$2,$3,$4,$5,$6::date,$7,$8,$9,NOW()) ON CONFLICT (hotel_tenant_id,room_stay_id,source_guest_id)
          DO UPDATE SET name=EXCLUDED.name,date_of_birth=EXCLUDED.date_of_birth,language=EXCLUDED.language,vip=EXCLUDED.vip,
          previous_stay_count=EXCLUDED.previous_stay_count,updated_at=NOW()`,
        [randomUUID(), data.hotelTenantId, stayId, guest.key, guest.name, guest.dob, guest.language, guest.vip, guest.previousStays]);
        guests++;
      }
      // Guests are the imported current list for this stay; leave manual guest records untouched.
      await client.query("DELETE FROM reservation_guests WHERE hotel_tenant_id=$1 AND room_stay_id=$2 AND source_guest_id IS NOT NULL AND NOT (source_guest_id=ANY($3::text[]))",
        [data.hotelTenantId, stayId, row.guests.map(guest => guest.key)]);
      if (oldKeys.has(row.key)) updated++; else created++;
    }
    const counts = { created, updated, guests, read: parsed.read, skipped: parsed.skipped };
    await client.query(`UPDATE import_runs SET status='SUCCEEDED',finished_at=NOW(),checksum=$3,records_read=$4,records_created=$5,
      records_updated=$6,records_rejected=$7,error_summary=NULL,updated_at=NOW() WHERE id=$1 AND hotel_tenant_id=$2`,
    [data.runId, data.hotelTenantId, checksum, parsed.read, created, updated, parsed.skipped]);
    await client.query("UPDATE hotel_import_sources SET last_successful_at=NOW(),updated_at=NOW() WHERE id=$1 AND hotel_tenant_id=$2", [data.sourceId, data.hotelTenantId]);
    await log(client, data, "SUCCEEDED", counts);
    await createNotification(client, { hotelTenantId: data.hotelTenantId, recipientId: data.actorId, eventKey: `housekeeping-import:${data.runId}`,
      moduleKey: "housekeeping", icon: "housekeeping", destination: "/housekeeping", text: {
        en: { title: "Housekeeping import completed", body: `${created} reservations inserted, ${updated} updated; ${guests} guests imported. ${parsed.skipped} unsupported records skipped.` },
        de: { title: "Housekeeping-Import abgeschlossen", body: `${created} Reservierungen eingefügt, ${updated} aktualisiert; ${guests} Gäste importiert. ${parsed.skipped} nicht unterstützte Einträge übersprungen.` },
        it: { title: "Importazione Housekeeping completata", body: `${created} prenotazioni inserite, ${updated} aggiornate; ${guests} ospiti importati. ${parsed.skipped} record non supportati ignorati.` },
      } });
    signal?.throwIfAborted();
    await client.query("COMMIT");
    return counts;
  } catch (error) { await client.query("ROLLBACK"); throw error; }
  finally { client.release(); }
}

export function importFailureReason(error: unknown) {
  const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
  const messages: Record<string, string> = {
    "42P01": "A required database table is missing. Apply the prepared migrations.",
    "42703": "A required database column is missing. Apply the prepared migrations.",
    "23503": "A related hotel, user, or import record is missing.",
    "23505": "A duplicate database record conflicts with this import.",
    "22001": "An imported value exceeds the database field length.",
    "57014": "The import exceeded the database query timeout.",
    "ECONNREFUSED": "The worker cannot connect to PostgreSQL.",
    "ENOENT": "The configured XML file was not found in the worker container.",
  };
  if (messages[code]) return `${messages[code]} (${code})`;
  // Only expose messages authored by our parser/importer, never raw SQL or guest parameters.
  const message = error instanceof Error ? error.message : "";
  if (/^(Invalid XML (date|count|field length)|Malformed XML|Unexpected XML root|Too many XML reservations|Ambiguous duplicate reservation in XML|XML departure precedes arrival|XML contains no supported reservations|XML document types and custom entities are not supported|ASA XML file unavailable|ASA XML exceeds 20 MB|Import settings or authorization changed|Import run not found|Import already failed)$/.test(message)) return message;
  return code && /^[A-Z0-9_]{2,30}$/.test(code) ? `Import failed with error code ${code}.` : "Import failed. Check the XML data and worker configuration.";
}

export async function recordImportFailure(pool: Pool, data: HousekeepingImportJob, final: boolean, reason?: string) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query(`UPDATE import_runs SET status=$3::"ImportRunStatus",error_summary=$4,
      finished_at=CASE WHEN $5 THEN NOW() ELSE NULL END,updated_at=NOW()
      WHERE id=$1 AND hotel_tenant_id=$2 AND status NOT IN ('SUCCEEDED','FAILED') RETURNING id`,
    [data.runId, data.hotelTenantId, final ? "FAILED" : "QUEUED", `${reason ?? "Import failed. Check the worker logs and configuration."}${final ? "" : " Retry pending."}`, final]);
    if (result.rowCount) {
      await log(client, data, final ? "FAILED" : "RETRY_PENDING", { reason: reason ?? "Worker failure or timeout" });
      if (final) await createNotification(client, { hotelTenantId: data.hotelTenantId, recipientId: data.actorId, eventKey: `housekeeping-import:${data.runId}`,
        moduleKey: "housekeeping", icon: "housekeeping", destination: "/housekeeping", text: {
          en: { title: "Housekeeping import failed", body: "No import changes were saved. Check the XML file and hotel settings, then refresh again." },
          de: { title: "Housekeeping-Import fehlgeschlagen", body: "Keine Importänderungen gespeichert. XML-Datei und Hoteleinstellungen prüfen und erneut aktualisieren." },
          it: { title: "Importazione Housekeeping non riuscita", body: "Nessuna modifica importata salvata. Controlla il file XML e le impostazioni hotel, poi riprova." },
        } });
    }
    await client.query("COMMIT");
  } catch (error) { await client.query("ROLLBACK"); throw error; }
  finally { client.release(); }
}
