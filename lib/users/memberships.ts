import type { Prisma } from "../../app/generated/prisma/client";

export const actorDepartmentSelect = {
  departmentId: true,
  departmentMemberships: {
    where: { department: { isDeleted: false } },
    select: { departmentId: true },
  },
} as const;

export function actorDepartments(row: { departmentId: string | null; departmentMemberships: { departmentId: string }[] }) {
  const departmentIds = [...new Set(row.departmentMemberships.map((item) => item.departmentId))];
  if (!departmentIds.length && row.departmentId) departmentIds.push(row.departmentId);
  return { departmentId: departmentIds[0] ?? null, departmentIds };
}

export function departmentIdsOf(actor: { departmentIds?: string[]; departmentId?: string | null }) {
  if (actor.departmentIds?.length) return actor.departmentIds;
  return actor.departmentId ? [actor.departmentId] : [];
}

export function usersInDepartments(departmentIds: string[]): Prisma.UserWhereInput {
  return {
    OR: [
      { departmentMemberships: { some: { departmentId: { in: departmentIds } } } },
      { departmentId: { in: departmentIds } },
    ],
  };
}
