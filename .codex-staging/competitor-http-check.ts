import { createHmac } from "node:crypto";
import { Pool } from "pg";
import assert from "node:assert/strict";
const base = 'http://localhost:3000';
async function main() {
  const pool = new Pool({connectionString:process.env.DATABASE_URL});
  try {
    const {rows} = await pool.query("SELECT id FROM users WHERE hotel_tenant_id = $1 AND role = 'ADMIN' AND is_active = true AND is_deleted = false LIMIT 1", ['4d98b1ee-f4b4-4074-b3d0-00ca096d96d1']);
    assert.ok(rows[0], 'Local admin account required for HTTP verification');
    const payload = Buffer.from(JSON.stringify({userId: rows[0].id, expiresAt: Date.now()+60000})).toString('base64url');
    const cookie = 'qualityfriend_session='+payload+'.'+createHmac('sha256',process.env.AUTH_SECRET!).update(payload).digest('base64url');
    const request = (path: string, options: RequestInit = {}) => fetch(base+path, {...options, headers:{cookie,...options.headers}, signal:AbortSignal.timeout(120000)});
    assert.equal((await fetch(base+'/api/competitors')).status,401);
    const list = await request('/api/competitors?limit=20');
    assert.equal(list.status,200); const data = await list.json();
    assert.equal(data.locationKey,'g1493734');
    assert.equal((await request('/api/competitors?limit=101')).status,400);
    assert.equal((await request('/api/competitors/refresh?jobId=bad')).status,400);
    assert.equal((await request('/api/competitors/refresh?jobId=00000000-0000-4000-8000-000000000000')).status,404);
    assert.equal((await request('/api/competitors/refresh',{method:'POST',headers:{origin:'https://other.example'}})).status,403);
    const status=await request('/api/competitors/refresh?jobId=b3671c3a-7c96-4e64-95f1-27be472407aa');
    assert.equal(status.status,200);
    const dispatch = await request('/api/competitors/refresh', {method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({hotelTenantId:'00000000-0000-4000-8000-000000000000',locationKey:'g293916'})});
    assert.ok([202,409].includes(dispatch.status));
    if (dispatch.status===202) {
      const job = await dispatch.json();
      const queued = await request(job.statusUrl).then(response=>response.json());
      assert.equal(queued.locationKey,'g1493734','dispatch must use the session hotel, not the body');
      assert.equal((await request('/api/competitors/refresh',{method:'POST'})).status,409);
    }
    console.log(JSON.stringify({httpChecks:'passed',dispatchStatus:dispatch.status,total:data.total,job:await status.json()}));
  } finally { await pool.end(); }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
