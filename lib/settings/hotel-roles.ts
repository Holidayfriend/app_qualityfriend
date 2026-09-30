import "server-only";
import { prisma } from "../prisma";
import { getSessionUserId } from "../auth/session";
import { systemRoles } from "../auth/role-policy";

export async function roleAdministrator() {
  const id = await getSessionUserId();
  if (!id) return null;
  return prisma.user.findFirst({
    where: { id, role: "ADMIN", isActive: true, isDeleted: false },
    select: { id: true, hotelTenantId: true },
  });
}

export async function hotelRoles(hotelTenantId: string) {
  const rows = await prisma.hotelRole.findMany({ where: { hotelTenantId }, orderBy: [{ createdAt: "asc" }, { key: "asc" }] });
  const order = new Map<string, number>(systemRoles.map((role, index) => [role.key, index]));
  return rows.sort((a, b) => (order.get(a.key) ?? 4) - (order.get(b.key) ?? 4));
}

export function validRoleName(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.trim().length <= 180;
}
