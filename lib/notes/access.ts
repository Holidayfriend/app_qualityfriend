import "server-only";

import { accessibleModules, currentAccessUser } from "../auth/module-access";
import { prisma } from "../prisma";

export type NotesActor = {
  id: string;
  hotel_tenant_id: string;
  role: "EMPLOYEE" | "TEAM_LEAD" | "MANAGEMENT" | "ADMIN";
  departmentId: string | null;
  firstName: string;
  lastName: string;
};

export async function notesActor(): Promise<NotesActor | null> {
  const user = await currentAccessUser();
  if (!user || !(await accessibleModules(user)).includes("notes")) return null;
  const row = await prisma.user.findFirst({
    where: { id: user.id, isActive: true, isDeleted: false },
    select: { departmentId: true, firstName: true, lastName: true },
  });
  if (!row) return null;
  return { ...user, departmentId: row.departmentId, firstName: row.firstName, lastName: row.lastName };
}
