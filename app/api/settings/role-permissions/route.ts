import { NextResponse } from "next/server";
import { getSessionUserId } from "../../../../lib/auth/session";
import { recordAuditLog } from "../../../../lib/audit/audit-service";
import { getMcpUserContext, setRemoteUserAccess } from "../../../../lib/mcp/user-sync";
import { prisma } from "../../../../lib/prisma";
import { editableModuleKeys } from "../../../../lib/auth/role-policy";
const modules = new Set<string>(editableModuleKeys);
async function actor() { const id = await getSessionUserId(); if (!id) return null; return prisma.user.findFirst({ where: { id, isActive: true, isDeleted: false }, select: { id: true, hotelTenantId: true, role: true } }); }
export async function GET() { const current = await actor(); if (!current) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 }); if (current.role !== "ADMIN") return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 }); const items = await prisma.roleModulePermission.findMany({ where: { hotelTenantId: current.hotelTenantId }, select: { role: true, moduleKey: true, canView: true } }); return NextResponse.json(items.map((item) => ({ role: item.role, module_key: item.moduleKey, can_view: item.canView }))); }
export async function PATCH(request: Request) {
  const current = await actor(); if (!current) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 }); if (current.role !== "ADMIN") return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const body = await request.json().catch(() => null), role = body && typeof body.role === "string" ? body.role : "", moduleKey = body && typeof body.moduleKey === "string" ? body.moduleKey : "", canView = body && typeof body.canView === "boolean" ? body.canView : null;
  if ((role === "ADMIN" || !await prisma.hotelRole.findUnique({ where: { hotelTenantId_key: { hotelTenantId: current.hotelTenantId, key: role } } })) || !modules.has(moduleKey) || canView === null) return NextResponse.json({ error: "INVALID_FIELDS" }, { status: 400 });
  try {
    await prisma.$transaction(async (tx) => {
      const keys = moduleKey === "revenue" ? ["revenue", "budget", "competitors"] : [moduleKey];
      let result = { id: "" };
      let previousView = false;
      for (const keyName of keys) {
        const key = { hotelTenantId: current.hotelTenantId, role, moduleKey: keyName };
        const previous = await tx.roleModulePermission.findUnique({ where: { hotelTenantId_role_moduleKey: key } });
        if (keyName === moduleKey) previousView = previous?.canView ?? false;
        result = await tx.roleModulePermission.upsert({ where: { hotelTenantId_role_moduleKey: key }, create: { ...key, canView }, update: { canView } });
      }
      await recordAuditLog(tx, { module: "settings", hotelTenantId: current.hotelTenantId, actorId: current.id, action: "UPDATE", entityType: "ROLE_PERMISSION", entityId: result.id, changes: { before: `${role} · ${moduleKey}: ${previousView}`, after: `${role} · ${moduleKey}: ${canView}` } });
    });
  } catch (error) {
    console.error("Role permission update failed", error);
    return NextResponse.json({ error: "UPDATE_FAILED" }, { status: 500 });
  }
  if (moduleKey !== "mcp") return NextResponse.json({ success: true });
  try {
    const mcp = await getMcpUserContext(current.hotelTenantId);
    if (!mcp) return NextResponse.json({ success: true });
    const users = await prisma.user.findMany({ where: { hotelTenantId: current.hotelTenantId, role, isDeleted: false }, select: { id: true, mcpUserId: true, email: true, role: true, isActive: true, departmentId: true } });
    for (const user of users) {
      const remote = await setRemoteUserAccess(mcp, user, canView);
      if (!user.mcpUserId) await prisma.user.update({ where: { id: user.id }, data: { mcpUserId: remote.id, mcpUserPassword: remote.password } });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Role permission saved; MCP synchronization failed", error);
    return NextResponse.json({ success: true, warning: "MCP_SYNC_FAILED" });
  }
}
