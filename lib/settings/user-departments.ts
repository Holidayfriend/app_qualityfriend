import type { Prisma } from "../../app/generated/prisma/client";
import { prisma } from "../prisma";

export function parseDepartmentIds(body: Record<string, unknown> | null) {
  const raw = body?.departmentIds;
  const ids = Array.isArray(raw) ? raw.filter((id): id is string => typeof id === "string" && id.length > 0) : [];
  if (!ids.length && typeof body?.departmentId === "string" && body.departmentId) ids.push(body.departmentId);
  return [...new Set(ids)];
}

export async function acceptedDepartmentIds(hotelTenantId: string, ids: string[]) {
  if (!ids.length) return [];
  const rows = await prisma.department.findMany({ where: { id: { in: ids }, hotelTenantId, isDeleted: false }, select: { id: true } });
  const allowed = new Set(rows.map((row) => row.id));
  return ids.every((id) => allowed.has(id)) ? ids : null;
}

export async function replaceUserDepartments(tx: Prisma.TransactionClient, userId: string, departmentIds: string[]) {
  await tx.userDepartment.deleteMany({ where: { userId } });
  if (departmentIds.length) await tx.userDepartment.createMany({ data: departmentIds.map((departmentId) => ({ userId, departmentId })) });
  return departmentIds[0] ?? null;
}
