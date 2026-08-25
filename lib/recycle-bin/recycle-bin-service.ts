import "server-only";

import { NextResponse } from "next/server";
import { getDatabasePool, queryDatabase } from "../../database";
import { getSessionUserId } from "../auth/session";
import { recordAuditLog } from "../audit/audit-service";

export type RecyclableType = "department" | "team" | "user";
const registry = {
  department: { table: "departments", entityType: "DEPARTMENT", names: "name_en, name_de, name_it", tracksUpdater: true },
  team: { table: "teams", entityType: "TEAM", names: "name_en, name_de, name_it", tracksUpdater: true },
  user: { table: "users", entityType: "USER", names: "first_name || ' ' || last_name AS name_en, first_name || ' ' || last_name AS name_de, first_name || ' ' || last_name AS name_it", tracksUpdater: false },
} as const;

type Actor = { id: string; hotel_tenant_id: string };
type DeletedRow = { id: string; name_en: string; name_de: string; name_it: string; deleted_at: string };

async function actor() {
  const userId = await getSessionUserId();
  if (!userId) return null;
  const result = await queryDatabase<Actor>(`SELECT id, hotel_tenant_id FROM users WHERE id = $1 AND is_active = true AND is_deleted = false LIMIT 1`, [userId]);
  return result.rows[0] ?? null;
}

function output(type: RecyclableType, row: DeletedRow) {
  return { id: row.id, type, names: { en: row.name_en, de: row.name_de, it: row.name_it }, deletedAt: row.deleted_at };
}

export async function listDeletedItems() {
  const current = await actor();
  if (!current) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  const groups = await Promise.all((Object.keys(registry) as RecyclableType[]).map(async (type) => {
    const result = await queryDatabase<DeletedRow>(`SELECT id, ${registry[type].names}, deleted_at FROM ${registry[type].table} WHERE hotel_tenant_id = $1 AND is_deleted = true ORDER BY deleted_at DESC`, [current.hotel_tenant_id]);
    return result.rows.map((row) => output(type, row));
  }));
  return NextResponse.json(groups.flat().sort((a, b) => new Date(b.deletedAt).getTime() - new Date(a.deletedAt).getTime()));
}

export async function restoreDeletedItem(type: RecyclableType, id: string) {
  const current = await actor();
  if (!current) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  const client = await getDatabasePool().connect();
  try {
    await client.query("BEGIN");
    const updater = registry[type].tracksUpdater ? "updated_by_id = $1," : "";
    const idIndex = registry[type].tracksUpdater ? 2 : 1;
    const tenantIndex = registry[type].tracksUpdater ? 3 : 2;
    const values = registry[type].tracksUpdater ? [current.id, id, current.hotel_tenant_id] : [id, current.hotel_tenant_id];
    const result = await client.query<DeletedRow>(`UPDATE ${registry[type].table} SET is_deleted = false, is_active = true, deleted_at = NULL, ${updater} updated_at = NOW() WHERE id = $${idIndex} AND hotel_tenant_id = $${tenantIndex} AND is_deleted = true RETURNING id, ${registry[type].names}, deleted_at`, values);
    const item = result.rows[0];
    if (!item) { await client.query("ROLLBACK"); return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 }); }
    const names = { en: item.name_en, de: item.name_de, it: item.name_it };
    await recordAuditLog(client, { hotelTenantId: current.hotel_tenant_id, actorId: current.id, action: "RESTORE", entityType: registry[type].entityType, entityId: id, changes: { after: names } });
    await client.query("COMMIT");
    return NextResponse.json({ success: true, item: { ...output(type, item), deletedAt: null } });
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
