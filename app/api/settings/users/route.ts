import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { getDatabasePool, queryDatabase } from "../../../../database";
import { getSessionUserId } from "../../../../lib/auth/session";
import { recordAuditLog } from "../../../../lib/audit/audit-service";

type Actor = { id: string; hotel_tenant_id: string; role: string };
const roles = new Set(["EMPLOYEE", "TEAM_LEAD", "MANAGEMENT", "ADMIN"]);

async function admin() {
  const id = await getSessionUserId();
  if (!id) return null;
  const result = await queryDatabase<Actor>(`SELECT id, hotel_tenant_id, role FROM users WHERE id = $1 AND is_active = true AND is_deleted = false LIMIT 1`, [id]);
  const actor = result.rows[0];
  return actor?.role === "ADMIN" ? actor : null;
}

export async function GET() {
  const current = await admin();
  if (!current) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const [users, departments] = await Promise.all([
    queryDatabase(`SELECT u.id, u.first_name, u.last_name, u.email, u.phone_number, u.role, u.is_active, u.department_id, d.name_en AS department_en, d.name_de AS department_de, d.name_it AS department_it FROM users u LEFT JOIN departments d ON d.id = u.department_id AND d.is_deleted = false WHERE u.hotel_tenant_id = $1 AND u.is_deleted = false ORDER BY u.first_name, u.last_name`, [current.hotel_tenant_id]),
    queryDatabase(`SELECT id, name_en, name_de, name_it FROM departments WHERE hotel_tenant_id = $1 AND is_deleted = false AND is_active = true ORDER BY name_en`, [current.hotel_tenant_id]),
  ]);
  return NextResponse.json({ currentUserId: current.id, users: users.rows, departments: departments.rows });
}

export async function POST(request: Request) {
  const current = await admin();
  if (!current) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const firstName = typeof body?.firstName === "string" ? body.firstName.trim() : "";
  const lastName = typeof body?.lastName === "string" ? body.lastName.trim() : "";
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  const phone = typeof body?.phone === "string" ? body.phone.trim() || null : null;
  const role = typeof body?.role === "string" ? body.role : "";
  const departmentId = typeof body?.departmentId === "string" && body.departmentId ? body.departmentId : null;
  const isActive = body?.isActive !== false;
  if (!firstName || !lastName || !/^\S+@\S+\.\S+$/.test(email) || password.length < 8 || !roles.has(role)) return NextResponse.json({ error: "INVALID_FIELDS" }, { status: 400 });
  if (departmentId) {
    const department = await queryDatabase(`SELECT id FROM departments WHERE id = $1 AND hotel_tenant_id = $2 AND is_deleted = false`, [departmentId, current.hotel_tenant_id]);
    if (!department.rows[0]) return NextResponse.json({ error: "INVALID_DEPARTMENT" }, { status: 400 });
  }
  const client = await getDatabasePool().connect();
  try {
    await client.query("BEGIN");
    const result = await client.query<{ id: string }>(`INSERT INTO users (id, hotel_tenant_id, first_name, last_name, email, password_hash, phone_number, language, role, department_id, is_active, created_at, updated_at) VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, (SELECT hotel_language FROM hotel_tenants WHERE id = $1), $7::"UserRole", $8, $9, NOW(), NOW()) RETURNING id`, [current.hotel_tenant_id, firstName, lastName, email, await bcrypt.hash(password, 12), phone, role, departmentId, isActive]);
    await recordAuditLog(client, { hotelTenantId: current.hotel_tenant_id, actorId: current.id, action: "CREATE", entityType: "USER", entityId: result.rows[0].id, changes: { after: { firstName, lastName, email, role } } });
    await client.query("COMMIT");
    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    await client.query("ROLLBACK");
    if (error && typeof error === "object" && "code" in error && error.code === "23505") return NextResponse.json({ error: "EMAIL_EXISTS" }, { status: 409 });
    throw error;
  } finally { client.release(); }
}
