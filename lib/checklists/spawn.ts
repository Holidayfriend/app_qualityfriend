import { randomUUID } from "node:crypto";
import type { Prisma, PrismaClient } from "../../app/generated/prisma/client";
import { hotelTodayIso, isDueOn, isoDate, parseIsoDate } from "./recurrence";

type Db = PrismaClient | Prisma.TransactionClient;

const include = {
  items: { orderBy: { sortOrder: "asc" as const } },
};

export async function recipientIds(db: Db, hotelTenantId: string, row: {
  assignType: "ALL" | "DEPT" | "PERSON";
  departmentId: string | null;
  assigneeId: string | null;
}, skipId?: string | null) {
  const ids = new Set<string>();
  if (row.assignType === "PERSON" && row.assigneeId) {
    ids.add(row.assigneeId);
  } else if (row.assignType === "DEPT" && row.departmentId) {
    const users = await db.user.findMany({
      where: { hotelTenantId, isActive: true, isDeleted: false, departmentId: row.departmentId },
      select: { id: true },
    });
    for (const user of users) ids.add(user.id);
  } else if (row.assignType === "ALL") {
    const users = await db.user.findMany({
      where: { hotelTenantId, isActive: true, isDeleted: false },
      select: { id: true },
    });
    for (const user of users) ids.add(user.id);
  }
  if (skipId) ids.delete(skipId);
  return [...ids];
}

export async function notifyChecklist(db: Db, input: {
  hotelTenantId: string;
  skipId?: string | null;
  author: string;
  checklistId: string;
  event: "create" | "run" | "done";
  title: { en: string; de: string; it: string };
  ids: string[];
}) {
  if (!input.ids.length) return;
  const text = input.event === "done"
    ? {
      en: { title: "Checklist completed", body: `${input.author} marked “${input.title.en}” as completed.` },
      de: { title: "Checkliste erledigt", body: `${input.author} hat „${input.title.de}“ als erledigt markiert.` },
      it: { title: "Checklist completata", body: `${input.author} ha segnato “${input.title.it}” come completata.` },
    }
    : {
      en: { title: "New checklist", body: `${input.author} shared “${input.title.en}”. Anyone assigned can complete it once for the team.` },
      de: { title: "Neue Checkliste", body: `${input.author} hat „${input.title.de}“ geteilt. Eine Person im Team kann sie für alle erledigen.` },
      it: { title: "Nuova checklist", body: `${input.author} ha condiviso “${input.title.it}”. Chiunque sia assegnato può completarla una volta per il team.` },
    };
  await db.notification.createMany({
    skipDuplicates: true,
    data: input.ids.map((recipientId) => ({
      hotelTenantId: input.hotelTenantId,
      recipientId,
      moduleKey: "tasks",
      eventKey: `checklists:${input.checklistId}:${input.event}:${randomUUID()}`,
      icon: "tasks",
      destination: `/tasks/checklists/${input.checklistId}`,
      titleEn: text.en.title,
      titleDe: text.de.title,
      titleIt: text.it.title,
      bodyEn: text.en.body,
      bodyDe: text.de.body,
      bodyIt: text.it.body,
      requiredScope: "OWN",
    })),
  });
}

export async function spawnRun(db: Db, original: Prisma.HotelChecklistGetPayload<{ include: typeof include }>, dayIso: string, notify: boolean, skipId?: string | null) {
  const dueAt = parseIsoDate(dayIso);
  if (!dueAt) return null;
  const existing = await db.hotelChecklist.findFirst({
    where: { originalId: original.id, dueAt },
    select: { id: true },
  });
  if (existing) return { id: existing.id, created: false };
  const created = await db.hotelChecklist.create({
    data: {
      hotelTenantId: original.hotelTenantId,
      createdById: original.createdById,
      originalId: original.id,
      assigneeId: original.assigneeId,
      departmentId: original.departmentId,
      origin: "RUN",
      kind: "CHECKLIST",
      status: "ACTIVE",
      assignType: original.assignType,
      dueType: original.dueType,
      recurrence: original.recurrence,
      title: original.title,
      titleDe: original.titleDe,
      titleIt: original.titleIt,
      description: original.description,
      descriptionDe: original.descriptionDe,
      descriptionIt: original.descriptionIt,
      weekdays: original.weekdays,
      startAt: original.startAt,
      endAt: original.endAt,
      dueAt,
      originalLocale: original.originalLocale,
      items: {
        create: original.items.map((item, index) => ({
          sortOrder: index,
          text: item.text,
          textDe: item.textDe,
          textIt: item.textIt,
          state: "OPEN",
        })),
      },
    },
  });
  if (notify) {
    const author = await db.user.findFirst({ where: { id: original.createdById }, select: { firstName: true, lastName: true } });
    await notifyChecklist(db, {
      hotelTenantId: original.hotelTenantId,
      author: author ? `${author.firstName} ${author.lastName}`.trim() : "",
      checklistId: created.id,
      event: "run",
      title: { en: original.title, de: original.titleDe, it: original.titleIt },
      ids: await recipientIds(db, original.hotelTenantId, original, skipId),
    });
  }
  return { id: created.id, created: true };
}

export async function spawnIfDue(db: Db, original: Prisma.HotelChecklistGetPayload<{ include: typeof include }>, dayIso: string, notify: boolean, skipId?: string | null) {
  if (original.kind !== "CHECKLIST" || original.origin !== "ORIGINAL" || original.status !== "ACTIVE" || original.dueType !== "RECURRING") return null;
  if (dayIso <= isoDate(original.createdAt)) return null;
  if (!isDueOn(original, dayIso)) return null;
  return spawnRun(db, original, dayIso, notify, skipId);
}

export async function spawnAllHotelChecklists(prisma: PrismaClient, hotelTenantId?: string) {
  const hotels = await prisma.hotelTenant.findMany({
    where: { isActive: true, ...(hotelTenantId ? { id: hotelTenantId } : {}) },
    select: { id: true, timeZone: true },
  });
  const results: Array<Record<string, unknown>> = [];
  for (const hotel of hotels) {
    const dayIso = hotelTodayIso(hotel.timeZone);
    const originals = await prisma.hotelChecklist.findMany({
      where: { hotelTenantId: hotel.id, kind: "CHECKLIST", origin: "ORIGINAL", status: "ACTIVE", dueType: "RECURRING" },
      include,
    });
    let spawned = 0;
    for (const original of originals) {
      try {
        const row = await spawnIfDue(prisma, original, dayIso, true);
        if (row?.created) spawned += 1;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        results.push({ ok: false, hotelTenantId: hotel.id, originalId: original.id, error: message });
      }
    }
    results.push({ ok: true, hotelTenantId: hotel.id, dayIso, originals: originals.length, spawned });
  }
  return results;
}
