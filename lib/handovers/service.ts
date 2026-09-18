import "server-only";

import { randomUUID } from "node:crypto";
import type { Prisma, HandoverKind, HandoverStatus, HandoverVisibility } from "../../app/generated/prisma/client";
import { recordAuditLog } from "../audit/audit-service";
import { pickLocalized } from "../recruiting/job-fields";
import { prisma } from "../prisma";
import type { HandoversActor } from "./access";
import { translateHandoverFields } from "./translate";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const include = {
  createdBy: { select: { firstName: true, lastName: true } },
  completedBy: { select: { firstName: true, lastName: true } },
  departments: { select: { departmentId: true } },
};

type Row = Prisma.HandoverGetPayload<{ include: typeof include }>;
const statusUi: Record<HandoverStatus, string> = { OPEN: "offen", DONE: "erledigt", DRAFT: "draft" };
const statusDb: Record<string, HandoverStatus> = { offen: "OPEN", open: "OPEN", erledigt: "DONE", done: "DONE", draft: "DRAFT" };

function isUuid(value: string) {
  return uuid.test(value);
}

function visibilityOf(value: string): HandoverVisibility {
  if (value === "dept" || value === "DEPARTMENT") return "DEPARTMENT";
  if (value === "privat" || value === "private" || value === "PRIVATE") return "PRIVATE";
  return "ALL";
}

function kindOf(value: string): HandoverKind {
  return value === "template" || value === "TEMPLATE" ? "TEMPLATE" : "HANDOVER";
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

export function visibleWhere(actor: HandoversActor, kind: HandoverKind): Prisma.HandoverWhereInput {
  if (kind === "TEMPLATE") return { hotelTenantId: actor.hotel_tenant_id, kind: "TEMPLATE" };
  const published: Prisma.HandoverWhereInput[] = [
    { visibility: "ALL" },
    { visibility: "PRIVATE", createdById: actor.id },
    ...(actor.departmentId ? [{ visibility: "DEPARTMENT" as const, departments: { some: { departmentId: actor.departmentId } } }] : []),
  ];
  return {
    hotelTenantId: actor.hotel_tenant_id,
    kind: "HANDOVER",
    OR: [
      { createdById: actor.id },
      { AND: [{ status: { not: "DRAFT" } }, { OR: published }] },
      ...(actor.canManage ? [{ status: "DRAFT" as const }] : []),
    ],
  };
}

export function toPublicHandover(row: Row, locale: string) {
  return {
    id: row.id,
    kind: row.kind === "TEMPLATE" ? "template" : "handover",
    title: pickLocalized(row.title, row.titleDe, row.titleIt, locale),
    desc: pickLocalized(row.description, row.descriptionDe, row.descriptionIt, locale),
    tags: locale === "de" ? row.tagsDe : locale === "it" ? row.tagsIt : row.tags,
    creator: nameOf(row.createdBy),
    creatorId: row.createdById,
    date: dateOf(row.createdAt, locale),
    status: statusUi[row.status],
    pinned: row.pinned,
    visibility: row.visibility === "DEPARTMENT" ? "dept" : row.visibility === "PRIVATE" ? "privat" : "alle",
    depts: row.departments.map((item) => item.departmentId),
    origLang: row.originalLocale,
    completedAt: row.completedAt ? dateTimeOf(row.completedAt, locale) : "",
    completedBy: nameOf(row.completedBy),
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

async function notifyHandover(tx: Prisma.TransactionClient, input: {
  actor: HandoversActor;
  handoverId: string;
  visibility: HandoverVisibility;
  departmentIds: string[];
  title: string;
}) {
  if (input.visibility === "PRIVATE") return;
  const where = input.visibility === "ALL"
    ? { hotelTenantId: input.actor.hotel_tenant_id, isActive: true, isDeleted: false }
    : { hotelTenantId: input.actor.hotel_tenant_id, isActive: true, isDeleted: false, departmentId: { in: input.departmentIds } };
  const users = input.visibility === "DEPARTMENT" && !input.departmentIds.length
    ? []
    : await tx.user.findMany({ where, select: { id: true } });
  const targets = users.map((item) => item.id).filter((id) => id !== input.actor.id);
  if (!targets.length) return;
  const author = `${input.actor.firstName} ${input.actor.lastName}`.trim();
  await tx.notification.createMany({
    skipDuplicates: true,
    data: targets.map((recipientId) => ({
      hotelTenantId: input.actor.hotel_tenant_id,
      recipientId,
      moduleKey: "handovers",
      eventKey: `handovers:${input.handoverId}:create:${randomUUID()}`,
      icon: "handovers",
      destination: `/handovers/${input.handoverId}`,
      titleEn: "New handover",
      titleDe: "Neue Übergabe",
      titleIt: "Nuova consegna",
      bodyEn: `${author} shared “${input.title}”.`,
      bodyDe: `${author} hat „${input.title}“ geteilt.`,
      bodyIt: `${author} ha condiviso “${input.title}”.`,
      requiredScope: "OWN",
    })),
  });
}

async function handoverRoleUserIds(tx: Prisma.TransactionClient, hotelTenantId: string, actorId: string) {
  const [users, permissions] = await Promise.all([
    tx.user.findMany({
      where: { hotelTenantId, isActive: true, isDeleted: false },
      select: { id: true, role: true },
    }),
    tx.roleModulePermission.findMany({
      where: { hotelTenantId, moduleKey: "handovers" },
      select: { role: true, canView: true },
    }),
  ]);
  const override = new Map(permissions.map((item) => [item.role, item.canView]));
  return users.filter((user) => {
    if (user.id === actorId) return false;
    if (user.role === "ADMIN") return true;
    if (override.has(user.role)) return Boolean(override.get(user.role));
    return user.role === "EMPLOYEE" || user.role === "TEAM_LEAD" || user.role === "MANAGEMENT";
  }).map((user) => user.id);
}

async function notifyHandoverDone(tx: Prisma.TransactionClient, input: { actor: HandoversActor; handoverId: string; title: string }) {
  const targets = await handoverRoleUserIds(tx, input.actor.hotel_tenant_id, input.actor.id);
  if (!targets.length) return;
  const author = `${input.actor.firstName} ${input.actor.lastName}`.trim();
  await tx.notification.createMany({
    skipDuplicates: true,
    data: targets.map((recipientId) => ({
      hotelTenantId: input.actor.hotel_tenant_id,
      recipientId,
      moduleKey: "handovers",
      eventKey: `handovers:${input.handoverId}:done:${randomUUID()}`,
      icon: "handovers",
      destination: `/handovers/${input.handoverId}`,
      titleEn: "Handover completed",
      titleDe: "Übergabe erledigt",
      titleIt: "Consegna completata",
      bodyEn: `${author} marked “${input.title}” as completed.`,
      bodyDe: `${author} hat „${input.title}“ als erledigt markiert.`,
      bodyIt: `${author} ha segnato “${input.title}” come completata.`,
      requiredScope: "OWN",
    })),
  });
}

export async function listHandovers(actor: HandoversActor, locale: string, kind: HandoverKind) {
  const rows = await prisma.handover.findMany({
    where: visibleWhere(actor, kind),
    include,
    orderBy: { createdAt: "desc" },
  });
  return rows.map((row) => toPublicHandover(row, locale));
}

export async function getHandover(actor: HandoversActor, id: string, locale: string) {
  if (!isUuid(id)) return null;
  const row = await prisma.handover.findFirst({
    where: { id, ...visibleWhere(actor, "HANDOVER") },
    include,
  });
  return row ? toPublicHandover(row, locale) : null;
}

export async function createHandover(actor: HandoversActor, body: Record<string, unknown>, locale: string) {
  if (!actor.canManage) return { error: "FORBIDDEN" as const };
  const title = String(body.title ?? "").trim().slice(0, 180);
  const description = String(body.description ?? "").trim().slice(0, 20000);
  if (!title) return { error: "TITLE_REQUIRED" as const };
  const kind = kindOf(String(body.kind ?? "handover"));
  const draft = String(body.status ?? "") === "draft";
  const status: HandoverStatus = kind === "TEMPLATE" ? "OPEN" : draft ? "DRAFT" : "OPEN";
  const visibility = visibilityOf(String(body.visibility ?? "alle"));
  const tags = Array.isArray(body.tags) ? body.tags.map((item) => String(item).trim()).filter(Boolean).slice(0, 40) : [];
  const requestedDepts = Array.isArray(body.departmentIds) ? body.departmentIds.map(String) : [];
  const departmentIds = visibility === "DEPARTMENT" || kind === "TEMPLATE" ? await validDepartmentIds(actor.hotel_tenant_id, requestedDepts) : [];
  const locales = await translateHandoverFields(actor.hotel_tenant_id, locale, { title, description, tags });
  const id = randomUUID();
  const created = await prisma.$transaction(async (tx) => {
    await tx.handover.create({
      data: {
        id,
        hotelTenantId: actor.hotel_tenant_id,
        createdById: actor.id,
        kind,
        status,
        visibility,
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
      await tx.handoverShareDepartment.createMany({ data: departmentIds.map((departmentId) => ({ handoverId: id, departmentId })) });
    }
    await recordAuditLog(tx, {
      hotelTenantId: actor.hotel_tenant_id,
      actorId: actor.id,
      action: "CREATE",
      entityType: kind === "TEMPLATE" ? "HANDOVER_TEMPLATE" : "HANDOVER",
      entityId: id,
      changes: { after: locales.title },
    });
    if (kind === "HANDOVER" && status === "OPEN" && visibility !== "PRIVATE") {
      await notifyHandover(tx, { actor, handoverId: id, visibility, departmentIds, title: locales.title.en });
    }
    return tx.handover.findFirstOrThrow({ where: { id }, include });
  }, { timeout: 40000 });
  return { handover: toPublicHandover(created, locale) };
}

export async function updateHandover(actor: HandoversActor, id: string, body: Record<string, unknown>, locale: string) {
  if (!actor.canManage) return { error: "FORBIDDEN" as const };
  if (!isUuid(id)) return { error: "NOT_FOUND" as const };
  const existing = await prisma.handover.findFirst({ where: { id, ...visibleWhere(actor, "HANDOVER") }, include });
  if (!existing) return { error: "NOT_FOUND" as const };
  const title = String(body.title ?? "").trim().slice(0, 180);
  const description = String(body.description ?? "").trim().slice(0, 20000);
  if (!title) return { error: "TITLE_REQUIRED" as const };
  const draft = String(body.status ?? "") === "draft";
  const status: HandoverStatus = draft ? "DRAFT" : existing.status === "DONE" ? "DONE" : "OPEN";
  const visibility = visibilityOf(String(body.visibility ?? "alle"));
  const tags = Array.isArray(body.tags) ? body.tags.map((item) => String(item).trim()).filter(Boolean).slice(0, 40) : [];
  const departmentIds = visibility === "DEPARTMENT" ? await validDepartmentIds(actor.hotel_tenant_id, Array.isArray(body.departmentIds) ? body.departmentIds.map(String) : []) : [];
  const locales = await translateHandoverFields(actor.hotel_tenant_id, locale, { title, description, tags });
  const wasDraft = existing.status === "DRAFT";
  const updated = await prisma.$transaction(async (tx) => {
    await tx.handover.update({
      where: { id },
      data: {
        status,
        visibility,
        pinned: status === "DRAFT" ? false : existing.pinned,
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
    await tx.handoverShareDepartment.deleteMany({ where: { handoverId: id } });
    if (departmentIds.length) {
      await tx.handoverShareDepartment.createMany({ data: departmentIds.map((departmentId) => ({ handoverId: id, departmentId })) });
    }
    await recordAuditLog(tx, {
      hotelTenantId: actor.hotel_tenant_id,
      actorId: actor.id,
      action: "UPDATE",
      entityType: "HANDOVER",
      entityId: id,
      changes: { before: { en: existing.title, de: existing.titleDe, it: existing.titleIt }, after: locales.title },
    });
    if (wasDraft && status === "OPEN" && visibility !== "PRIVATE") {
      await notifyHandover(tx, { actor, handoverId: id, visibility, departmentIds, title: locales.title.en });
    }
    return tx.handover.findFirstOrThrow({ where: { id }, include });
  }, { timeout: 40000 });
  return { handover: toPublicHandover(updated, locale) };
}

export async function updateHandoverStatus(actor: HandoversActor, id: string, status: string, locale: string) {
  const next = statusDb[status];
  if (!next || next === "DRAFT" || !isUuid(id)) return { error: "INVALID" as const };
  const existing = await prisma.handover.findFirst({ where: { id, ...visibleWhere(actor, "HANDOVER") } });
  if (!existing || existing.status === "DRAFT") return { error: "NOT_FOUND" as const };
  const row = await prisma.$transaction(async (tx) => {
    const updated = await tx.handover.update({
      where: { id },
      data: {
        status: next,
        pinned: next === "DONE" ? false : existing.pinned,
        completedAt: next === "DONE" ? new Date() : null,
        completedById: next === "DONE" ? actor.id : null,
      },
      include,
    });
    await recordAuditLog(tx, {
      hotelTenantId: actor.hotel_tenant_id,
      actorId: actor.id,
      action: "STATUS_CHANGE",
      entityType: "HANDOVER",
      entityId: id,
      changes: {
        before: { en: existing.title, de: existing.titleDe, it: existing.titleIt, status: existing.status },
        after: { en: existing.title, de: existing.titleDe, it: existing.titleIt, status: next },
      },
    });
    if (next === "DONE" && existing.status !== "DONE") {
      await notifyHandoverDone(tx, { actor, handoverId: id, title: existing.title });
    }
    return updated;
  });
  return { handover: toPublicHandover(row, locale) };
}

export async function updateHandoverPin(actor: HandoversActor, id: string, pinned: boolean, locale: string) {
  if (!isUuid(id)) return { error: "NOT_FOUND" as const };
  const existing = await prisma.handover.findFirst({ where: { id, ...visibleWhere(actor, "HANDOVER") } });
  if (!existing || existing.status !== "OPEN") return { error: "NOT_FOUND" as const };
  const row = await prisma.handover.update({ where: { id }, data: { pinned }, include });
  await prisma.$transaction(async (tx) => {
    await recordAuditLog(tx, {
      hotelTenantId: actor.hotel_tenant_id,
      actorId: actor.id,
      action: "UPDATE",
      entityType: "HANDOVER",
      entityId: id,
      changes: { before: { title: existing.title, pinned: existing.pinned }, after: { title: existing.title, pinned } },
    });
  });
  return { handover: toPublicHandover(row, locale) };
}
