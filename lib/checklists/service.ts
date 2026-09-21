import "server-only";

import type { HotelChecklistAssignType, HotelChecklistDueType, HotelChecklistItemState, HotelChecklistKind, HotelChecklistRecurrence, HotelChecklistStatus, Prisma } from "../../app/generated/prisma/client";
import { recordAuditLog } from "../audit/audit-service";
import { pickLocalized } from "../recruiting/job-fields";
import { prisma } from "../prisma";
import type { TasksActor } from "../tasks/access";
import { hotelTodayIso, isoDate, nextDueIso, parseIsoDate } from "./recurrence";
import { notifyChecklist, recipientIds } from "./spawn";
import { translateChecklistFields } from "./translate";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const include = {
  createdBy: { select: { firstName: true, lastName: true } },
  assignee: { select: { id: true, firstName: true, lastName: true } },
  completedBy: { select: { firstName: true, lastName: true } },
  department: { select: { id: true, nameEn: true, nameDe: true, nameIt: true } },
  items: { orderBy: { sortOrder: "asc" as const } },
  completions: {
    orderBy: { createdAt: "desc" as const },
    take: 8,
    include: { author: { select: { firstName: true, lastName: true } } },
  },
};

type Row = Prisma.HotelChecklistGetPayload<{ include: typeof include }>;

export function isUuid(value: string) {
  return uuid.test(value);
}

function nameOf(row: { firstName: string; lastName: string } | null) {
  return row ? `${row.firstName} ${row.lastName}`.trim() : "";
}

function dateOf(value: Date | null, locale: string) {
  if (!value) return "";
  return value.toLocaleDateString(locale === "de" ? "de-DE" : locale === "it" ? "it-IT" : "en-GB");
}

function dateTimeOf(value: Date | null, locale: string) {
  if (!value) return "";
  return value.toLocaleString(locale === "de" ? "de-DE" : locale === "it" ? "it-IT" : "en-GB", { dateStyle: "short", timeStyle: "short" });
}

function titlesOf(row: { title: string; titleDe: string; titleIt: string }) {
  return { title: row.title, titleDe: row.titleDe, titleIt: row.titleIt };
}

function assignedWhere(actor: TasksActor): Prisma.HotelChecklistWhereInput[] {
  return [
    { assignType: "ALL" },
    ...(actor.departmentId ? [{ assignType: "DEPT" as const, departmentId: actor.departmentId }] : []),
    { assignType: "PERSON", assigneeId: actor.id },
  ];
}

export function visibleChecklistWhere(actor: TasksActor): Prisma.HotelChecklistWhereInput {
  if (actor.canManage) return { hotelTenantId: actor.hotel_tenant_id };
  return {
    hotelTenantId: actor.hotel_tenant_id,
    kind: "CHECKLIST",
    status: "ACTIVE",
    OR: assignedWhere(actor),
  };
}

export function toPublicChecklist(row: Row, locale: string, today: string) {
  const assignee = row.assignType === "PERSON"
    ? nameOf(row.assignee)
    : row.assignType === "DEPT" && row.department
      ? pickLocalized(row.department.nameEn, row.department.nameDe, row.department.nameIt, locale)
      : "";
  const done = row.items.filter((item) => item.state === "DONE").length;
  const nextIso = row.origin === "RUN" ? isoDate(row.dueAt) : nextDueIso(row, today);
  return {
    id: row.id,
    originalId: row.originalId || "",
    origin: row.origin === "RUN" ? "run" : "original",
    isOriginal: row.origin === "ORIGINAL" && row.dueType === "RECURRING" && row.kind === "CHECKLIST",
    kind: row.kind === "TEMPLATE" ? "template" : "checklist",
    title: pickLocalized(row.title, row.titleDe, row.titleIt, locale),
    desc: pickLocalized(row.description, row.descriptionDe, row.descriptionIt, locale),
    status: row.status === "DRAFT" ? "draft" : row.status === "ARCHIVED" ? "archived" : "active",
    assignType: row.assignType === "PERSON" ? "person" : row.assignType === "DEPT" ? "dept" : "all",
    assignee,
    assigneeId: row.assigneeId || "",
    departmentId: row.departmentId || "",
    dueType: row.dueType === "RECURRING" ? "recurring" : "once",
    recurrence: row.recurrence.toLowerCase() as "once" | "daily" | "weekly" | "monthly" | "quarterly" | "yearly",
    weekdays: row.weekdays,
    dueIso: isoDate(row.dueAt),
    startIso: isoDate(row.startAt),
    endIso: isoDate(row.endAt),
    nextDue: dateOf(parseIsoDate(nextIso), locale),
    nextDueIso: nextIso,
    completedAt: dateTimeOf(row.completedAt, locale),
    completedBy: nameOf(row.completedBy),
    items: row.items.map((item) => ({
      id: item.id,
      text: pickLocalized(item.text, item.textDe, item.textIt, locale),
      state: item.state === "DONE" ? "done" : item.state === "EXCEPTION" ? "exception" : "open",
      comment: item.comment,
    })),
    progress: `${done}/${row.items.length}`,
    completions: row.completions.map((item) => ({
      id: item.id,
      result: "done",
      author: nameOf(item.author),
      date: dateOf(item.createdAt, locale),
    })),
  };
}

async function validDepartmentId(hotelTenantId: string, id: string) {
  if (!isUuid(id)) return null;
  const row = await prisma.department.findFirst({
    where: { hotelTenantId, isDeleted: false, isActive: true, id },
    select: { id: true },
  });
  return row?.id ?? null;
}

async function validUserId(hotelTenantId: string, id: string) {
  if (!isUuid(id)) return null;
  const row = await prisma.user.findFirst({
    where: { hotelTenantId, id, isActive: true, isDeleted: false },
    select: { id: true },
  });
  return row?.id ?? null;
}

async function parsedBody(actor: TasksActor, body: Record<string, unknown>, locale: string) {
  const title = String(body.title ?? "").trim();
  if (!title) return { error: "INVALID" as const };
  const kind: HotelChecklistKind = String(body.kind) === "template" ? "TEMPLATE" : "CHECKLIST";
  const status: HotelChecklistStatus = String(body.status) === "draft" ? "DRAFT" : String(body.status) === "archived" ? "ARCHIVED" : "ACTIVE";
  const assignType: HotelChecklistAssignType = String(body.assignType) === "person" ? "PERSON" : String(body.assignType) === "dept" ? "DEPT" : "ALL";
  const dueType: HotelChecklistDueType = String(body.dueType) === "recurring" ? "RECURRING" : "ONCE";
  const recurrenceMap: Record<string, HotelChecklistRecurrence> = {
    daily: "DAILY", weekly: "WEEKLY", monthly: "MONTHLY", quarterly: "QUARTERLY", yearly: "YEARLY", once: "ONCE",
  };
  const recurrence = dueType === "ONCE" ? "ONCE" : (recurrenceMap[String(body.recurrence)] ?? "WEEKLY");
  const departmentId = assignType === "DEPT" ? await validDepartmentId(actor.hotel_tenant_id, String(body.departmentId ?? "")) : null;
  const assigneeId = assignType === "PERSON" ? await validUserId(actor.hotel_tenant_id, String(body.assigneeId ?? "")) : null;
  if (assignType === "DEPT" && !departmentId) return { error: "INVALID" as const };
  if (assignType === "PERSON" && !assigneeId) return { error: "INVALID" as const };
  const items = Array.isArray(body.items) ? body.items.map((item) => String(item ?? "").trim()).filter(Boolean).slice(0, 80) : [];
  const locales = await translateChecklistFields(actor.hotel_tenant_id, locale, { title, desc: String(body.desc ?? ""), items });
  const weekdays = Array.isArray(body.weekdays) ? body.weekdays.map((item) => String(item)).filter((item) => ["mo", "tu", "we", "th", "fr", "sa", "su"].includes(item)) : [];
  return {
    kind,
    status,
    assignType,
    dueType,
    recurrence,
    departmentId,
    assigneeId,
    weekdays,
    startAt: dueType === "RECURRING" ? parseIsoDate(String(body.startIso ?? "")) : null,
    endAt: dueType === "RECURRING" && !body.noEnd ? parseIsoDate(String(body.endIso ?? "")) : null,
    dueAt: dueType === "ONCE" ? parseIsoDate(String(body.dueIso ?? "")) : null,
    originalLocale: locale === "de" || locale === "it" ? locale : "en",
    title: locales.title.en,
    titleDe: locales.title.de,
    titleIt: locales.title.it,
    description: locales.desc.en,
    descriptionDe: locales.desc.de,
    descriptionIt: locales.desc.it,
    itemLocales: locales.items,
  };
}

async function hotelToday(actor: TasksActor) {
  const hotel = await prisma.hotelTenant.findFirst({ where: { id: actor.hotel_tenant_id }, select: { timeZone: true } });
  return hotelTodayIso(hotel?.timeZone);
}

export async function listChecklists(actor: TasksActor, locale: string) {
  const today = await hotelToday(actor);
  const rows = await prisma.hotelChecklist.findMany({
    where: visibleChecklistWhere(actor),
    include,
    orderBy: [{ status: "asc" }, { dueAt: "asc" }, { createdAt: "desc" }],
  });
  return rows.map((row) => toPublicChecklist(row, locale, today));
}

export async function getChecklist(actor: TasksActor, id: string, locale: string) {
  if (!isUuid(id)) return null;
  const today = await hotelToday(actor);
  const row = await prisma.hotelChecklist.findFirst({ where: { id, ...visibleChecklistWhere(actor) }, include });
  return row ? toPublicChecklist(row, locale, today) : null;
}

export async function createChecklist(actor: TasksActor, body: Record<string, unknown>, locale: string) {
  const parsed = await parsedBody(actor, body, locale);
  if ("error" in parsed) return parsed;
  const { itemLocales, ...data } = parsed;
  const today = await hotelToday(actor);
  const row = await prisma.$transaction(async (tx) => {
    const created = await tx.hotelChecklist.create({
      data: {
        hotelTenantId: actor.hotel_tenant_id,
        createdById: actor.id,
        origin: "ORIGINAL",
        ...data,
        items: {
          create: itemLocales.map((item, index) => ({
            sortOrder: index,
            text: item.en,
            textDe: item.de,
            textIt: item.it,
          })),
        },
      },
      include,
    });
    await recordAuditLog(tx, {
      hotelTenantId: actor.hotel_tenant_id,
      actorId: actor.id,
      action: "CREATE",
      entityType: created.kind === "TEMPLATE" ? "CHECKLIST_TEMPLATE" : "CHECKLIST",
      entityId: created.id,
      changes: { after: titlesOf(created) },
    });
    const notify = created.kind === "CHECKLIST" && created.status === "ACTIVE";
    if (notify) {
      await notifyChecklist(tx, {
        hotelTenantId: actor.hotel_tenant_id,
        skipId: actor.id,
        author: `${actor.firstName} ${actor.lastName}`.trim(),
        checklistId: created.id,
        event: "create",
        title: { en: created.title, de: created.titleDe, it: created.titleIt },
        ids: await recipientIds(tx, actor.hotel_tenant_id, created, actor.id),
      });
    }
    return created;
  });
  return { checklist: toPublicChecklist(row, locale, today) };
}

export async function updateChecklist(actor: TasksActor, id: string, body: Record<string, unknown>, locale: string) {
  if (!isUuid(id)) return { error: "NOT_FOUND" as const };
  const existing = await prisma.hotelChecklist.findFirst({ where: { id, hotelTenantId: actor.hotel_tenant_id, origin: "ORIGINAL" } });
  if (!existing) return { error: "NOT_FOUND" as const };
  const parsed = await parsedBody(actor, body, locale);
  if ("error" in parsed) return parsed;
  const { itemLocales, ...data } = parsed;
  const today = await hotelToday(actor);
  const row = await prisma.$transaction(async (tx) => {
    await tx.hotelChecklistItem.deleteMany({ where: { checklistId: id } });
    const updated = await tx.hotelChecklist.update({
      where: { id },
      data: {
        ...data,
        items: {
          create: itemLocales.map((item, index) => ({
            sortOrder: index,
            text: item.en,
            textDe: item.de,
            textIt: item.it,
          })),
        },
      },
      include,
    });
    await recordAuditLog(tx, {
      hotelTenantId: actor.hotel_tenant_id,
      actorId: actor.id,
      action: "UPDATE",
      entityType: "CHECKLIST",
      entityId: id,
      changes: { before: titlesOf(existing), after: titlesOf(updated) },
    });
    return updated;
  });
  return { checklist: toPublicChecklist(row, locale, today) };
}

export async function updateChecklistStatus(actor: TasksActor, id: string, status: string, locale: string) {
  if (!isUuid(id)) return { error: "NOT_FOUND" as const };
  const next: HotelChecklistStatus | null = status === "active" ? "ACTIVE" : status === "archived" ? "ARCHIVED" : status === "draft" ? "DRAFT" : null;
  if (!next) return { error: "INVALID" as const };
  const existing = await prisma.hotelChecklist.findFirst({ where: { id, hotelTenantId: actor.hotel_tenant_id, origin: "ORIGINAL" } });
  if (!existing) return { error: "NOT_FOUND" as const };
  const today = await hotelToday(actor);
  const row = await prisma.$transaction(async (tx) => {
    const updated = await tx.hotelChecklist.update({ where: { id }, data: { status: next }, include });
    await recordAuditLog(tx, {
      hotelTenantId: actor.hotel_tenant_id,
      actorId: actor.id,
      action: "STATUS_CHANGE",
      entityType: "CHECKLIST",
      entityId: id,
      changes: { before: { ...titlesOf(existing), status: existing.status }, after: { ...titlesOf(updated), status: next } },
    });
    return updated;
  });
  return { checklist: toPublicChecklist(row, locale, today) };
}

export async function toggleChecklistItem(actor: TasksActor, id: string, itemId: string, locale: string) {
  if (!isUuid(id) || !isUuid(itemId)) return { error: "NOT_FOUND" as const };
  const existing = await prisma.hotelChecklist.findFirst({ where: { id, ...visibleChecklistWhere(actor) }, include });
  if (!existing || existing.completedAt) return { error: "NOT_FOUND" as const };
  const item = existing.items.find((row) => row.id === itemId);
  if (!item) return { error: "NOT_FOUND" as const };
  const next: HotelChecklistItemState = item.state === "DONE" ? "OPEN" : "DONE";
  await prisma.hotelChecklistItem.update({ where: { id: itemId }, data: { state: next } });
  return getChecklist(actor, id, locale).then((checklist) => checklist ? { checklist } : { error: "NOT_FOUND" as const });
}

export async function completeChecklist(actor: TasksActor, id: string, comment: string, locale: string) {
  if (!isUuid(id)) return { error: "NOT_FOUND" as const };
  const existing = await prisma.hotelChecklist.findFirst({ where: { id, ...visibleChecklistWhere(actor) }, include });
  if (!existing || existing.kind !== "CHECKLIST") return { error: "NOT_FOUND" as const };
  if (existing.completedAt) {
    return { checklist: toPublicChecklist(existing, locale, await hotelToday(actor)) };
  }
  const today = await hotelToday(actor);
  const row = await prisma.$transaction(async (tx) => {
    const updated = await tx.hotelChecklist.update({
      where: { id },
      data: { completedAt: new Date(), completedById: actor.id },
      include,
    });
    await tx.hotelChecklistCompletion.create({
      data: { checklistId: id, authorId: actor.id, comment: comment.trim().slice(0, 2000) },
    });
    await recordAuditLog(tx, {
      hotelTenantId: actor.hotel_tenant_id,
      actorId: actor.id,
      action: "STATUS_CHANGE",
      entityType: "CHECKLIST",
      entityId: id,
      changes: { before: { ...titlesOf(existing), status: "OPEN" }, after: { ...titlesOf(updated), status: "DONE" } },
    });
    const roleIds = await tx.user.findMany({
      where: { hotelTenantId: actor.hotel_tenant_id, isActive: true, isDeleted: false },
      select: { id: true, role: true },
    });
    const permissions = await tx.roleModulePermission.findMany({
      where: { hotelTenantId: actor.hotel_tenant_id, moduleKey: "tasks" },
      select: { role: true, canView: true },
    });
    const override = new Map(permissions.map((item) => [item.role, item.canView]));
    const ids = roleIds.filter((user) => {
      if (user.id === actor.id) return false;
      if (user.role === "ADMIN") return true;
      if (override.has(user.role)) return Boolean(override.get(user.role));
      return user.role === "EMPLOYEE" || user.role === "TEAM_LEAD" || user.role === "MANAGEMENT";
    }).map((user) => user.id);
    await notifyChecklist(tx, {
      hotelTenantId: actor.hotel_tenant_id,
      author: `${actor.firstName} ${actor.lastName}`.trim(),
      checklistId: id,
      event: "done",
      title: { en: updated.title, de: updated.titleDe, it: updated.titleIt },
      ids,
    });
    return tx.hotelChecklist.findFirstOrThrow({ where: { id }, include });
  });
  return { checklist: toPublicChecklist(row, locale, today) };
}
