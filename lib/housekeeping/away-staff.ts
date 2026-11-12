import type { PrismaClient } from "../../app/generated/prisma/client";

type ShiftKindRow = { userId: string; kind: string };

// Vacation and time off both take the person off housekeeping for that whole day.
// Only a published shift counts. An unpublished draft leaves today's rooms as they are.
export function isAwayKind(kind: string) {
  return kind === "OFF" || kind === "VACATION";
}

export function awayUserIds(published: readonly ShiftKindRow[]) {
  const away = new Set<string>();
  for (const row of published) {
    if (isAwayKind(row.kind)) away.add(row.userId);
  }
  return away;
}

export async function loadAwayUserIds(db: Pick<PrismaClient, "hotelShift">, hotelTenantId: string, workDate: string) {
  const published = await db.hotelShift.findMany({
    where: { hotelTenantId, workDate: new Date(`${workDate}T00:00:00.000Z`) },
    select: { userId: true, kind: true },
  });
  return awayUserIds(published);
}

export type CoverageRoom = {
  number: string;
  permanentUserId: string | null;
  assignedToId: string | null;
  completed?: boolean;
};

// Rooms whose permanent cleaner is away today and that nobody else has taken over.
export function coverageGaps(rooms: readonly CoverageRoom[], awayIds: ReadonlySet<string>) {
  const byUser = new Map<string, string[]>();
  for (const room of rooms) {
    if (room.completed) continue;
    const permanentUserId = room.permanentUserId;
    if (!permanentUserId || !awayIds.has(permanentUserId)) continue;
    if (room.assignedToId && room.assignedToId !== permanentUserId) continue;
    const list = byUser.get(permanentUserId) ?? [];
    list.push(room.number);
    byUser.set(permanentUserId, list);
  }
  return [...byUser.entries()].map(([userId, numbers]) => ({
    userId,
    rooms: [...numbers].sort((left, right) => left.localeCompare(right, undefined, { numeric: true })),
  }));
}
