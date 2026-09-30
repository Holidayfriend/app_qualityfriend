import "server-only";

import { accessibleModules, currentAccessUser } from "../auth/module-access";
import { prisma } from "../prisma";
import { actorDepartmentSelect, actorDepartments } from "../users/memberships";

export type NotesActor = {
  id: string;
  hotel_tenant_id: string;
  role: string;
  departmentId: string | null;
  departmentIds: string[];
  firstName: string;
  lastName: string;
  canManage: boolean;
};

async function loadActor(requireManage: boolean): Promise<NotesActor | null> {
  const user = await currentAccessUser();
  if (!user) return null;
  const canManage = user.role === "ADMIN" || (await accessibleModules(user)).includes("notes");
  if (requireManage && !canManage) return null;
  const row = await prisma.user.findFirst({
    where: { id: user.id, isActive: true, isDeleted: false },
    select: { ...actorDepartmentSelect, firstName: true, lastName: true },
  });
  if (!row) return null;
  return { ...user, ...actorDepartments(row), firstName: row.firstName, lastName: row.lastName, canManage };
}

export async function notesViewer() {
  return loadActor(false);
}

export async function notesEditor() {
  return loadActor(true);
}

/** @deprecated use notesViewer or notesEditor */
export async function notesActor() {
  return notesViewer();
}
