import "server-only";

import { randomUUID } from "node:crypto";
import type { Prisma, RepairKind, RepairTicketStatus, RepairVisibility } from "../../app/generated/prisma/client";
import { recordAuditLog } from "../audit/audit-service";
import { pickLocalized } from "../recruiting/job-fields";
import { prisma } from "../prisma";
import type { RepairsActor } from "./access";
import { translateRepairFields } from "./translate";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const include = {
  createdBy: { select: { firstName: true, lastName: true } },
  assignee: { select: { id: true, firstName: true, lastName: true } },
  departments: { select: { departmentId: true } },
  comments: {
    orderBy: { createdAt: "asc" as const },
    include: { author: { select: { firstName: true, lastName: true } } },
  },
};

type Row = Prisma.RepairGetPayload<{ include: typeof include }>;
const statusUi: Record<RepairTicketStatus, string> = {
  NEU: "neu", UEBERNOMMEN: "uebernommen", IN_ARBEIT: "in_arbeit", WARTET: "wartet", ERLEDIGT: "erledigt",
};
const statusDb: Record<string, RepairTicketStatus> = {
  neu: "NEU", uebernommen: "UEBERNOMMEN", in_arbeit: "IN_ARBEIT", wartet: "WARTET", erledigt: "ERLEDIGT",
};

function isUuid(value: string) {
  return uuid.test(value);
}

function visibilityOf(value: string): RepairVisibility {
  return value === "dept" || value === "DEPARTMENT" ? "DEPARTMENT" : "ALL";
}

function kindOf(value: string): RepairKind {
  return value === "template" || value === "TEMPLATE" ? "TEMPLATE" : "REPAIR";
}

function nameOf(row: { firstName: string; lastName: string } | null) {
  return row ? `${row.firstName} ${row.lastName}`.trim() : "";
}

function dateOf(value: Date, locale: string) {
  return value.toLocaleDateString(locale === "de" ? "de-DE" : locale === "it" ? "it-IT" : "en-GB");
}

export function visibleWhere(actor: { id: string; hotel_tenant_id: string; departmentId: string | null }, kind: RepairKind): Prisma.RepairWhereInput {
  if (kind === "TEMPLATE") {
    return { hotelTenantId: actor.hotel_tenant_id, kind: "TEMPLATE" };
  }
  return {
    hotelTenantId: actor.hotel_tenant_id,
    kind: "REPAIR",
    OR: [
      { visibility: "ALL" },
      { createdById: actor.id },
      { assigneeId: actor.id },
      ...(actor.departmentId
        ? [{ visibility: "DEPARTMENT" as const, departments: { some: { departmentId: actor.departmentId } } }]
        : []),
    ],
  };
}

export function toPublicRepair(row: Row, locale: string) {
  return {
    id: row.id,
    kind: row.kind === "TEMPLATE" ? "template" : "repair",
    title: pickLocalized(row.title, row.titleDe, row.titleIt, locale),
    location: pickLocalized(row.location, row.locationDe, row.locationIt, locale),
    locationKey: row.locationKey,
    desc: pickLocalized(row.description, row.descriptionDe, row.descriptionIt, locale),
    tags: locale === "de" ? row.tagsDe : locale === "it" ? row.tagsIt : row.tags,
    creator: nameOf(row.createdBy),
    creatorId: row.createdById,
    date: dateOf(row.createdAt, locale),
    status: statusUi[row.status],
    assignee: nameOf(row.assignee),
    assigneeId: row.assigneeId || "",
    visibility: row.visibility === "DEPARTMENT" ? "dept" : "alle",
    depts: row.departments.map((item) => item.departmentId),
    origLang: row.originalLocale,
    comments: row.comments.map((item) => ({
      text: pickLocalized(item.text, item.textDe, item.textIt, locale),
      author: nameOf(item.author),
      date: dateOf(item.createdAt, locale),
    })),
  };
}

async function validDepartmentIds(hotelTenantId: string, ids: string[]) {
  if (!ids.length) return [] as string[];
  const rows = await prisma.department.findMany({
    where: { hotelTenantId, isDeleted: false, isActive: true, id: { in: ids.filter(isUuid) } },
    select: { id: true },
  });
  return rows.map((row) => row.id);
}

async function validUserId(hotelTenantId: string, id: string) {
  if (!isUuid(id)) return null;
  const row = await prisma.user.findFirst({
    where: { hotelTenantId, id, isActive: true, isDeleted: false },
    select: { id: true },
  });
  return row?.id ?? null;
}

async function recipientIds(tx: Prisma.TransactionClient, input: {
  hotelTenantId: string;
  actorId: string;
  visibility: RepairVisibility;
  departmentIds: string[];
  assigneeId: string | null;
}) {
  const where = input.visibility === "ALL"
    ? { hotelTenantId: input.hotelTenantId, isActive: true, isDeleted: false }
    : { hotelTenantId: input.hotelTenantId, isActive: true, isDeleted: false, departmentId: { in: input.departmentIds } };
  const users = input.visibility === "DEPARTMENT" && !input.departmentIds.length
    ? []
    : await tx.user.findMany({ where, select: { id: true } });
  const ids = new Set(users.map((item) => item.id));
  if (input.assigneeId) ids.add(input.assigneeId);
  ids.delete(input.actorId);
  return [...ids];
}

async function repairRoleUserIds(tx: Prisma.TransactionClient, hotelTenantId: string) {
  const [users, permissions] = await Promise.all([
    tx.user.findMany({
      where: { hotelTenantId, isActive: true, isDeleted: false },
      select: { id: true, role: true },
    }),
    tx.roleModulePermission.findMany({
      where: { hotelTenantId, moduleKey: "repairs" },
      select: { role: true, canView: true },
    }),
  ]);
  const override = new Map(permissions.map((item) => [item.role, item.canView]));
  return users.filter((user) => {
    if (user.role === "ADMIN") return true;
    if (override.has(user.role)) return Boolean(override.get(user.role));
    return user.role === "EMPLOYEE" || user.role === "TEAM_LEAD" || user.role === "MANAGEMENT";
  }).map((user) => user.id);
}

async function notifyRepair(
  tx: Prisma.TransactionClient,
  input: {
    actor: RepairsActor;
    repairId: string;
    kind: RepairKind;
    visibility: RepairVisibility;
    departmentIds: string[];
    assigneeId: string | null;
    title: string;
    event: "create" | "update" | "assign" | "comment";
  },
) {
  if (input.kind === "TEMPLATE") return;
  const ids = new Set(await recipientIds(tx, {
    hotelTenantId: input.actor.hotel_tenant_id,
    actorId: input.actor.id,
    visibility: input.visibility,
    departmentIds: input.departmentIds,
    assigneeId: input.assigneeId,
  }));
  if (input.event === "comment") {
    for (const userId of await repairRoleUserIds(tx, input.actor.hotel_tenant_id)) {
      if (userId !== input.actor.id) ids.add(userId);
    }
  }
  if (!ids.size) return;
  const author = `${input.actor.firstName} ${input.actor.lastName}`.trim();
  const assignedOnly = input.event === "assign" && input.assigneeId ? [input.assigneeId].filter((id) => id !== input.actor.id) : null;
  const uniqueIds = [...ids];
  const targets = assignedOnly ?? (input.event === "create" && input.assigneeId ? uniqueIds.filter((id) => id !== input.assigneeId) : uniqueIds);
  if (!targets.length) return;
  const text = input.event === "assign"
    ? {
      en: { title: "Repair assigned to you", body: `${author} assigned you “${input.title}”.` },
      de: { title: "Reparatur dir zugewiesen", body: `${author} hat dir „${input.title}“ zugewiesen.` },
      it: { title: "Riparazione assegnata a te", body: `${author} ti ha assegnato “${input.title}”.` },
    }
    : input.event === "create"
      ? {
        en: { title: "New repair", body: `${author} reported “${input.title}”.` },
        de: { title: "Neue Reparatur", body: `${author} hat „${input.title}“ gemeldet.` },
        it: { title: "Nuova riparazione", body: `${author} ha segnalato “${input.title}”.` },
      }
      : input.event === "comment"
        ? {
          en: { title: "New repair comment", body: `${author} commented on “${input.title}”.` },
          de: { title: "Neuer Reparatur-Kommentar", body: `${author} hat „${input.title}“ kommentiert.` },
          it: { title: "Nuovo commento alla riparazione", body: `${author} ha commentato “${input.title}”.` },
        }
        : {
          en: { title: "Repair updated", body: `${author} updated “${input.title}”.` },
          de: { title: "Reparatur aktualisiert", body: `${author} hat „${input.title}“ aktualisiert.` },
          it: { title: "Riparazione aggiornata", body: `${author} ha aggiornato “${input.title}”.` },
        };
  await tx.notification.createMany({
    skipDuplicates: true,
    data: targets.map((recipientId) => ({
      hotelTenantId: input.actor.hotel_tenant_id,
      recipientId,
      moduleKey: "repairs",
      eventKey: `repairs:${input.repairId}:${input.event}:${randomUUID()}`,
      icon: "repairs",
      destination: `/repairs/${input.repairId}`,
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

export async function averageResponseDays(actor: RepairsActor) {
  const rows = await prisma.repair.findMany({
    where: visibleWhere(actor, "REPAIR"),
    select: { id: true, createdAt: true, status: true, updatedAt: true },
  });
  const progressed = rows.filter((row) => row.status !== "NEU");
  if (!progressed.length) return null;
  const logs = await prisma.auditLog.findMany({
    where: {
      hotelTenantId: actor.hotel_tenant_id,
      entityType: "REPAIR",
      action: "STATUS_CHANGE",
      entityId: { in: progressed.map((row) => row.id) },
    },
    orderBy: { createdAt: "asc" },
    select: { entityId: true, createdAt: true },
  });
  const firstChange = new Map<string, Date>();
  for (const log of logs) {
    if (log.entityId && !firstChange.has(log.entityId)) firstChange.set(log.entityId, log.createdAt);
  }
  const days: number[] = [];
  for (const row of progressed) {
    const respondedAt = firstChange.get(row.id) ?? (row.status === "ERLEDIGT" ? row.updatedAt : null);
    if (!respondedAt) continue;
    const value = (respondedAt.getTime() - row.createdAt.getTime()) / 86_400_000;
    if (value >= 0) days.push(value);
  }
  if (!days.length) return null;
  return Math.round((days.reduce((sum, item) => sum + item, 0) / days.length) * 10) / 10;
}

export async function listRepairs(actor: RepairsActor, locale: string, kind: RepairKind) {
  const rows = await prisma.repair.findMany({
    where: visibleWhere(actor, kind),
    include,
    orderBy: { createdAt: "desc" },
  });
  return rows.map((row) => toPublicRepair(row, locale));
}

export async function getRepair(actor: RepairsActor, id: string, locale: string) {
  if (!isUuid(id)) return null;
  const row = await prisma.repair.findFirst({
    where: { id, ...visibleWhere(actor, "REPAIR") },
    include,
  });
  return row ? toPublicRepair(row, locale) : null;
}

export async function openRepairCount(actor: { id: string; hotel_tenant_id: string; departmentId: string | null }) {
  return prisma.repair.count({
    where: { ...visibleWhere(actor, "REPAIR"), status: { not: "ERLEDIGT" } },
  });
}

export async function createRepair(actor: RepairsActor, body: Record<string, unknown>, locale: string) {
  if (!actor.canManage) return { error: "FORBIDDEN" as const };
  const title = String(body.title ?? "").trim().slice(0, 180);
  const description = String(body.description ?? "").trim().slice(0, 20000);
  const locationKey = String(body.locationKey ?? body.location ?? "").trim().slice(0, 180);
  const locationLabel = String(body.locationLabel ?? locationKey).trim().slice(0, 180);
  if (!title) return { error: "TITLE_REQUIRED" as const };
  if (!locationKey) return { error: "LOCATION_REQUIRED" as const };
  const kind = kindOf(String(body.kind ?? "repair"));
  const visibility = kind === "TEMPLATE" ? "ALL" : visibilityOf(String(body.visibility ?? "alle"));
  const tags = Array.isArray(body.tags) ? body.tags.map((item) => String(item).trim()).filter(Boolean).slice(0, 40) : [];
  const departmentIds = visibility === "DEPARTMENT" ? await validDepartmentIds(actor.hotel_tenant_id, Array.isArray(body.departmentIds) ? body.departmentIds.map(String) : []) : [];
  const assigneeId = kind === "TEMPLATE" ? null : await validUserId(actor.hotel_tenant_id, String(body.assigneeId ?? ""));
  const locales = await translateRepairFields(actor.hotel_tenant_id, locale, { title, description, locationKey, locationLabel, tags });
  const id = randomUUID();
  const created = await prisma.$transaction(async (tx) => {
    await tx.repair.create({
      data: {
        id,
        hotelTenantId: actor.hotel_tenant_id,
        createdById: actor.id,
        assigneeId,
        kind,
        status: "NEU",
        visibility,
        locationKey,
        location: locales.location.en,
        locationDe: locales.location.de,
        locationIt: locales.location.it,
        title: locales.title.en,
        titleDe: locales.title.de,
        titleIt: locales.title.it,
        description: locales.description.en,
        descriptionDe: locales.description.de,
        descriptionIt: locales.description.it,
        tags: locales.tags.en,
        tagsDe: locales.tags.de,
        tagsIt: locales.tags.it,
        originalLocale: locale === "de" || locale === "it" ? locale : "en",
      },
    });
    if (departmentIds.length) {
      await tx.repairShareDepartment.createMany({ data: departmentIds.map((departmentId) => ({ repairId: id, departmentId })) });
    }
    await recordAuditLog(tx, {
      hotelTenantId: actor.hotel_tenant_id,
      actorId: actor.id,
      action: "CREATE",
      entityType: kind === "TEMPLATE" ? "REPAIR_TEMPLATE" : "REPAIR",
      entityId: id,
      changes: { after: { title: locales.title.en } },
    });
    await notifyRepair(tx, {
      actor, repairId: id, kind, visibility, departmentIds, assigneeId, title: locales.title.en, event: "create",
    });
    if (assigneeId) {
      await notifyRepair(tx, {
        actor, repairId: id, kind, visibility, departmentIds, assigneeId, title: locales.title.en, event: "assign",
      });
    }
    return tx.repair.findFirstOrThrow({ where: { id }, include });
  }, { timeout: 40000 });
  return { repair: toPublicRepair(created, locale) };
}

export async function updateRepair(actor: RepairsActor, id: string, body: Record<string, unknown>, locale: string) {
  if (!actor.canManage) return { error: "FORBIDDEN" as const };
  if (!isUuid(id)) return { error: "NOT_FOUND" as const };
  const existing = await prisma.repair.findFirst({ where: { id, ...visibleWhere(actor, "REPAIR") }, include });
  if (!existing) return { error: "NOT_FOUND" as const };
  const title = String(body.title ?? "").trim().slice(0, 180);
  const description = String(body.description ?? "").trim().slice(0, 20000);
  const locationKey = String(body.locationKey ?? body.location ?? "").trim().slice(0, 180);
  const locationLabel = String(body.locationLabel ?? locationKey).trim().slice(0, 180);
  if (!title) return { error: "TITLE_REQUIRED" as const };
  if (!locationKey) return { error: "LOCATION_REQUIRED" as const };
  const visibility = visibilityOf(String(body.visibility ?? "alle"));
  const tags = Array.isArray(body.tags) ? body.tags.map((item) => String(item).trim()).filter(Boolean).slice(0, 40) : [];
  const departmentIds = visibility === "DEPARTMENT" ? await validDepartmentIds(actor.hotel_tenant_id, Array.isArray(body.departmentIds) ? body.departmentIds.map(String) : []) : [];
  const assigneeId = await validUserId(actor.hotel_tenant_id, String(body.assigneeId ?? ""));
  const locales = await translateRepairFields(actor.hotel_tenant_id, locale, { title, description, locationKey, locationLabel, tags });
  const updated = await prisma.$transaction(async (tx) => {
    await tx.repair.update({
      where: { id },
      data: {
        assigneeId,
        visibility,
        locationKey,
        location: locales.location.en,
        locationDe: locales.location.de,
        locationIt: locales.location.it,
        title: locales.title.en,
        titleDe: locales.title.de,
        titleIt: locales.title.it,
        description: locales.description.en,
        descriptionDe: locales.description.de,
        descriptionIt: locales.description.it,
        tags: locales.tags.en,
        tagsDe: locales.tags.de,
        tagsIt: locales.tags.it,
        originalLocale: locale === "de" || locale === "it" ? locale : "en",
      },
    });
    await tx.repairShareDepartment.deleteMany({ where: { repairId: id } });
    if (departmentIds.length) {
      await tx.repairShareDepartment.createMany({ data: departmentIds.map((departmentId) => ({ repairId: id, departmentId })) });
    }
    await recordAuditLog(tx, {
      hotelTenantId: actor.hotel_tenant_id,
      actorId: actor.id,
      action: "UPDATE",
      entityType: "REPAIR",
      entityId: id,
      changes: { before: { title: existing.title }, after: { title: locales.title.en } },
    });
    await notifyRepair(tx, {
      actor, repairId: id, kind: "REPAIR", visibility, departmentIds, assigneeId, title: locales.title.en, event: "update",
    });
    if (assigneeId && assigneeId !== existing.assigneeId) {
      await notifyRepair(tx, {
        actor, repairId: id, kind: "REPAIR", visibility, departmentIds, assigneeId, title: locales.title.en, event: "assign",
      });
    }
    return tx.repair.findFirstOrThrow({ where: { id }, include });
  }, { timeout: 40000 });
  return { repair: toPublicRepair(updated, locale) };
}

export async function updateRepairStatus(actor: RepairsActor, id: string, status: string, locale: string) {
  const next = statusDb[status];
  if (!next || !isUuid(id)) return { error: "INVALID" as const };
  const existing = await prisma.repair.findFirst({ where: { id, ...visibleWhere(actor, "REPAIR") } });
  if (!existing) return { error: "NOT_FOUND" as const };
  const row = await prisma.$transaction(async (tx) => {
    const updated = await tx.repair.update({ where: { id }, data: { status: next }, include });
    await recordAuditLog(tx, {
      hotelTenantId: actor.hotel_tenant_id,
      actorId: actor.id,
      action: "STATUS_CHANGE",
      entityType: "REPAIR",
      entityId: id,
      changes: { before: { title: existing.title, status: existing.status }, after: { title: existing.title, status: next } },
    });
    return updated;
  });
  return { repair: toPublicRepair(row, locale) };
}

export async function updateRepairAssignee(actor: RepairsActor, id: string, assigneeIdRaw: string, locale: string) {
  if (!isUuid(id)) return { error: "NOT_FOUND" as const };
  const existing = await prisma.repair.findFirst({ where: { id, ...visibleWhere(actor, "REPAIR") }, include });
  if (!existing) return { error: "NOT_FOUND" as const };
  const assigneeId = await validUserId(actor.hotel_tenant_id, assigneeIdRaw);
  const row = await prisma.$transaction(async (tx) => {
    const nextStatus = existing.status === "NEU" && assigneeId ? "UEBERNOMMEN" : existing.status;
    const updated = await tx.repair.update({
      where: { id },
      data: {
        assigneeId,
        status: nextStatus,
      },
      include,
    });
    await recordAuditLog(tx, {
      hotelTenantId: actor.hotel_tenant_id,
      actorId: actor.id,
      action: nextStatus !== existing.status ? "STATUS_CHANGE" : "UPDATE",
      entityType: "REPAIR",
      entityId: id,
      changes: { before: { title: existing.title, assigneeId: existing.assigneeId, status: existing.status }, after: { title: existing.title, assigneeId, status: nextStatus } },
    });
    if (assigneeId && assigneeId !== existing.assigneeId) {
      await notifyRepair(tx, {
        actor,
        repairId: id,
        kind: "REPAIR",
        visibility: existing.visibility,
        departmentIds: existing.departments.map((item) => item.departmentId),
        assigneeId,
        title: existing.title,
        event: "assign",
      });
    }
    return updated;
  });
  return { repair: toPublicRepair(row, locale) };
}

export async function addRepairComment(actor: RepairsActor, id: string, text: string, locale: string) {
  const value = text.trim().slice(0, 4000);
  if (!value || !isUuid(id)) return { error: "INVALID" as const };
  const existing = await prisma.repair.findFirst({
    where: { id, ...visibleWhere(actor, "REPAIR") },
    include: { departments: { select: { departmentId: true } } },
  });
  if (!existing) return { error: "NOT_FOUND" as const };
  const row = await prisma.$transaction(async (tx) => {
    await tx.repairComment.create({
      data: { id: randomUUID(), repairId: id, authorId: actor.id, text: value, textDe: value, textIt: value },
    });
    await recordAuditLog(tx, {
      hotelTenantId: actor.hotel_tenant_id,
      actorId: actor.id,
      action: "UPDATE",
      entityType: "REPAIR",
      entityId: id,
      changes: { after: { title: existing.title, comment: true } },
    });
    await notifyRepair(tx, {
      actor,
      repairId: id,
      kind: "REPAIR",
      visibility: existing.visibility,
      departmentIds: existing.departments.map((item) => item.departmentId),
      assigneeId: existing.assigneeId,
      title: existing.title,
      event: "comment",
    });
    return tx.repair.findFirstOrThrow({ where: { id }, include });
  });
  return { repair: toPublicRepair(row, locale) };
}
