import "server-only";

import { accessibleModules, currentAccessUser } from "../auth/module-access";
import { prisma } from "../prisma";
import { actorDepartmentSelect, actorDepartments } from "../users/memberships";

export type HandoversActor = {
  id: string;
  hotel_tenant_id: string;
  role: "EMPLOYEE" | "TEAM_LEAD" | "MANAGEMENT" | "ADMIN";
  departmentId: string | null;
  departmentIds: string[];
  firstName: string;
  lastName: string;
  canManage: boolean;
};

async function loadActor(requireManage: boolean): Promise<HandoversActor | null> {
  const user = await currentAccessUser();
  if (!user) return null;
  const canManage = user.role === "ADMIN" || (await accessibleModules(user)).includes("handovers");
  if (requireManage && !canManage) return null;
  const row = await prisma.user.findFirst({
    where: { id: user.id, isActive: true, isDeleted: false },
    select: { ...actorDepartmentSelect, firstName: true, lastName: true },
  });
  if (!row) return null;
  return { ...user, ...actorDepartments(row), firstName: row.firstName, lastName: row.lastName, canManage };
}

export async function handoversViewer() {
  return loadActor(false);
}

export async function handoversEditor() {
  return loadActor(true);
}
