import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { recordAuditLog } from "../../../../../lib/audit/audit-service";
import { getSessionUserId } from "../../../../../lib/auth/session";
import { deleteMcpUser } from "../../../../../lib/mcp/client";
import { createRemoteUser, getMcpUserContext, oneMcpDepartmentId, updateRemoteUser } from "../../../../../lib/mcp/user-sync";
import { prisma } from "../../../../../lib/prisma";
import { acceptedDepartmentIds, parseDepartmentIds, replaceUserDepartments } from "../../../../../lib/settings/user-departments";
import { acceptedTeamIds, parseTeamIds, replaceUserTeams } from "../../../../../lib/settings/user-teams";
async function admin() { const sessionId = await getSessionUserId(); if (!sessionId) return null; const user = await prisma.user.findFirst({ where: { id: sessionId, isActive: true, isDeleted: false }, select: { id: true, hotelTenantId: true, role: true } }); return user?.role === "ADMIN" ? user : null; }
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const current = await admin(); if (!current) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 }); const { id } = await params;
  const body = await request.json().catch(() => null) as Record<string, unknown> | null, firstName = typeof body?.firstName === "string" ? body.firstName.trim() : "", lastName = typeof body?.lastName === "string" ? body.lastName.trim() : "", email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "", password = typeof body?.password === "string" ? body.password : "", phone = typeof body?.phone === "string" ? body.phone.trim() || null : null, role = typeof body?.role === "string" ? body.role : "", selectedDepartmentIds = parseDepartmentIds(body), isActive = body?.isActive === true, selectedTeamIds = parseTeamIds(body);
  const selectedRole = role.length <= 80 ? await prisma.hotelRole.findUnique({ where: { hotelTenantId_key: { hotelTenantId: current.hotelTenantId, key: role } } }) : null;
  if (!firstName || !lastName || !/^\S+@\S+\.\S+$/.test(email) || (password && password.length < 8) || !selectedRole) return NextResponse.json({ error: "INVALID_FIELDS" }, { status: 400 });
  if (id === current.id && (!isActive || role !== "ADMIN")) return NextResponse.json({ error: "CANNOT_RESTRICT_SELF" }, { status: 400 });
  const departmentIds = await acceptedDepartmentIds(current.hotelTenantId, selectedDepartmentIds); if (departmentIds === null) return NextResponse.json({ error: "INVALID_DEPARTMENT" }, { status: 400 });
  if (!departmentIds.length) return NextResponse.json({ error: "DEPARTMENT_REQUIRED" }, { status: 400 });
  const departmentId = departmentIds[0];
  const teamIds = await acceptedTeamIds(current.hotelTenantId, selectedTeamIds); if (teamIds === null) return NextResponse.json({ error: "INVALID_TEAM" }, { status: 400 });
  let previous: { mcpUserId: string | null } | null = null;
  try {
    previous = await prisma.$transaction(async (tx) => {
      const existing = await tx.user.findFirst({ where: { id, hotelTenantId: current.hotelTenantId, isDeleted: false } }); if (!existing) return null;
      await tx.user.update({ where: { id }, data: { firstName, lastName, email, phoneNumber: phone, role: role, departmentId, teamId: teamIds[0] ?? null, isActive, ...(password ? { passwordHash: await bcrypt.hash(password, 12) } : {}) } });
      await replaceUserDepartments(tx, id, departmentIds);
      await replaceUserTeams(tx, id, teamIds);
      await recordAuditLog(tx, { hotelTenantId: current.hotelTenantId, actorId: current.id, action: existing.isActive !== isActive ? "STATUS_CHANGE" : "UPDATE", entityType: "USER", entityId: id, changes: { before: { firstName: existing.firstName, lastName: existing.lastName, email: existing.email, role: existing.role, isActive: existing.isActive }, after: { firstName, lastName, email, role, isActive } } });
      return existing;
    });
  } catch (error) { if (error && typeof error === "object" && "code" in error && error.code === "P2002") return NextResponse.json({ error: "EMAIL_EXISTS" }, { status: 409 }); console.error("User update failed", error); return NextResponse.json({ error: "SAVE_FAILED" }, { status: 500 }); }
  if (!previous) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  let warning: string | null = null;
  try {
    const mcp = await getMcpUserContext(current.hotelTenantId);
    if (mcp) {
      const mcpDepartmentId = await oneMcpDepartmentId(departmentIds, mcp.defaultDepartmentId);
      if (!previous.mcpUserId) {
        const remote = await createRemoteUser(mcp, { email, role: role, isActive, departmentId, mcpDepartmentId, password: password || undefined });
        await prisma.user.update({ where: { id }, data: { mcpUserId: remote.id, mcpUserPassword: remote.password } });
      } else await updateRemoteUser(mcp, { hotelTenantId: current.hotelTenantId, mcpUserId: previous.mcpUserId, email, role: role, isActive, departmentId, mcpDepartmentId });
    }
  } catch (error) { console.error("User MCP sync failed", error); warning = "MCP_SYNC_FAILED"; }
  return NextResponse.json({ success: true, warning });
}
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const current = await admin(); if (!current) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 }); const { id } = await params; if (id === current.id) return NextResponse.json({ error: "CANNOT_DELETE_SELF" }, { status: 400 });
  try { const mcp = await getMcpUserContext(current.hotelTenantId); const found = await prisma.$transaction(async (tx) => { const user = await tx.user.findFirst({ where: { id, hotelTenantId: current.hotelTenantId, isDeleted: false } }); if (!user) return false; if (mcp && user.mcpUserId) await deleteMcpUser(mcp.token, user.mcpUserId, mcp.hotelId); await tx.user.update({ where: { id }, data: { isDeleted: true, isActive: false, deletedAt: new Date(), mcpUserId: null } }); await recordAuditLog(tx, { hotelTenantId: current.hotelTenantId, actorId: current.id, action: "DELETE", entityType: "USER", entityId: id, changes: { before: { firstName: user.firstName, lastName: user.lastName, email: user.email } } }); return true; }, { timeout: 20_000 }); return found ? NextResponse.json({ success: true }) : NextResponse.json({ error: "NOT_FOUND" }, { status: 404 }); } catch (error) { console.error("User/MCP deletion failed", error); return NextResponse.json({ error: "MCP_SYNC_FAILED" }, { status: 502 }); }
}
