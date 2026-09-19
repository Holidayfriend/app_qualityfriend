import "server-only";

import { randomUUID } from "node:crypto";
import type { Prisma, RepairKind, RepairTicketStatus, RepairVisibility } from "../../app/generated/prisma/client";
import { recordAuditLog } from "../audit/audit-service";
import { pickLocalized } from "../recruiting/job-fields";
import { prisma } from "../prisma";
import type { RepairsActor } from "./access";
import { copyRepairStoredFile, deleteRepairFile, isRepairUpload, kindFor, saveRepairFile } from "./storage";
import { translateRepairFields } from "./translate";

export const MAX_REPAIR_FILES = 10;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const include = {
  createdBy: { select: { firstName: true, lastName: true } },
  completedBy: { select: { firstName: true, lastName: true } },
  assignee: { select: { id: true, firstName: true, lastName: true } },
  departments: { select: { departmentId: true } },
  attachments: { orderBy: { createdAt: "asc" as const } },
  comments: {
    orderBy: { createdAt: "asc" as const },
    include: { author: { select: { firstName: true, lastName: true } } },
  },
};

type Row = Prisma.RepairGetPayload<{ include: typeof include }>;
const statusUi: Record<RepairTicketStatus, string> = {
  NEU: "neu", UEBERNOMMEN: "uebernommen", IN_ARBEIT: "in_arbeit", WARTET: "wartet", ERLEDIGT: "erledigt", DRAFT: "draft",
};
const statusDb: Record<string, RepairTicketStatus> = {
  neu: "NEU", uebernommen: "UEBERNOMMEN", in_arbeit: "IN_ARBEIT", wartet: "WARTET", erledigt: "ERLEDIGT", draft: "DRAFT",
};

export function isUuid(value: string) {
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

function dateTimeOf(value: Date, locale: string) {
  return value.toLocaleString(locale === "de" ? "de-DE" : locale === "it" ? "it-IT" : "en-GB", { dateStyle: "short", timeStyle: "short" });
}

export function visibleWhere(actor: { id: string; hotel_tenant_id: string; departmentId: string | null; canManage?: boolean }, kind: RepairKind): Prisma.RepairWhereInput {
  if (kind === "TEMPLATE") {
    return { hotelTenantId: actor.hotel_tenant_id, kind: "TEMPLATE" };
  }
  const published: Prisma.RepairWhereInput[] = [
    { visibility: "ALL" },
    { createdById: actor.id },
    { assigneeId: actor.id },
    ...(actor.departmentId
      ? [{ visibility: "DEPARTMENT" as const, departments: { some: { departmentId: actor.departmentId } } }]
      : []),
  ];
  return {
    hotelTenantId: actor.hotel_tenant_id,
    kind: "REPAIR",
    OR: [
      { AND: [{ status: { not: "DRAFT" } }, { OR: published }] },
      ...(actor.canManage ? [{ status: "DRAFT" as const }] : []),
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
    completedAt: row.completedAt ? dateTimeOf(row.completedAt, locale) : "",
    completedBy: nameOf(row.completedBy),
    attachments: row.attachments.map((file) => ({
      id: file.id,
      name: file.fileName,
      type: kindFor(file.mimeType, file.fileName),
      url: `/api/repairs/${row.id}/attachments/${file.id}`,
    })),
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

function parseJsonList(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || !value.trim()) return [] as string[];
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];
    return [...new Set(parsed.map((item) => String(item).trim()).filter(Boolean))];
  } catch {
    return value.split(",").map((item) => item.trim()).filter(Boolean);
  }
}

function formValue(form: FormData, key: string) {
  return String(form.get(key) ?? "");
}

async function saveUploads(files: File[]) {
  const saved: { fileName: string; storageKey: string; mimeType: string; byteSize: number }[] = [];
  for (const file of files) {
    const stored = await saveRepairFile(file);
    if (stored) saved.push({ fileName: stored.originalName, storageKey: stored.storageKey, mimeType: stored.mimeType, byteSize: stored.byteSize });
  }
  return saved;
}

async function copyAttachments(hotelTenantId: string, ids: string[]) {
  if (!ids.length) return [] as { fileName: string; storageKey: string; mimeType: string; byteSize: number }[];
  const rows = await prisma.repairAttachment.findMany({
    where: { id: { in: ids }, repair: { hotelTenantId } },
  });
  const copied: { fileName: string; storageKey: string; mimeType: string; byteSize: number }[] = [];
  for (const file of rows) {
    const storageKey = await copyRepairStoredFile(file.storageKey);
    if (storageKey) copied.push({ fileName: file.fileName, storageKey, mimeType: file.mimeType, byteSize: file.byteSize });
  }
  return copied;
}

async function collectAttachments(form: FormData, hotelTenantId: string, existing?: { id: string; attachments: { id: string; storageKey: string }[] }) {
  const keepIds = parseJsonList(form.get("keepAttachmentIds")).filter(isUuid);
  const kept = existing?.attachments.filter((file) => keepIds.includes(file.id)) ?? [];
  const copyIds = keepIds.filter((id) => !kept.some((file) => file.id === id));
  const copied = await copyAttachments(hotelTenantId, copyIds);
  const remaining = MAX_REPAIR_FILES - kept.length - copied.length;
  const saved = await saveUploads(form.getAll("files").filter(isRepairUpload).slice(0, Math.max(0, remaining)));
  const removed = existing?.attachments.filter((file) => !keepIds.includes(file.id)) ?? [];
  return { kept, copied, saved, removed };
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
    event: "create" | "update" | "assign" | "comment" | "status";
    status?: RepairTicketStatus;
    createdById?: string;
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
  if (input.createdById) ids.add(input.createdById);
  ids.delete(input.actor.id);
  if (input.event === "comment" || input.event === "status") {
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
  const statusLabel = {
    NEU: { en: "New", de: "Neu", it: "Nuova" },
    UEBERNOMMEN: { en: "Accepted", de: "Übernommen", it: "Presa in carico" },
    IN_ARBEIT: { en: "In progress", de: "In Arbeit", it: "In lavorazione" },
    WARTET: { en: "Waiting", de: "Wartet", it: "In attesa" },
    ERLEDIGT: { en: "Done", de: "Erledigt", it: "Completata" },
  } as const;
  const nextStatus = input.status && statusLabel[input.status];
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
        : input.event === "status" && input.status === "ERLEDIGT"
          ? {
            en: { title: "Repair completed", body: `${author} marked “${input.title}” as completed.` },
            de: { title: "Reparatur erledigt", body: `${author} hat „${input.title}“ als erledigt markiert.` },
            it: { title: "Riparazione completata", body: `${author} ha segnato “${input.title}” come completata.` },
          }
          : input.event === "status" && nextStatus
            ? {
              en: { title: "Repair status updated", body: `${author} marked “${input.title}” as ${nextStatus.en}.` },
              de: { title: "Reparaturstatus geändert", body: `${author} hat „${input.title}“ als ${nextStatus.de} markiert.` },
              it: { title: "Stato riparazione aggiornato", body: `${author} ha segnato “${input.title}” come ${nextStatus.it}.` },
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
  const progressed = rows.filter((row) => row.status !== "NEU" && row.status !== "DRAFT");
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
    where: {
      id,
      OR: [
        visibleWhere(actor, "REPAIR"),
        ...(actor.canManage ? [{ hotelTenantId: actor.hotel_tenant_id, kind: "TEMPLATE" as const }] : []),
      ],
    },
    include,
  });
  return row ? toPublicRepair(row, locale) : null;
}

export async function openRepairCount(actor: { id: string; hotel_tenant_id: string; departmentId: string | null }) {
  return prisma.repair.count({
    where: { ...visibleWhere(actor, "REPAIR"), status: { notIn: ["ERLEDIGT", "DRAFT"] } },
  });
}

export async function createRepair(actor: RepairsActor, form: FormData, locale: string) {
  if (!actor.canManage) return { error: "FORBIDDEN" as const };
  const title = formValue(form, "title").trim().slice(0, 180);
  const description = formValue(form, "description").trim().slice(0, 20000);
  const locationKey = (formValue(form, "locationKey") || formValue(form, "location")).trim().slice(0, 180);
  const locationLabel = (formValue(form, "locationLabel") || locationKey).trim().slice(0, 180);
  if (!title) return { error: "TITLE_REQUIRED" as const };
  if (!locationKey) return { error: "LOCATION_REQUIRED" as const };
  const kind = kindOf(formValue(form, "kind") || "repair");
  const draft = formValue(form, "status") === "draft";
  const status: RepairTicketStatus = kind === "TEMPLATE" ? "NEU" : draft ? "DRAFT" : "NEU";
  const visibility = kind === "TEMPLATE" ? "ALL" : visibilityOf(formValue(form, "visibility") || "alle");
  const tags = parseJsonList(form.get("tags")).slice(0, 40);
  const departmentIds = visibility === "DEPARTMENT" ? await validDepartmentIds(actor.hotel_tenant_id, parseJsonList(form.get("departmentIds"))) : [];
  const assigneeId = kind === "TEMPLATE" ? null : await validUserId(actor.hotel_tenant_id, formValue(form, "assigneeId"));
  const files = await collectAttachments(form, actor.hotel_tenant_id);
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
        status,
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
    const incoming = [...files.copied, ...files.saved];
    if (incoming.length) {
      await tx.repairAttachment.createMany({ data: incoming.map((file) => ({ id: randomUUID(), repairId: id, ...file })) });
    }
    await recordAuditLog(tx, {
      hotelTenantId: actor.hotel_tenant_id,
      actorId: actor.id,
      action: "CREATE",
      entityType: kind === "TEMPLATE" ? "REPAIR_TEMPLATE" : "REPAIR",
      entityId: id,
      changes: { after: locales.title },
    });
    if (kind === "REPAIR" && status !== "DRAFT") {
      await notifyRepair(tx, {
        actor, repairId: id, kind, visibility, departmentIds, assigneeId, title: locales.title.en, event: "create",
      });
      if (assigneeId) {
        await notifyRepair(tx, {
          actor, repairId: id, kind, visibility, departmentIds, assigneeId, title: locales.title.en, event: "assign",
        });
      }
    }
    return tx.repair.findFirstOrThrow({ where: { id }, include });
  }, { timeout: 40000 });
  return { repair: toPublicRepair(created, locale) };
}

export async function updateRepair(actor: RepairsActor, id: string, form: FormData, locale: string) {
  if (!actor.canManage) return { error: "FORBIDDEN" as const };
  if (!isUuid(id)) return { error: "NOT_FOUND" as const };
  const existing = await prisma.repair.findFirst({ where: { id, ...visibleWhere(actor, "REPAIR") }, include });
  if (!existing) return { error: "NOT_FOUND" as const };
  const title = formValue(form, "title").trim().slice(0, 180);
  const description = formValue(form, "description").trim().slice(0, 20000);
  const locationKey = (formValue(form, "locationKey") || formValue(form, "location")).trim().slice(0, 180);
  const locationLabel = (formValue(form, "locationLabel") || locationKey).trim().slice(0, 180);
  if (!title) return { error: "TITLE_REQUIRED" as const };
  if (!locationKey) return { error: "LOCATION_REQUIRED" as const };
  const draft = formValue(form, "status") === "draft";
  const status: RepairTicketStatus = draft ? "DRAFT" : existing.status === "DRAFT" ? "NEU" : existing.status;
  const visibility = visibilityOf(formValue(form, "visibility") || "alle");
  const tags = parseJsonList(form.get("tags")).slice(0, 40);
  const departmentIds = visibility === "DEPARTMENT" ? await validDepartmentIds(actor.hotel_tenant_id, parseJsonList(form.get("departmentIds"))) : [];
  const assigneeId = await validUserId(actor.hotel_tenant_id, formValue(form, "assigneeId"));
  const files = await collectAttachments(form, actor.hotel_tenant_id, existing);
  const locales = await translateRepairFields(actor.hotel_tenant_id, locale, { title, description, locationKey, locationLabel, tags });
  const wasDraft = existing.status === "DRAFT";
  const updated = await prisma.$transaction(async (tx) => {
    await tx.repair.update({
      where: { id },
      data: {
        assigneeId,
        status,
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
    if (files.removed.length) {
      await tx.repairAttachment.deleteMany({ where: { repairId: id, id: { in: files.removed.map((file) => file.id) } } });
    }
    const incoming = [...files.copied, ...files.saved];
    if (incoming.length) {
      await tx.repairAttachment.createMany({ data: incoming.map((file) => ({ id: randomUUID(), repairId: id, ...file })) });
    }
    await recordAuditLog(tx, {
      hotelTenantId: actor.hotel_tenant_id,
      actorId: actor.id,
      action: "UPDATE",
      entityType: "REPAIR",
      entityId: id,
      changes: { before: { en: existing.title, de: existing.titleDe, it: existing.titleIt }, after: locales.title },
    });
    if (status !== "DRAFT") {
      if (wasDraft) {
        await notifyRepair(tx, {
          actor, repairId: id, kind: "REPAIR", visibility, departmentIds, assigneeId, title: locales.title.en, event: "create",
        });
      } else {
        await notifyRepair(tx, {
          actor, repairId: id, kind: "REPAIR", visibility, departmentIds, assigneeId, title: locales.title.en, event: "update",
        });
      }
      if (assigneeId && assigneeId !== existing.assigneeId) {
        await notifyRepair(tx, {
          actor, repairId: id, kind: "REPAIR", visibility, departmentIds, assigneeId, title: locales.title.en, event: "assign",
        });
      }
    }
    return tx.repair.findFirstOrThrow({ where: { id }, include });
  }, { timeout: 40000 });
  for (const file of files.removed) await deleteRepairFile(file.storageKey);
  return { repair: toPublicRepair(updated, locale) };
}

export async function updateRepairStatus(actor: RepairsActor, id: string, status: string, locale: string) {
  const next = statusDb[status];
  if (!next || next === "DRAFT" || !isUuid(id)) return { error: "INVALID" as const };
  const existing = await prisma.repair.findFirst({
    where: { id, ...visibleWhere(actor, "REPAIR") },
    include: { departments: { select: { departmentId: true } } },
  });
  if (!existing || existing.status === "DRAFT") return { error: "NOT_FOUND" as const };
  const row = await prisma.$transaction(async (tx) => {
    const updated = await tx.repair.update({
      where: { id },
      data: {
        status: next,
        completedAt: next === "ERLEDIGT" ? (existing.status === "ERLEDIGT" ? existing.completedAt : new Date()) : null,
        completedById: next === "ERLEDIGT" ? (existing.status === "ERLEDIGT" ? existing.completedById : actor.id) : null,
      },
      include,
    });
    await recordAuditLog(tx, {
      hotelTenantId: actor.hotel_tenant_id,
      actorId: actor.id,
      action: "STATUS_CHANGE",
      entityType: "REPAIR",
      entityId: id,
      changes: { before: { title: existing.title, status: existing.status }, after: { title: existing.title, status: next } },
    });
    if (next !== existing.status) {
      await notifyRepair(tx, {
        actor,
        repairId: id,
        kind: "REPAIR",
        visibility: existing.visibility,
        departmentIds: existing.departments.map((item) => item.departmentId),
        assigneeId: existing.assigneeId,
        createdById: existing.createdById,
        title: existing.title,
        event: "status",
        status: next,
      });
    }
    return updated;
  });
  return { repair: toPublicRepair(row, locale) };
}

export async function updateRepairAssignee(actor: RepairsActor, id: string, assigneeIdRaw: string, locale: string) {
  if (!isUuid(id)) return { error: "NOT_FOUND" as const };
  const existing = await prisma.repair.findFirst({ where: { id, ...visibleWhere(actor, "REPAIR") }, include });
  if (!existing || existing.status === "DRAFT") return { error: "NOT_FOUND" as const };
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
  if (!existing || existing.status === "DRAFT") return { error: "NOT_FOUND" as const };
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
