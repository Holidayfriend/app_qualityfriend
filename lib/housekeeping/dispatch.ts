import { createHash, randomUUID } from "node:crypto";
import { getJobQueue, queues, type HousekeepingImportJob } from "../jobs/queue";
import { jobDatabase } from "../jobs/database";

export async function dispatchHousekeepingImport(hotelTenantId: string, actorId: string, xmlName: string) {
  const boss = await getJobQueue();
  const client = await jobDatabase().connect();
  try {
    await client.query("BEGIN");
    const sourceKey = createHash("sha256").update(xmlName).digest("hex");
    const source = await client.query(`INSERT INTO hotel_import_sources (id,hotel_tenant_id,provider,source_key,updated_at)
      VALUES ($1,$2,'ASA_XML',$3,NOW()) ON CONFLICT (hotel_tenant_id,provider,source_key)
      DO UPDATE SET updated_at=NOW() RETURNING id`, [randomUUID(), hotelTenantId, sourceKey]);
    const runId = randomUUID();
    const data: HousekeepingImportJob = { hotelTenantId, actorId, xmlName, runId, sourceId: source.rows[0].id };
    const jobId = await boss.send(queues.housekeeping, data, { id: runId, singletonKey: hotelTenantId,
      db: { executeSql: (sql, values) => client.query(sql, values) } });
    if (!jobId) { await client.query("ROLLBACK"); return null; }
    await client.query(`INSERT INTO import_runs (id,hotel_tenant_id,source_id,status,updated_at) VALUES ($1,$2,$3,'QUEUED',NOW())`, [runId, hotelTenantId, data.sourceId]);
    await client.query(`INSERT INTO audit_logs (id,hotel_tenant_id,actor_id,action,entity_type,entity_id,changes,description)
      VALUES ($1,$2,$3,'CREATE','HOUSEKEEPING_IMPORT',$4,$5::jsonb,$6::jsonb)`,
    [randomUUID(), hotelTenantId, actorId, runId, JSON.stringify({ jobId, status: "QUEUED" }), JSON.stringify({ en: "Housekeeping XML import dispatched", de: "Housekeeping-XML-Import gestartet", it: "Importazione XML Housekeeping avviata" })]);
    await client.query("COMMIT");
    return runId;
  } catch (error) { await client.query("ROLLBACK"); throw error; }
  finally { client.release(); }
}
