import "server-only";
import { randomBytes } from "node:crypto";
import { prisma } from "../prisma";
import { createSyncedMcpUser, loginMcpUser, updateMcpUser } from "./client";

export type McpUserContext = { hotelId: string; defaultDepartmentId: string; token: string };
export function mcpRole(role: string) { return role === "ADMIN" || role === "MANAGEMENT" ? "author" : "reader"; }
export function fallbackMcpUserEmail(userId: string) { return `mcp-user-${userId}@qualityfriend.solutions`; }

function isEmailConflict(error: unknown) {
  return error instanceof Error && /email already registered/i.test(error.message);
}

export async function loginSyncedMcpUser(userId: string, email: string, password: string) {
  try { return await loginMcpUser(email, password); }
  catch (error) {
    try { return await loginMcpUser(fallbackMcpUserEmail(userId), password); }
    catch { throw error; }
  }
}

export async function roleHasMcpAccess(hotelTenantId: string, role: string) {
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

export async function oneMcpDepartmentId(localDepartmentIds: string[], fallback: string) {
  if (!localDepartmentIds.length) return fallback;
  const rows = await prisma.department.findMany({ where: { id: { in: localDepartmentIds } }, select: { id: true, mcpDepartmentId: true } });
  const remote = new Map(rows.map((row) => [row.id, row.mcpDepartmentId]));
  for (const id of localDepartmentIds) {
    const mcpDepartmentId = remote.get(id);
    if (mcpDepartmentId) return mcpDepartmentId;
  }
  return fallback;
}

export async function createRemoteUser(context: McpUserContext, data: { id: string; email: string; role: string; isActive: boolean; departmentId: string | null; mcpDepartmentId?: string | null; password?: string }) {
  const department = !data.mcpDepartmentId && data.departmentId ? await prisma.department.findUnique({ where: { id: data.departmentId }, select: { mcpDepartmentId: true } }) : null;
  const departmentId = data.mcpDepartmentId || department?.mcpDepartmentId || context.defaultDepartmentId;
  const password = data.password || randomBytes(24).toString("base64url");
  let remoteEmail = data.email;
  let id: string;
  try { id = await createSyncedMcpUser(context.token, remoteEmail, password, context.hotelId, departmentId, mcpRole(data.role)); }
  catch (error) {
    if (!isEmailConflict(error)) throw error;
    remoteEmail = fallbackMcpUserEmail(data.id);
    id = await createSyncedMcpUser(context.token, remoteEmail, password, context.hotelId, departmentId, mcpRole(data.role));
  }
  const allowed = data.isActive && await roleHasMcpAccess((await prisma.hotelTenant.findFirstOrThrow({ where: { mcpHotelId: context.hotelId }, select: { id: true } })).id, data.role);
  if (!allowed) await updateMcpUser(context.token, id, { hotelId: context.hotelId, email: remoteEmail, role: mcpRole(data.role), isActive: false, departmentId });
  return { id, password };
}

export async function updateRemoteUser(context: McpUserContext, local: { id: string; hotelTenantId: string; mcpUserId: string; email: string; role: string; isActive: boolean; departmentId: string | null; mcpDepartmentId?: string | null }) {
  const department = !local.mcpDepartmentId && local.departmentId ? await prisma.department.findUnique({ where: { id: local.departmentId }, select: { mcpDepartmentId: true } }) : null;
  const isActive = local.isActive && await roleHasMcpAccess(local.hotelTenantId, local.role);
  const data = { hotelId: context.hotelId, email: local.email, role: mcpRole(local.role), isActive, departmentId: local.mcpDepartmentId || department?.mcpDepartmentId || context.defaultDepartmentId };
  try { await updateMcpUser(context.token, local.mcpUserId, data); }
  catch (error) {
    if (!isEmailConflict(error)) throw error;
    await updateMcpUser(context.token, local.mcpUserId, { ...data, email: fallbackMcpUserEmail(local.id) });
  }
}

export async function setRemoteUserAccess(context: McpUserContext, local: { id: string; mcpUserId: string | null; email: string; role: string; isActive: boolean; departmentId: string | null }, canView: boolean) {
  const department = local.departmentId ? await prisma.department.findUnique({ where: { id: local.departmentId }, select: { mcpDepartmentId: true } }) : null;
  const departmentId = department?.mcpDepartmentId || context.defaultDepartmentId;
  let id = local.mcpUserId, password: string | null = null, remoteEmail = local.email;
  if (!id) {
    password = randomBytes(24).toString("base64url");
    try { id = await createSyncedMcpUser(context.token, remoteEmail, password, context.hotelId, departmentId, mcpRole(local.role)); }
    catch (error) {
      if (!isEmailConflict(error)) throw error;
      remoteEmail = fallbackMcpUserEmail(local.id);
      id = await createSyncedMcpUser(context.token, remoteEmail, password, context.hotelId, departmentId, mcpRole(local.role));
    }
  }
  const data = { hotelId: context.hotelId, email: remoteEmail, role: mcpRole(local.role), isActive: local.isActive && canView, departmentId };
  try { await updateMcpUser(context.token, id, data); }
  catch (error) {
    if (!isEmailConflict(error)) throw error;
    await updateMcpUser(context.token, id, { ...data, email: fallbackMcpUserEmail(local.id) });
  }
  return { id, password };
}

export async function syncMissingMcpUsers(hotelTenantId: string, context: McpUserContext) {
  const users = await prisma.user.findMany({ where: { hotelTenantId, isDeleted: false, mcpUserId: null }, select: { id: true, email: true, role: true, isActive: true, departmentId: true } });
  for (const user of users) {
    const remote = await createRemoteUser(context, user);
    await prisma.user.update({ where: { id: user.id }, data: { mcpUserId: remote.id, mcpUserPassword: remote.password } });
  }
}

export async function ensureMcpUser(userId: string, context: McpUserContext) {
  const user = await prisma.user.findFirst({
    where: { id: userId, isDeleted: false },
    select: {
      id: true,
      email: true,
      role: true,
      isActive: true,
      departmentId: true,
      mcpUserId: true,
      mcpUserPassword: true,
    },
  });
  if (!user) throw new Error("The QualityFriend user could not be found.");
  if (user.mcpUserId && user.mcpUserPassword) {
    return { id: user.mcpUserId, email: user.email, password: user.mcpUserPassword };
  }
  if (user.mcpUserId || user.mcpUserPassword) {
    throw new Error("The MCP user credentials are incomplete.");
  }

  const remote = await createRemoteUser(context, user);
  await prisma.user.update({
    where: { id: user.id },
    data: { mcpUserId: remote.id, mcpUserPassword: remote.password },
  });
  return { id: remote.id, email: user.email, password: remote.password };
}
