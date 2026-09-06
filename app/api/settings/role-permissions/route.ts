import { NextResponse } from "next/server";
import { getSessionUserId } from "../../../../lib/auth/session";
import { recordAuditLog } from "../../../../lib/audit/audit-service";
import { getMcpUserContext, setRemoteUserAccess } from "../../../../lib/mcp/user-sync";
import { prisma } from "../../../../lib/prisma";
const roles = new Set(["EMPLOYEE", "TEAM_LEAD", "MANAGEMENT"]), modules = new Set(["dashboard", "aiAssistant", "chat", "mcp", "handovers", "tasks", "housekeeping", "repairs", "notes", "schedule", "recruiting", "manuals", "budget", "revenue", "competitors", "users", "departmentTeams", "roles"]); type Role = "EMPLOYEE" | "TEAM_LEAD" | "MANAGEMENT";
async function actor() { const id = await getSessionUserId(); if (!id) return null; return prisma.user.findFirst({ where: { id, isActive: true, isDeleted: false }, select: { id: true, hotelTenantId: true, role: true } }); }
export async function GET() { const current = await actor(); if (!current) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 }); if (current.role !== "ADMIN") return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 }); const items = await prisma.roleModulePermission.findMany({ where: { hotelTenantId: current.hotelTenantId }, select: { role: true, moduleKey: true, canView: true } }); return NextResponse.json(items.map((item) => ({ role: item.role, module_key: item.moduleKey, can_view: item.canView }))); }
export async function PATCH(request: Request) {
  const current = await actor(); if (!current) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 }); if (current.role !== "ADMIN") return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const body = await request.json().catch(() => null), role = body && typeof body.role === "string" ? body.role : "", moduleKey = body && typeof body.moduleKey === "string" ? body.moduleKey : "", canView = body && typeof body.canView === "boolean" ? body.canView : null;
  if (!roles.has(role) || !modules.has(moduleKey) || canView === null) return NextResponse.json({ error: "INVALID_FIELDS" }, { status: 400 });
  try {
    const mcp = moduleKey === "mcp" ? await getMcpUserContext(current.hotelTenantId) : null;
    await prisma.$transaction(async (tx) => {
      const key = { hotelTenantId: current.hotelTenantId, role: role as Role, moduleKey }, previous = await tx.roleModulePermission.findUnique({ where: { hotelTenantId_role_moduleKey: key } });
      const result = await tx.roleModulePermission.upsert({ where: { hotelTenantId_role_moduleKey: key }, create: { ...key, canView }, update: { canView } });
      if (mcp) { const users = await tx.user.findMany({ where: { hotelTenantId: current.hotelTenantId, role: role as Role, isDeleted: false }, select: { id: true, mcpUserId: true, email: true, role: true, isActive: true, departmentId: true } }); for (const user of users) { const remote = await setRemoteUserAccess(mcp, user, canView); if (!user.mcpUserId) await tx.user.update({ where: { id: user.id }, data: { mcpUserId: remote.id, mcpUserPassword: remote.password } }); } }
      await recordAuditLog(tx, { hotelTenantId: current.hotelTenantId, actorId: current.id, action: "UPDATE", entityType: "ROLE_PERMISSION", entityId: result.id, changes: { before: `${role} · ${moduleKey}: ${previous?.canView ?? false}`, after: `${role} · ${moduleKey}: ${canView}` } });
    }, { timeout: 30_000 });
    return NextResponse.json({ success: true });
  } catch (error) { console.error("Role/MCP synchronization failed", error); return NextResponse.json({ error: "MCP_SYNC_FAILED" }, { status: 502 }); }
}
