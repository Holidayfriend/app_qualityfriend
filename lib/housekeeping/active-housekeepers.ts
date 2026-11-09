import type { PrismaClient } from "../../app/generated/prisma/client";
import { resolveRoleModules } from "../auth/role-policy";

type HousekeeperLookup = {
  user: { findMany: PrismaClient["user"]["findMany"] };
  roleModulePermission: { findMany: PrismaClient["roleModulePermission"]["findMany"] };
};

export function isActiveHousekeeper(
  user: { role: string; isActive: boolean; isDeleted: boolean },
  permissions: readonly { moduleKey: string; canView: boolean }[],
) {
  if (!user.isActive || user.isDeleted || user.role === "ADMIN") return false;
  return resolveRoleModules(user.role, permissions).includes("housekeeper");
}

// People who can receive rooms and extra jobs: active users whose role still includes the housekeeper module.
export async function activeHousekeeperIds(db: HousekeeperLookup, hotelTenantId: string) {
  const [users, permissions] = await Promise.all([
    db.user.findMany({
      where: { hotelTenantId, isActive: true, isDeleted: false, role: { not: "ADMIN" } },
      select: { id: true, role: true, isActive: true, isDeleted: true },
    }),
    db.roleModulePermission.findMany({
      where: { hotelTenantId },
      select: { role: true, moduleKey: true, canView: true },
    }),
  ]);
  const byRole = new Map<string, { moduleKey: string; canView: boolean }[]>();
  for (const row of permissions) {
    const list = byRole.get(row.role) ?? [];
    list.push(row);
    byRole.set(row.role, list);
  }
  return new Set(users.filter((user) => isActiveHousekeeper(user, byRole.get(user.role) ?? [])).map((user) => user.id));
}
