import "server-only";
import { accessibleModules, type AccessUser } from "../auth/module-access";

export function hasHousekeepingBoardAccess(modules: readonly string[]) {
  return modules.includes("housekeeping") || modules.includes("housekeeper");
}

export function hasHousekeepingAdminAccess(modules: readonly string[]) {
  return modules.includes("housekeeping");
}

export function hasHousekeeperAccess(modules: readonly string[]) {
  return modules.includes("housekeeper");
}

export async function housekeepingAccess(user: AccessUser) {
  const modules = await accessibleModules(user);
  return {
    modules,
    board: hasHousekeepingBoardAccess(modules),
    admin: hasHousekeepingAdminAccess(modules),
    housekeeper: hasHousekeeperAccess(modules),
  };
}
