import "dotenv/config";
import { resolveAsaName } from "../lib/housekeeping/asa-file";
import { dispatchHousekeepingImport } from "../lib/housekeeping/dispatch";
import { importFailureReason } from "../lib/housekeeping/import-job";
import { jobDatabase } from "../lib/jobs/database";
import { getJobQueue } from "../lib/jobs/queue";

async function main() {
  const pool = jobDatabase();
  let boss: Awaited<ReturnType<typeof getJobQueue>> | undefined;
  try {
    const requestedHotel = process.argv[2];
    if (process.argv.length > 3 || (requestedHotel && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(requestedHotel))) {
      throw new Error("Usage: npm run housekeeping:import -- [hotel-uuid]");
    }
    const { rows: hotels } = await pool.query<{ id: string; asa_xml_name: string | null }>(
      `SELECT id,asa_xml_name FROM hotel_tenants
       WHERE is_active AND subscription_status IN ('ACTIVE','COMPED')
         AND ($1::uuid IS NULL OR id=$1::uuid) ORDER BY id`, [requestedHotel ?? null]);
    const summary = { hotels: hotels.length, queued: 0, pending: 0, skipped: 0, failed: 0 };
    for (const hotel of hotels) {
      const name = resolveAsaName(hotel.asa_xml_name);
      if (!name.ok) {
        const missing = name.error === "ASA_XML_NAME_REQUIRED";
        if (missing) summary.skipped++; else summary.failed++;
        console.log(JSON.stringify({ hotelTenantId: hotel.id, status: missing ? "skipped" : "failed", reason: name.error }));
        continue;
      }
      try {
        boss ??= await getJobQueue();
        const runId = await dispatchHousekeepingImport(hotel.id, null, hotel.asa_xml_name!.trim());
        if (runId) summary.queued++; else summary.pending++;
        console.log(JSON.stringify({ hotelTenantId: hotel.id, status: runId ? "queued" : "already_pending", runId }));
      } catch (error) {
        summary.failed++;
        console.error(JSON.stringify({ hotelTenantId: hotel.id, status: "failed", reason: importFailureReason(error) }));
      }
    }
    console.log(JSON.stringify(summary));
    if (summary.failed || (requestedHotel && !hotels.length)) process.exitCode = 1;
  } finally {
    try { await boss?.stop(); } finally { await pool.end(); }
  }
}

main().catch((error) => {
  console.error(error instanceof Error && error.message.startsWith("Usage:") ? error.message : importFailureReason(error));
  process.exitCode = 1;
});
