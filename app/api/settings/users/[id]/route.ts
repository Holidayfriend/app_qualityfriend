import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import type { UserRole } from "../../../../../app/generated/prisma/enums";
import { recordAuditLog } from "../../../../../lib/audit/audit-service";
import { getSessionUserId } from "../../../../../lib/auth/session";
import { deleteMcpUser } from "../../../../../lib/mcp/client";
import { createRemoteUser, getMcpUserContext, updateRemoteUser } from "../../../../../lib/mcp/user-sync";
import { prisma } from "../../../../../lib/prisma";
const roles = new Set(["EMPLOYEE", "TEAM_LEAD", "MANAGEMENT", "ADMIN"]);
async function admin() { const sessionId = await getSessionUserId(); if (!sessionId) return null; const user = await prisma.user.findFirst({ where: { id: sessionId, isActive: true, isDeleted: false }, select: { id: true, hotelTenantId: true, role: true } }); return user?.role === "ADMIN" ? user : null; }
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const current = await admin(); if (!current) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 }); const { id } = await params;
  const body = await request.json().catch(() => null) as Record<string, unknown> | null, firstName = typeof body?.firstName === "string" ? body.firstName.trim() : "", lastName = typeof body?.lastName === "string" ? body.lastName.trim() : "", email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "", password = typeof body?.password === "string" ? body.password : "", phone = typeof body?.phone === "string" ? body.phone.trim() || null : null, role = typeof body?.role === "string" ? body.role : "", departmentId = typeof body?.departmentId === "string" && body.departmentId ? body.departmentId : null, isActive = body?.isActive === true;
  if (!firstName || !lastName || !/^\S+@\S+\.\S+$/.test(email) || (password && password.length < 8) || !roles.has(role)) return NextResponse.json({ error: "INVALID_FIELDS" }, { status: 400 });
  if (id === current.id && (!isActive || role !== "ADMIN")) return NextResponse.json({ error: "CANNOT_RESTRICT_SELF" }, { status: 400 });
  if (departmentId && !await prisma.department.findFirst({ where: { id: departmentId, hotelTenantId: current.hotelTenantId, isDeleted: false }, select: { id: true } })) return NextResponse.json({ error: "INVALID_DEPARTMENT" }, { status: 400 });
  try {
    const mcp = await getMcpUserContext(current.hotelTenantId);
    const found = await prisma.$transaction(async (tx) => {
      const previous = await tx.user.findFirst({ where: { id, hotelTenantId: current.hotelTenantId, isDeleted: false } }); if (!previous) return false;
      let mcpUserId = previous.mcpUserId, mcpUserPassword = previous.mcpUserPassword;
      if (mcp) {
        if (!mcpUserId) { const remote = await createRemoteUser(mcp, { email, role: role as UserRole, isActive, departmentId, password: password || undefined }); mcpUserId = remote.id; mcpUserPassword = remote.password; }
        else await updateRemoteUser(mcp, { hotelTenantId: current.hotelTenantId, mcpUserId, email, role: role as UserRole, isActive, departmentId });
      }
      await tx.user.update({ where: { id }, data: { firstName, lastName, email, phoneNumber: phone, role: role as UserRole, departmentId, isActive, mcpUserId, mcpUserPassword, ...(password ? { passwordHash: await bcrypt.hash(password, 12) } : {}) } });
      await recordAuditLog(tx, { hotelTenantId: current.hotelTenantId, actorId: current.id, action: previous.isActive !== isActive ? "STATUS_CHANGE" : "UPDATE", entityType: "USER", entityId: id, changes: { before: { firstName: previous.firstName, lastName: previous.lastName, email: previous.email, role: previous.role, isActive: previous.isActive }, after: { firstName, lastName, email, role, isActive } } }); return true;
    }, { timeout: 20_000 });
    return found ? NextResponse.json({ success: true }) : NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  } catch (error) { if (error && typeof error === "object" && "code" in error && error.code === "P2002") return NextResponse.json({ error: "EMAIL_EXISTS" }, { status: 409 }); console.error("User/MCP update failed", error); return NextResponse.json({ error: "MCP_SYNC_FAILED" }, { status: 502 }); }
}
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const current = await admin(); if (!current) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 }); const { id } = await params; if (id === current.id) return NextResponse.json({ error: "CANNOT_DELETE_SELF" }, { status: 400 });
  try { const mcp = await getMcpUserContext(current.hotelTenantId); const found = await prisma.$transaction(async (tx) => { const user = await tx.user.findFirst({ where: { id, hotelTenantId: current.hotelTenantId, isDeleted: false } }); if (!user) return false; if (mcp && user.mcpUserId) await deleteMcpUser(mcp.token, user.mcpUserId, mcp.hotelId); await tx.user.update({ where: { id }, data: { isDeleted: true, isActive: false, deletedAt: new Date(), mcpUserId: null } }); await recordAuditLog(tx, { hotelTenantId: current.hotelTenantId, actorId: current.id, action: "DELETE", entityType: "USER", entityId: id, changes: { before: { firstName: user.firstName, lastName: user.lastName, email: user.email } } }); return true; }, { timeout: 20_000 }); return found ? NextResponse.json({ success: true }) : NextResponse.json({ error: "NOT_FOUND" }, { status: 404 }); } catch (error) { console.error("User/MCP deletion failed", error); return NextResponse.json({ error: "MCP_SYNC_FAILED" }, { status: 502 }); }
}
