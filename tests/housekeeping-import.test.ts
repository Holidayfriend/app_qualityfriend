import assert from "node:assert/strict";
import { test } from "node:test";
import type { Pool, PoolClient } from "pg";
import { parseAsaXml } from "../lib/housekeeping/xml-parser";
import { createNotification } from "../lib/notifications/service";
import { importHousekeeping, recordImportFailure } from "../lib/housekeeping/import-job";
import { hasTrustedOrigin } from "../lib/security/request-origin";

const record = (attributes = "", children = "") => `<Zimmerreservierung Nummer="004A" Name="Suite &amp; View" Anreise="2026-09-12" Abreise="2026-09-14" Status="reserved" ${attributes}>${children}</Zimmerreservierung>`;
const xml = (records: string) => `<Zimmerreservierungen>${records}</Zimmerreservierungen>`;

test("ASA fields preserve room numbers, count fallback, guest-specific metadata, notes and moves", () => {
  const result = parseAsaXml(xml(record('ZSB="2" Erw.="1" K1="0" K2="1"', '<Zimmergast NameF="Example" GastGeburtsdatum="2000-02-29" Language="IT" VIP="true" Stays="3"/><Zimmergast NameF="Other" Language="DE" VIP="false"/><CombiBemerkungZimmerservice><![CDATA[Use <soft> cloth]]></CombiBemerkungZimmerservice><NachZimmerreservierung Nummer="5"/>')));
  const row = result.records[0];
  assert.equal(row.room, "004A");
  assert.equal(row.category, "Suite & View");
  assert.equal(row.adults, 3);
  assert.equal(row.children, null);
  assert.equal(row.k1, 0);
  assert.equal(row.to, "5");
  assert.equal(row.remarks, "Use <soft> cloth");
  assert.deepEqual(row.guests.map(guest => [guest.language, guest.vip]), [["IT", true], ["DE", false]]);
  assert.equal(row.guests[0].previousStays, 3);
});

test("XML identity is deterministic across status/note updates, not tied to ordering", () => {
  const original = parseAsaXml(xml(record())).records[0];
  const updated = parseAsaXml(xml(record('', '<CombiBemerkungZimmerservice>New note</CombiBemerkungZimmerservice>').replace('Status="reserved"', 'Status="occupied"'))).records[0];
  assert.equal(original.key, updated.key);
  assert.notEqual(original.key, parseAsaXml(xml(record().replace('2026-09-14','2026-09-15'))).records[0].key);
});

test("unsupported requests are counted, cancellations imported, unknown counts remain null", () => {
  const request = record().replace('Status="reserved"','Status="request"');
  const cancelled = record().replace('Status="reserved"','Status="cancelled"');
  const result = parseAsaXml(xml(request + cancelled));
  assert.equal(result.skipped, 1);
  assert.equal(result.records[0].status, "CANCELLED");
  assert.equal(result.records[0].adults, null);
});

test("invalid or ambiguous input fails before database writes", () => {
  for (const input of ["<broken>", "<wrong/>", '<!DOCTYPE test [<!ENTITY x "text">]>'+xml(record()),
    xml(record().replace('2026-09-12','2026-02-30')), xml(record().replace('2026-09-14','2026-09-01')),
    xml(record('ZSB="-1"')), xml(record()+record()), xml(record().replace('Nummer="004A"','Nummer=""'))]) {
    assert.throws(() => parseAsaXml(input));
  }
});

const job = { hotelTenantId: "hotel-a", actorId: "user-a", xmlName: "example", runId: "run-a", sourceId: "source-a" };
function fakePool(responder: (sql: string, values?: unknown[]) => { rows: unknown[]; rowCount?: number }) {
  const queries: { sql: string; values?: unknown[] }[] = [];
  const client = { query: async (sql: string, values?: unknown[]) => { queries.push({ sql, values }); return responder(sql, values); }, release() {} };
  return { queries, client: client as unknown as PoolClient, pool: { connect: async () => client } as unknown as Pool };
}

test("completed run delivery is idempotent and does not reread or import XML", async () => {
  const db = fakePool(sql => ({ rows: sql.startsWith("SELECT status") ? [{status: "SUCCEEDED"}] : [] }));
  assert.deepEqual(await importHousekeeping(db.pool, job), { alreadyCompleted: true });
  assert.ok(!db.queries.some(query => query.sql.includes("INSERT")));
  assert.deepEqual(db.queries.find(query => query.sql.startsWith("SELECT status"))?.values, [job.runId, job.hotelTenantId]);
});

test("worker rechecks tenant/user configuration and rolls back when no authorized actor exists", async () => {
  const db = fakePool(sql => ({ rows: sql.startsWith("SELECT status") ? [{status: "QUEUED"}] : [] }));
  await assert.rejects(importHousekeeping(db.pool, job), /authorization changed/);
  assert.equal(db.queries.at(-1)?.sql, "ROLLBACK");
  const auth = db.queries.find(query => query.sql.includes("JOIN users"));
  assert.deepEqual(auth?.values, [job.hotelTenantId, job.actorId]);
  assert.ok(auth?.sql.includes("p.can_view") && auth.sql.includes("u.role='ADMIN'"));
  assert.ok(!auth?.sql.includes("p.can_update") && !auth?.sql.includes("p.scope="));
});

test("refresh accepts the public host behind a reverse proxy, but rejects unrelated origins", () => {
  assert.equal(hasTrustedOrigin(new Request("http://localhost:3000/api/housekeeping/refresh", {headers:{origin:"http://qualityfriend.test",host:"qualityfriend.test"}})),true);
  assert.equal(hasTrustedOrigin(new Request("http://localhost:3000/api/housekeeping/refresh", {headers:{origin:"https://qualityfriend.test","x-forwarded-host":"qualityfriend.test"}})),true);
  assert.equal(hasTrustedOrigin(new Request("http://localhost:3000/api/housekeeping/refresh", {headers:{origin:"https://unrelated.example",host:"qualityfriend.test"}})),false);
});

test("failure notification and state are atomic and are skipped for completed runs", async () => {
  const db = fakePool(sql => ({rows: sql.startsWith("UPDATE import_runs") ? [{id:job.runId}] : [],rowCount:1}));
  await recordImportFailure(db.pool, job, true);
  assert.equal(db.queries[0].sql, "BEGIN");
  assert.equal(db.queries.at(-1)?.sql, "COMMIT");
  assert.ok(db.queries.some(query => query.sql.includes("INSERT INTO notifications")));
  const completed = fakePool(() => ({rows:[],rowCount:0}));
  await recordImportFailure(completed.pool, job, true);
  assert.ok(!completed.queries.some(query => query.sql.includes("INSERT")));
});

test("notification service requires translations, safe destinations and idempotent tenant-recipient keys", async () => {
  const db = fakePool(() => ({rows:[]}));
  const data = {hotelTenantId:job.hotelTenantId,recipientId:job.actorId,moduleKey:"housekeeping",eventKey:job.runId,icon:"housekeeping",destination:"/housekeeping",text:{en:{title:"Done",body:"Imported"},de:{title:"Fertig",body:"Importiert"},it:{title:"Fatto",body:"Importato"}}};
  await createNotification(db.client,data);
  assert.deepEqual(db.queries[0].values?.slice(1,3),[job.hotelTenantId,job.actorId]);
  assert.ok(db.queries[0].sql.includes("ON CONFLICT (hotel_tenant_id,recipient_id,event_key) DO NOTHING"));
  await assert.rejects(createNotification(db.client,{...data,destination:"//outside.example"}));
  await assert.rejects(createNotification(db.client,{...data,text:{...data.text,it:{title:"",body:""}}}));
});

test("successful import commits data and notification together and keeps manual cleaning state", async () => {
  const db = fakePool(sql => ({ rows: sql.startsWith("SELECT status") ? [{status:"QUEUED"}]
    : sql.includes("JOIN users") ? [{asa_xml_name:job.xmlName}]
    : sql.includes("RETURNING id") ? [{id:"record-a"}] : [] }));
  const result = await importHousekeeping(db.pool,job,undefined,async () => xml(record('', '<Zimmergast NameF="Test guest"/>')));
  assert.deepEqual(result,{created:1,updated:0,guests:1,read:1,skipped:0});
  const notificationIndex = db.queries.findIndex(query => query.sql.includes("INSERT INTO notifications"));
  assert.ok(notificationIndex>db.queries.findIndex(query=>query.sql.includes("INSERT INTO reservation_guests")));
  assert.equal(db.queries.at(-1)?.sql,"COMMIT");
  const state = db.queries.find(query=>query.sql.includes("INSERT INTO room_operational_states"));
  assert.ok(state?.sql.includes("DO NOTHING"));
  assert.ok(!db.queries.some(query=>/DELETE FROM reservations\b/.test(query.sql)));
  for(const query of db.queries.filter(query=>/INSERT INTO (rooms|room_categories|reservations|reservation_room_stays|reservation_guests|notifications)\b/.test(query.sql))) {
    assert.equal(query.values?.[1],job.hotelTenantId);
  }
});

test("notification failure rolls back the import rather than committing data without a receipt", async () => {
  const db = fakePool(sql => {
    if(sql.includes("INSERT INTO notifications"))throw new Error("Notification write failed");
    return {rows:sql.startsWith("SELECT status")?[{status:"QUEUED"}]:sql.includes("JOIN users")?[{asa_xml_name:job.xmlName}]:sql.includes("RETURNING id")?[{id:"record-a"}]:[]};
  });
  await assert.rejects(importHousekeeping(db.pool,job,undefined,async()=>xml(record())),/Notification write failed/);
  assert.equal(db.queries.at(-1)?.sql,"ROLLBACK");
  assert.equal(db.queries.filter(query=>query.sql==="COMMIT").length,1); // Only the initial RUNNING status committed.
});
