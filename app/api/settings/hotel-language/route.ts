import { NextResponse } from "next/server";
import { getDatabasePool, queryDatabase } from "../../../../database";
import { getSessionUserId } from "../../../../lib/auth/session";
import { recordAuditLog } from "../../../../lib/audit/audit-service";

type Actor = { id: string; hotel_tenant_id: string };
const languages = new Set(["EN", "DE", "IT"]);

async function actor() {
  const userId = await getSessionUserId();
  if (!userId) return null;
  const result = await queryDatabase<Actor>(`SELECT id, hotel_tenant_id FROM users WHERE id = $1 AND is_active = true AND is_deleted = false LIMIT 1`, [userId]);
  return result.rows[0] ?? null;
}

export async function GET() {
  const current = await actor();
  if (!current) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  const result = await queryDatabase<{ hotel_language: string }>(`SELECT hotel_language FROM hotel_tenants WHERE id = $1 AND is_active = true LIMIT 1`, [current.hotel_tenant_id]);
  if (!result.rows[0]) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  return NextResponse.json({ language: result.rows[0].hotel_language });
}

export async function PATCH(request: Request) {
  const current = await actor();
  if (!current) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  const body = await request.json().catch(() => null);
  const language = body && typeof body.language === "string" ? body.language.toUpperCase() : "";
  if (!languages.has(language)) return NextResponse.json({ error: "INVALID_LANGUAGE" }, { status: 400 });
  const client = await getDatabasePool().connect();
  try {
    await client.query("BEGIN");
    const previous = await client.query<{ hotel_language: string }>(`SELECT hotel_language FROM hotel_tenants WHERE id = $1 AND is_active = true FOR UPDATE`, [current.hotel_tenant_id]);
    if (!previous.rows[0]) { await client.query("ROLLBACK"); return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 }); }
    await client.query(`UPDATE hotel_tenants SET hotel_language = $1::"HotelLanguage", updated_at = NOW() WHERE id = $2`, [language, current.hotel_tenant_id]);
    if (previous.rows[0].hotel_language !== language) await recordAuditLog(client, { hotelTenantId: current.hotel_tenant_id, actorId: current.id, action: "UPDATE", entityType: "HOTEL", entityId: current.hotel_tenant_id, changes: { before: previous.rows[0].hotel_language, after: language, field: "hotelLanguage" } });
    await client.query("COMMIT");
    return NextResponse.json({ success: true, language });
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
