import { createHash, randomUUID } from "node:crypto";
import { getJobQueue, queues, type ForecastImportJob } from "../jobs/queue";
import { jobDatabase } from "../jobs/database";

export async function dispatchForecastImport(hotelTenantId: string, xmlName: string) {
  const boss = await getJobQueue();
  const client = await jobDatabase().connect();
  try {
    await client.query("BEGIN");
    const sourceKey = createHash("sha256").update(`forecast:${xmlName}`).digest("hex");
    const source = await client.query(`INSERT INTO hotel_import_sources (id,hotel_tenant_id,provider,source_key,updated_at)
      VALUES ($1,$2,'FORECAST_XML',$3,NOW()) ON CONFLICT (hotel_tenant_id,provider,source_key)
      DO UPDATE SET updated_at=NOW() RETURNING id`, [randomUUID(), hotelTenantId, sourceKey]);
    const runId = randomUUID();
    const data: ForecastImportJob = { hotelTenantId, xmlName: xmlName.trim(), runId, sourceId: source.rows[0].id };
    const jobId = await boss.send(queues.forecastImport, data, { id: runId, singletonKey: `forecast:${hotelTenantId}`,
      db: { executeSql: (sql, values) => client.query(sql, values) } });
    if (!jobId) { await client.query("ROLLBACK"); return null; }
    await client.query(`INSERT INTO import_runs (id,hotel_tenant_id,source_id,status,updated_at) VALUES ($1,$2,$3,'QUEUED',NOW())`, [runId, hotelTenantId, data.sourceId]);
    await client.query(`INSERT INTO audit_logs (id,hotel_tenant_id,actor_id,module,action,entity_type,entity_id,changes,description)
      VALUES ($1,$2,NULL,'revenue','CREATE','FORECAST_IMPORT',$3,$4::jsonb,$5::jsonb)`,
    [randomUUID(), hotelTenantId, runId, JSON.stringify({ jobId, status: "QUEUED" }), JSON.stringify({ en: "Forecast XML import dispatched", de: "Forecast-XML-Import gestartet", it: "Importazione XML previsioni avviata" })]);
    await client.query("COMMIT");
    return runId;
  } catch (error) { await client.query("ROLLBACK"); throw error; }
  finally { client.release(); }
}
