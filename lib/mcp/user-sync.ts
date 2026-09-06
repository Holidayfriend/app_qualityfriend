import "server-only";
import { randomBytes } from "node:crypto";
import type { UserRole } from "../../app/generated/prisma/enums";
import { prisma } from "../prisma";
import { createSyncedMcpUser, loginMcpUser, updateMcpUser } from "./client";

export type McpUserContext = { hotelId: string; defaultDepartmentId: string; token: string };
export function mcpRole(role: UserRole) { return role === "ADMIN" || role === "MANAGEMENT" ? "author" : "reader"; }

export async function roleHasMcpAccess(hotelTenantId: string, role: UserRole) {
  if (role === "ADMIN") return true;
  const permission = await prisma.roleModulePermission.findUnique({ where: { hotelTenantId_role_moduleKey: { hotelTenantId, role, moduleKey: "mcp" } }, select: { canView: true } });
  return permission?.canView === true;
}

export async function getMcpUserContext(hotelTenantId: string): Promise<McpUserContext | null> {
  const hotel = await prisma.hotelTenant.findUnique({ where: { id: hotelTenantId }, select: { activeMcp: true, mcpHotelId: true, mcpUserEmail: true, mcpUserPassword: true, mcpUserDepartment: true } });
  if (!hotel?.activeMcp) return null;
  if (!hotel.mcpHotelId || !hotel.mcpUserEmail || !hotel.mcpUserPassword || !hotel.mcpUserDepartment) throw new Error("Active MCP hotel credentials are incomplete.");
  return { hotelId: hotel.mcpHotelId, defaultDepartmentId: hotel.mcpUserDepartment, token: await loginMcpUser(hotel.mcpUserEmail, hotel.mcpUserPassword) };
}

export async function createRemoteUser(context: McpUserContext, data: { email: string; role: UserRole; isActive: boolean; departmentId: string | null; password?: string }) {
  const department = data.departmentId ? await prisma.department.findUnique({ where: { id: data.departmentId }, select: { mcpDepartmentId: true } }) : null;
  const departmentId = department?.mcpDepartmentId || context.defaultDepartmentId;
  const password = data.password || randomBytes(24).toString("base64url");
  const id = await createSyncedMcpUser(context.token, data.email, password, context.hotelId, departmentId, mcpRole(data.role));
  const allowed = data.isActive && await roleHasMcpAccess((await prisma.hotelTenant.findFirstOrThrow({ where: { mcpHotelId: context.hotelId }, select: { id: true } })).id, data.role);
  if (!allowed) await updateMcpUser(context.token, id, { hotelId: context.hotelId, email: data.email, role: mcpRole(data.role), isActive: false, departmentId });
  return { id, password };
}

export async function updateRemoteUser(context: McpUserContext, local: { hotelTenantId: string; mcpUserId: string; email: string; role: UserRole; isActive: boolean; departmentId: string | null }) {
  const department = local.departmentId ? await prisma.department.findUnique({ where: { id: local.departmentId }, select: { mcpDepartmentId: true } }) : null;
  const isActive = local.isActive && await roleHasMcpAccess(local.hotelTenantId, local.role);
  await updateMcpUser(context.token, local.mcpUserId, { hotelId: context.hotelId, email: local.email, role: mcpRole(local.role), isActive, departmentId: department?.mcpDepartmentId || context.defaultDepartmentId });
}

export async function setRemoteUserAccess(context: McpUserContext, local: { mcpUserId: string | null; email: string; role: UserRole; isActive: boolean; departmentId: string | null }, canView: boolean) {
  const department = local.departmentId ? await prisma.department.findUnique({ where: { id: local.departmentId }, select: { mcpDepartmentId: true } }) : null;
  const departmentId = department?.mcpDepartmentId || context.defaultDepartmentId;
  let id = local.mcpUserId, password: string | null = null;
  if (!id) { password = randomBytes(24).toString("base64url"); id = await createSyncedMcpUser(context.token, local.email, password, context.hotelId, departmentId, mcpRole(local.role)); }
  await updateMcpUser(context.token, id, { hotelId: context.hotelId, email: local.email, role: mcpRole(local.role), isActive: local.isActive && canView, departmentId });
  return { id, password };
}

export async function syncMissingMcpUsers(hotelTenantId: string, context: McpUserContext) {
  const users = await prisma.user.findMany({ where: { hotelTenantId, isDeleted: false, mcpUserId: null }, select: { id: true, email: true, role: true, isActive: true, departmentId: true } });
  for (const user of users) {
    const remote = await createRemoteUser(context, user);
    await prisma.user.update({ where: { id: user.id }, data: { mcpUserId: remote.id, mcpUserPassword: remote.password } });
  }
}
