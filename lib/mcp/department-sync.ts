import "server-only";
import { prisma } from "../prisma";
import { loginMcpUser } from "./client";
import { createSyncedMcpDepartment } from "./client";

export type McpDepartmentContext = { hotelId: string; token: string };

export async function getMcpDepartmentContext(hotelTenantId: string): Promise<McpDepartmentContext | null> {
  const hotel = await prisma.hotelTenant.findUnique({
    where: { id: hotelTenantId },
    select: { activeMcp: true, mcpHotelId: true, mcpUserEmail: true, mcpUserPassword: true },
  });
  if (!hotel?.activeMcp) return null;
  if (!hotel.mcpHotelId || !hotel.mcpUserEmail || !hotel.mcpUserPassword) throw new Error("Active MCP hotel credentials are incomplete.");
  return { hotelId: hotel.mcpHotelId, token: await loginMcpUser(hotel.mcpUserEmail, hotel.mcpUserPassword) };
}

export async function syncMissingMcpDepartments(hotelTenantId: string, mcpHotelId: string, token: string) {
  const departments = await prisma.department.findMany({ where: { hotelTenantId, isActive: true, isDeleted: false, mcpDepartmentId: null }, select: { id: true, nameEn: true } });
  for (const department of departments) {
    const mcpDepartmentId = await createSyncedMcpDepartment(token, mcpHotelId, department.nameEn);
    await prisma.department.update({ where: { id: department.id }, data: { mcpDepartmentId } });
  }
}
