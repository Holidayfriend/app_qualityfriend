import { NextResponse } from "next/server";
import { getDatabasePool, queryDatabase } from "../../../../database";
import { getSessionUserId } from "../../../../lib/auth/session";
import { recordAuditLog } from "../../../../lib/audit/audit-service";

const roles = new Set(["EMPLOYEE", "TEAM_LEAD", "MANAGEMENT"]);
const modules = new Set(["dashboard", "aiAssistant", "chat", "mcp", "handovers", "tasks", "housekeeping", "repairs", "notes", "schedule", "recruiting", "manuals", "budget", "revenue", "competitors", "users", "roles"]);
type Actor = { id: string; hotel_tenant_id: string; role: string };

async function actor() {
  const userId = await getSessionUserId();
  if (!userId) return null;
  const result = await queryDatabase<Actor>(`SELECT id, hotel_tenant_id, role FROM users WHERE id = $1 AND is_active = true AND is_deleted = false LIMIT 1`, [userId]);
  return result.rows[0] ?? null;
}

export async function GET() {
  const current = await actor();
  if (!current) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  if (current.role !== "ADMIN") return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const result = await queryDatabase(`SELECT role, module_key, can_view FROM role_module_permissions WHERE hotel_tenant_id = $1`, [current.hotel_tenant_id]);
  return NextResponse.json(result.rows);
}

export async function PATCH(request: Request) {
  const current = await actor();
  if (!current) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  if (current.role !== "ADMIN") return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const body = await request.json().catch(() => null);
  const role = body && typeof body.role === "string" ? body.role : "";
  const moduleKey = body && typeof body.moduleKey === "string" ? body.moduleKey : "";
  const canView = body && typeof body.canView === "boolean" ? body.canView : null;
  if (!roles.has(role) || !modules.has(moduleKey) || canView === null) return NextResponse.json({ error: "INVALID_FIELDS" }, { status: 400 });

  const client = await getDatabasePool().connect();
  try {
    await client.query("BEGIN");
    const previous = await client.query<{ can_view: boolean }>(`SELECT can_view FROM role_module_permissions WHERE hotel_tenant_id = $1 AND role = $2::"UserRole" AND module_key = $3 FOR UPDATE`, [current.hotel_tenant_id, role, moduleKey]);
    const result = await client.query<{ id: string }>(`INSERT INTO role_module_permissions (id, hotel_tenant_id, role, module_key, can_view, created_at, updated_at) VALUES (gen_random_uuid(), $1, $2::"UserRole", $3, $4, NOW(), NOW()) ON CONFLICT (hotel_tenant_id, role, module_key) DO UPDATE SET can_view = EXCLUDED.can_view, updated_at = NOW() RETURNING id`, [current.hotel_tenant_id, role, moduleKey, canView]);
    await recordAuditLog(client, { hotelTenantId: current.hotel_tenant_id, actorId: current.id, action: "UPDATE", entityType: "ROLE_PERMISSION", entityId: result.rows[0].id, changes: { before: `${role} · ${moduleKey}: ${previous.rows[0]?.can_view ?? false}`, after: `${role} · ${moduleKey}: ${canView}` } });
    await client.query("COMMIT");
    return NextResponse.json({ success: true });
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
