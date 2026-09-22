import "server-only";

import { redirect } from "next/navigation";
import { accessibleModules, currentAccessUser } from "../auth/module-access";
import { prisma } from "../prisma";

export type ScheduleActor = {
  id: string;
  hotel_tenant_id: string;
  role: "EMPLOYEE" | "TEAM_LEAD" | "MANAGEMENT" | "ADMIN";
  departmentId: string | null;
  firstName: string;
  lastName: string;
  canManage: boolean;
};

export async function scheduleViewer(): Promise<ScheduleActor | null> {
  return loadActor(false);
}

export async function scheduleEditor(): Promise<ScheduleActor | null> {
  return loadActor(true);
}

export async function requireScheduleView() {
  const actor = await scheduleViewer();
  if (!actor) redirect("/login");
  return actor;
}

export async function requireScheduleEditor() {
  const actor = await scheduleEditor();
  if (!actor) {
    const viewer = await scheduleViewer();
    if (!viewer) redirect("/login");
    redirect("/schedule/own");
  }
  return actor;
}

async function loadActor(requireManage: boolean): Promise<ScheduleActor | null> {
  const user = await currentAccessUser();
  if (!user) return null;
  const canManage = user.role === "ADMIN" || (await accessibleModules(user)).includes("schedule");
  if (requireManage && !canManage) return null;
  const row = await prisma.user.findFirst({
    where: { id: user.id, isActive: true, isDeleted: false },
    select: { departmentId: true, firstName: true, lastName: true },
  });
  if (!row) return null;
  return { ...user, departmentId: row.departmentId, firstName: row.firstName, lastName: row.lastName, canManage };
}
