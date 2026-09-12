import "dotenv/config";
import { Pool } from "pg";
import { createJobQueue, initializeQueues, queues } from "../lib/jobs/queue";

async function main() {
  const hotelTenantId = process.argv[2];
  if (!hotelTenantId || !/^[0-9a-f-]{36}$/i.test(hotelTenantId)) throw new Error("Usage: npm run competitors:refresh -- HOTEL_TENANT_UUID");
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const boss = createJobQueue();
  try {
    const result = await pool.query("SELECT tripadvisor_id FROM hotel_tenants WHERE id = $1 AND is_active = true", [hotelTenantId]);
    const locationKey = result.rows[0]?.tripadvisor_id?.trim();
    if (!locationKey || !/^[a-zA-Z0-9_-]{1,120}$/.test(locationKey)) throw new Error("Hotel has no valid saved Tripadvisor location ID.");
    await boss.start();
    await initializeQueues(boss);
    const id = await boss.send(queues.competitors, { hotelTenantId, locationKey }, { singletonKey: hotelTenantId });
    if (!id) throw new Error("A refresh is already queued or running for this hotel.");
    console.log(JSON.stringify({ jobId: id, locationKey, status: "queued" }));
  } finally {
    await boss.stop();
    await pool.end();
  }
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; });
