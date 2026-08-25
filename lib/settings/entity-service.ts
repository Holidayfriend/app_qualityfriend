import { NextResponse } from "next/server";
import { getDatabasePool, queryDatabase } from "../../database";
import { recordAuditLog } from "../audit/audit-service";
import { getSessionUserId } from "../auth/session";

export type EntityType = "department" | "team";
const tables = { department: "departments", team: "teams" } as const;

type Actor = { id: string; hotel_tenant_id: string };
type EntityRow = { id: string; name_en: string; name_de: string; name_it: string };

async function actor() {
  const userId = await getSessionUserId();
  if (!userId) return null;
  const result = await queryDatabase<Actor>("SELECT id, hotel_tenant_id FROM users WHERE id = $1 AND is_active = true AND is_deleted = false LIMIT 1", [userId]);
  return result.rows[0] ?? null;
}

function names(body: unknown) {
  if (!body || typeof body !== "object") return null;
  const data = body as Record<string, unknown>;
  const nameEn = typeof data.nameEn === "string" ? data.nameEn.trim() : "";
  const nameDe = typeof data.nameDe === "string" ? data.nameDe.trim() : "";
  const nameIt = typeof data.nameIt === "string" ? data.nameIt.trim() : "";
  return nameEn && nameDe && nameIt ? { nameEn, nameDe, nameIt } : null;
}

function output(row: EntityRow) {
  return { id: row.id, names: { en: row.name_en, de: row.name_de, it: row.name_it }, count: 0 };
}

export async function listEntities(type: EntityType) {
  const current = await actor();
  if (!current) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  const result = await queryDatabase<EntityRow>(`SELECT id, name_en, name_de, name_it FROM ${tables[type]} WHERE hotel_tenant_id = $1 AND is_deleted = false ORDER BY name_en`, [current.hotel_tenant_id]);
  return NextResponse.json(result.rows.map(output));
}

export async function createEntity(request: Request, type: EntityType) {
  const current = await actor();
  if (!current) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  const values = names(await request.json().catch(() => null));
  if (!values) return NextResponse.json({ error: "INVALID_FIELDS" }, { status: 400 });
  const client = await getDatabasePool().connect();
  try {
    await client.query("BEGIN");
    const result = await client.query<EntityRow>(`INSERT INTO ${tables[type]} (id, hotel_tenant_id, name_en, name_de, name_it, created_by_id, updated_by_id, created_at, updated_at) VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $5, NOW(), NOW()) RETURNING id, name_en, name_de, name_it`, [current.hotel_tenant_id, values.nameEn, values.nameDe, values.nameIt, current.id]);
    const entity = result.rows[0];
    await recordAuditLog(client, { hotelTenantId: current.hotel_tenant_id, actorId: current.id, action: "CREATE", entityType: type.toUpperCase(), entityId: entity.id, changes: { after: output(entity).names } });
    await client.query("COMMIT");
    return NextResponse.json(output(entity), { status: 201 });
  } catch (error) {
    await client.query("ROLLBACK");
    if (error && typeof error === "object" && "code" in error && error.code === "23505") return NextResponse.json({ error: "NAME_EXISTS" }, { status: 409 });
    throw error;
  } finally {
    client.release();
  }
}

export async function updateEntity(request: Request, type: EntityType, id: string) {
  const current = await actor();
  if (!current) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  const values = names(await request.json().catch(() => null));
  if (!values) return NextResponse.json({ error: "INVALID_FIELDS" }, { status: 400 });
  const client = await getDatabasePool().connect();
  try {
    await client.query("BEGIN");
    const previous = await client.query<EntityRow>(`SELECT id, name_en, name_de, name_it FROM ${tables[type]} WHERE id = $1 AND hotel_tenant_id = $2 AND is_deleted = false FOR UPDATE`, [id, current.hotel_tenant_id]);
    if (!previous.rows[0]) { await client.query("ROLLBACK"); return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 }); }
    const result = await client.query<EntityRow>(`UPDATE ${tables[type]} SET name_en = $1, name_de = $2, name_it = $3, updated_by_id = $4, updated_at = NOW() WHERE id = $5 RETURNING id, name_en, name_de, name_it`, [values.nameEn, values.nameDe, values.nameIt, current.id, id]);
    const entity = result.rows[0];
    await recordAuditLog(client, { hotelTenantId: current.hotel_tenant_id, actorId: current.id, action: "UPDATE", entityType: type.toUpperCase(), entityId: id, changes: { before: output(previous.rows[0]).names, after: output(entity).names } });
    await client.query("COMMIT");
    return NextResponse.json(output(entity));
  } catch (error) {
    await client.query("ROLLBACK");
    if (error && typeof error === "object" && "code" in error && error.code === "23505") return NextResponse.json({ error: "NAME_EXISTS" }, { status: 409 });
    throw error;
  } finally {
    client.release();
  }
}

export async function deleteEntity(type: EntityType, id: string) {
  const current = await actor();
  if (!current) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  const client = await getDatabasePool().connect();
  try {
    await client.query("BEGIN");
    const result = await client.query<EntityRow>(`UPDATE ${tables[type]} SET is_deleted = true, is_active = false, deleted_at = NOW(), updated_by_id = $1, updated_at = NOW() WHERE id = $2 AND hotel_tenant_id = $3 AND is_deleted = false RETURNING id, name_en, name_de, name_it`, [current.id, id, current.hotel_tenant_id]);
    const entity = result.rows[0];
    if (!entity) { await client.query("ROLLBACK"); return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 }); }
    await recordAuditLog(client, { hotelTenantId: current.hotel_tenant_id, actorId: current.id, action: "DELETE", entityType: type.toUpperCase(), entityId: id, changes: { before: output(entity).names, after: { isDeleted: true, isActive: false } } });
    await client.query("COMMIT");
    return NextResponse.json({ success: true });
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
