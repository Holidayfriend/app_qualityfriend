import "server-only";
import { accessibleModules } from "../auth/module-access";
import { getPersonalMcpSession, getSessionUserId, refreshMcpSession } from "../auth/session";
import { prisma } from "../prisma";

export async function mcpPortalAccess(userId: string) {
  const user = await prisma.user.findFirst({ where: { id: userId, isActive: true, isDeleted: false }, select: { id: true, hotelTenantId: true, role: true } });
  if (!user) return { error: "UNAUTHENTICATED" as const, status: 401 };
  const modules = await accessibleModules({ id: user.id, hotel_tenant_id: user.hotelTenantId, role: user.role });
  if (!modules.includes("mcp")) return { error: "FORBIDDEN" as const, status: 403 };
  return null;
}

export async function getMcpPortalContext() {
  const userId = await getSessionUserId();
  if (!userId) return { error: "UNAUTHENTICATED" as const, status: 401 };
  const denied = await mcpPortalAccess(userId);
  if (denied) return denied;
  let session = await getPersonalMcpSession(userId);
  if (!session) {
    await refreshMcpSession(userId);
    session = await getPersonalMcpSession(userId);
  }
  if (!session) return { error: "MCP_USER_NOT_SYNCED" as const, status: 409 };
  return { userId, ...session };
}
