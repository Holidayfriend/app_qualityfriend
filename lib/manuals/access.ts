import "server-only";

import { accessibleModules, currentAccessUser } from "../auth/module-access";
import { prisma } from "../prisma";
import { actorDepartmentSelect, actorDepartments } from "../users/memberships";

export type ManualsActor = {
  id: string;
  hotel_tenant_id: string;
  role: string;
  departmentId: string | null;
  departmentIds: string[];
  firstName: string;
  lastName: string;
  canManage: boolean;
};

export async function manualsViewer() {
  const user = await currentAccessUser();
  if (!user) return null;
  const canManage = user.role === "ADMIN" || (await accessibleModules(user)).includes("manuals");
  const row = await prisma.user.findFirst({
    where: { id: user.id, isActive: true, isDeleted: false },
    select: { ...actorDepartmentSelect, firstName: true, lastName: true },
  });
  if (!row) return null;
  return { ...user, ...actorDepartments(row), firstName: row.firstName, lastName: row.lastName, canManage };
}

export async function manualsEditor() {
  const actor = await manualsViewer();
  return actor?.canManage ? actor : null;
}
