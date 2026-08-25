import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { getDatabasePool, queryDatabase } from "../../../../../database";
import { getSessionUserId } from "../../../../../lib/auth/session";
import { recordAuditLog } from "../../../../../lib/audit/audit-service";

type Actor = { id: string; hotel_tenant_id: string; role: string };
const roles = new Set(["EMPLOYEE", "TEAM_LEAD", "MANAGEMENT", "ADMIN"]);
async function admin() { const id = await getSessionUserId(); if (!id) return null; const result = await queryDatabase<Actor>(`SELECT id, hotel_tenant_id, role FROM users WHERE id = $1 AND is_active = true AND is_deleted = false`, [id]); const actor = result.rows[0]; return actor?.role === "ADMIN" ? actor : null; }

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const current = await admin();
  if (!current) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const { id } = await params;
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const firstName = typeof body?.firstName === "string" ? body.firstName.trim() : "";
  const lastName = typeof body?.lastName === "string" ? body.lastName.trim() : "";
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  const phone = typeof body?.phone === "string" ? body.phone.trim() || null : null;
  const role = typeof body?.role === "string" ? body.role : "";
  const departmentId = typeof body?.departmentId === "string" && body.departmentId ? body.departmentId : null;
  const isActive = body?.isActive === true;
  if (!firstName || !lastName || !/^\S+@\S+\.\S+$/.test(email) || (password && password.length < 8) || !roles.has(role)) return NextResponse.json({ error: "INVALID_FIELDS" }, { status: 400 });
  if (id === current.id && (!isActive || role !== "ADMIN")) return NextResponse.json({ error: "CANNOT_RESTRICT_SELF" }, { status: 400 });
  if (departmentId) { const department = await queryDatabase(`SELECT id FROM departments WHERE id = $1 AND hotel_tenant_id = $2 AND is_deleted = false`, [departmentId, current.hotel_tenant_id]); if (!department.rows[0]) return NextResponse.json({ error: "INVALID_DEPARTMENT" }, { status: 400 }); }
  const client = await getDatabasePool().connect();
  try {
    await client.query("BEGIN");
    const previous = await client.query<{ first_name: string; last_name: string; email: string; role: string; is_active: boolean }>(`SELECT first_name, last_name, email, role, is_active FROM users WHERE id = $1 AND hotel_tenant_id = $2 AND is_deleted = false FOR UPDATE`, [id, current.hotel_tenant_id]);
    if (!previous.rows[0]) { await client.query("ROLLBACK"); return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 }); }
    const passwordHash = password ? await bcrypt.hash(password, 12) : null;
    await client.query(`UPDATE users SET first_name=$1, last_name=$2, email=$3, phone_number=$4, role=$5::"UserRole", department_id=$6, is_active=$7, password_hash=COALESCE($8,password_hash), updated_at=NOW() WHERE id=$9`, [firstName, lastName, email, phone, role, departmentId, isActive, passwordHash, id]);
    const action = previous.rows[0].is_active !== isActive ? "STATUS_CHANGE" : "UPDATE";
    await recordAuditLog(client, { hotelTenantId: current.hotel_tenant_id, actorId: current.id, action, entityType: "USER", entityId: id, changes: { before: { firstName: previous.rows[0].first_name, lastName: previous.rows[0].last_name, email: previous.rows[0].email, role: previous.rows[0].role, isActive: previous.rows[0].is_active }, after: { firstName, lastName, email, role, isActive } } });
    await client.query("COMMIT"); return NextResponse.json({ success: true });
  } catch (error) { await client.query("ROLLBACK"); if (error && typeof error === "object" && "code" in error && error.code === "23505") return NextResponse.json({ error: "EMAIL_EXISTS" }, { status: 409 }); throw error; }
  finally { client.release(); }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const current = await admin(); if (!current) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const { id } = await params; if (id === current.id) return NextResponse.json({ error: "CANNOT_DELETE_SELF" }, { status: 400 });
  const client = await getDatabasePool().connect();
  try { await client.query("BEGIN"); const result = await client.query<{ first_name: string; last_name: string; email: string }>(`UPDATE users SET is_deleted=true, is_active=false, deleted_at=NOW(), updated_at=NOW() WHERE id=$1 AND hotel_tenant_id=$2 AND is_deleted=false RETURNING first_name,last_name,email`, [id,current.hotel_tenant_id]); const user=result.rows[0]; if(!user){await client.query("ROLLBACK");return NextResponse.json({error:"NOT_FOUND"},{status:404});} await recordAuditLog(client,{hotelTenantId:current.hotel_tenant_id,actorId:current.id,action:"DELETE",entityType:"USER",entityId:id,changes:{before:{firstName:user.first_name,lastName:user.last_name,email:user.email}}}); await client.query("COMMIT"); return NextResponse.json({success:true}); } catch(error){await client.query("ROLLBACK");throw error;} finally{client.release();}
}
