import type { Prisma } from "../../app/generated/prisma/client";
import { departmentIdsOf } from "../users/memberships";

type AudienceActor = { departmentIds?: string[]; departmentId?: string | null };

// Hotel-wide manuals have no department. A manual shared with several departments
// stays searchable for a person in any of those departments. The document text
// index is unchanged; this only decides who can see it.
export function manualAudienceWhere(actor: AudienceActor): Prisma.ManualDocumentWhereInput {
  const departmentIds = departmentIdsOf(actor);
  return {
    OR: [
      { departmentId: null, departments: { none: {} } },
      ...(departmentIds.length
        ? [
            { departmentId: { in: departmentIds } },
            { departments: { some: { departmentId: { in: departmentIds } } } },
          ]
        : []),
    ],
  };
}
