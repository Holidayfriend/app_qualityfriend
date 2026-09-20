import "server-only";

import { randomUUID } from "node:crypto";
import type { HotelTaskAssignType, Prisma } from "../../app/generated/prisma/client";
import { recordAuditLog } from "../audit/audit-service";
import { pickLocalized } from "../recruiting/job-fields";
import { prisma } from "../prisma";
import type { TasksActor } from "./access";
import { translateTaskFields } from "./translate";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const include = {
  createdBy: { select: { firstName: true, lastName: true } },
  assignee: { select: { id: true, firstName: true, lastName: true } },
  completedBy: { select: { firstName: true, lastName: true } },
  department: { select: { id: true, nameEn: true, nameDe: true, nameIt: true } },
};

type Row = Prisma.HotelTaskGetPayload<{ include: typeof include }>;

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

function isoDate(value: Date | null) {
  return value ? value.toISOString().slice(0, 10) : "";
}

function parseDate(value: unknown) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  return new Date(`${value}T00:00:00.000Z`);
}

function titlesOf(row: Row) {
  return { title: row.title, titleDe: row.titleDe, titleIt: row.titleIt };
}

export function toPublicTask(row: Row, locale: string) {
  const assignee = row.assignType === "PERSON"
    ? nameOf(row.assignee)
    : row.department
      ? pickLocalized(row.department.nameEn, row.department.nameDe, row.department.nameIt, locale)
      : "";
  return {
    id: row.id,
    title: pickLocalized(row.title, row.titleDe, row.titleIt, locale),
    note: pickLocalized(row.note, row.noteDe, row.noteIt, locale),
    status: row.status === "DONE" ? "done" : "open",
    assignType: row.assignType === "PERSON" ? "person" : "dept",
    assignee,
    assigneeId: row.assigneeId || "",
    departmentId: row.departmentId || "",
    due: dateOf(row.dueAt, locale),
    dueIso: isoDate(row.dueAt),
    origin: row.origin || "",
    creator: nameOf(row.createdBy),
    completedAt: dateTimeOf(row.completedAt, locale),
    completedBy: nameOf(row.completedBy),
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

async function recipientIds(tx: Prisma.TransactionClient, actor: TasksActor, row: {
  assignType: HotelTaskAssignType;
  departmentId: string | null;
  assigneeId: string | null;
}) {
  const ids = new Set<string>();
  if (row.assignType === "PERSON" && row.assigneeId) {
    ids.add(row.assigneeId);
  } else if (row.assignType === "DEPT" && row.departmentId) {
    const users = await tx.user.findMany({
      where: { hotelTenantId: actor.hotel_tenant_id, isActive: true, isDeleted: false, departmentId: row.departmentId },
      select: { id: true },
    });
    for (const user of users) ids.add(user.id);
  }
  ids.delete(actor.id);
  return [...ids];
}

async function taskRoleUserIds(tx: Prisma.TransactionClient, hotelTenantId: string, actorId: string) {
  const [users, permissions] = await Promise.all([
    tx.user.findMany({
      where: { hotelTenantId, isActive: true, isDeleted: false },
      select: { id: true, role: true },
    }),
    tx.roleModulePermission.findMany({
      where: { hotelTenantId, moduleKey: "tasks" },
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

async function notify(tx: Prisma.TransactionClient, input: {
  actor: TasksActor;
  taskId: string;
  event: "create" | "update" | "done";
  title: { en: string; de: string; it: string };
  ids: string[];
}) {
  if (!input.ids.length) return;
  const author = `${input.actor.firstName} ${input.actor.lastName}`.trim();
  const text = input.event === "create"
    ? {
      en: { title: "New task", body: `${author} created “${input.title.en}”.` },
      de: { title: "Neue Aufgabe", body: `${author} hat „${input.title.de}“ erstellt.` },
      it: { title: "Nuovo compito", body: `${author} ha creato “${input.title.it}”.` },
    }
    : input.event === "done"
      ? {
        en: { title: "Task completed", body: `${author} marked “${input.title.en}” as done.` },
        de: { title: "Aufgabe erledigt", body: `${author} hat „${input.title.de}“ als erledigt markiert.` },
        it: { title: "Compito completato", body: `${author} ha segnato “${input.title.it}” come completato.` },
      }
    : {
      en: { title: "Task updated", body: `${author} updated “${input.title.en}”.` },
      de: { title: "Aufgabe aktualisiert", body: `${author} hat „${input.title.de}“ aktualisiert.` },
      it: { title: "Compito aggiornato", body: `${author} ha aggiornato “${input.title.it}”.` },
    };
  await tx.notification.createMany({
    skipDuplicates: true,
    data: input.ids.map((recipientId) => ({
      hotelTenantId: input.actor.hotel_tenant_id,
      recipientId,
      moduleKey: "tasks",
      eventKey: `tasks:${input.taskId}:${input.event}:${randomUUID()}`,
      icon: "tasks",
      destination: `/tasks/${input.taskId}`,
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

export function visibleTaskWhere(actor: { id: string; hotel_tenant_id: string; departmentId: string | null; canManage: boolean }): Prisma.HotelTaskWhereInput {
  if (actor.canManage) return { hotelTenantId: actor.hotel_tenant_id };
  return {
    hotelTenantId: actor.hotel_tenant_id,
    OR: [
      { assigneeId: actor.id },
      ...(actor.departmentId ? [{ assignType: "DEPT" as const, departmentId: actor.departmentId }] : []),
    ],
  };
}

export async function listTasks(actor: TasksActor, locale: string) {
  const rows = await prisma.hotelTask.findMany({
    where: visibleTaskWhere(actor),
    include,
    orderBy: [{ status: "asc" }, { dueAt: "asc" }, { createdAt: "desc" }],
  });
  return rows.map((row) => toPublicTask(row, locale));
}

export async function getTask(actor: TasksActor, id: string, locale: string) {
  if (!isUuid(id)) return null;
  const row = await prisma.hotelTask.findFirst({ where: { id, ...visibleTaskWhere(actor) }, include });
  return row ? toPublicTask(row, locale) : null;
}

export async function openTaskCount(actor: { id: string; hotel_tenant_id: string; departmentId: string | null; canManage: boolean }) {
  return prisma.hotelTask.count({
    where: { ...visibleTaskWhere(actor), status: "OPEN" },
  });
}

async function parsedBody(actor: TasksActor, body: Record<string, unknown>, locale: string) {
  const title = String(body.title ?? "").trim();
  if (!title) return { error: "INVALID" as const };
  const assignType: HotelTaskAssignType = String(body.assignType) === "person" ? "PERSON" : "DEPT";
  const departmentId = assignType === "DEPT" ? await validDepartmentId(actor.hotel_tenant_id, String(body.departmentId ?? "")) : null;
  const assigneeId = assignType === "PERSON" ? await validUserId(actor.hotel_tenant_id, String(body.assigneeId ?? "")) : null;
  if (assignType === "DEPT" && !departmentId) return { error: "INVALID" as const };
  if (assignType === "PERSON" && !assigneeId) return { error: "INVALID" as const };
  const locales = await translateTaskFields(actor.hotel_tenant_id, locale, { title, note: String(body.note ?? "") });
  return {
    assignType,
    departmentId,
    assigneeId,
    dueAt: parseDate(body.dueIso),
    originalLocale: locale === "de" || locale === "it" ? locale : "en",
    title: locales.title.en,
    titleDe: locales.title.de,
    titleIt: locales.title.it,
    note: locales.note.en,
    noteDe: locales.note.de,
    noteIt: locales.note.it,
  };
}

export async function createTask(actor: TasksActor, body: Record<string, unknown>, locale: string) {
  const parsed = await parsedBody(actor, body, locale);
  if ("error" in parsed) return parsed;
  const row = await prisma.$transaction(async (tx) => {
    const created = await tx.hotelTask.create({
      data: { hotelTenantId: actor.hotel_tenant_id, createdById: actor.id, ...parsed },
      include,
    });
    await recordAuditLog(tx, {
      hotelTenantId: actor.hotel_tenant_id,
      actorId: actor.id,
      action: "CREATE",
      entityType: "TASK",
      entityId: created.id,
      changes: { after: titlesOf(created) },
    });
    await notify(tx, {
      actor,
      taskId: created.id,
      event: "create",
      title: { en: created.title, de: created.titleDe, it: created.titleIt },
      ids: await recipientIds(tx, actor, created),
    });
    return created;
  });
  return { task: toPublicTask(row, locale) };
}

export async function updateTask(actor: TasksActor, id: string, body: Record<string, unknown>, locale: string) {
  if (!isUuid(id)) return { error: "NOT_FOUND" as const };
  const existing = await prisma.hotelTask.findFirst({ where: { id, hotelTenantId: actor.hotel_tenant_id } });
  if (!existing) return { error: "NOT_FOUND" as const };
  const parsed = await parsedBody(actor, body, locale);
  if ("error" in parsed) return parsed;
  const row = await prisma.$transaction(async (tx) => {
    const updated = await tx.hotelTask.update({ where: { id }, data: parsed, include });
    await recordAuditLog(tx, {
      hotelTenantId: actor.hotel_tenant_id,
      actorId: actor.id,
      action: "UPDATE",
      entityType: "TASK",
      entityId: id,
      changes: {
        before: { title: existing.title, titleDe: existing.titleDe, titleIt: existing.titleIt },
        after: titlesOf(updated),
      },
    });
    await notify(tx, {
      actor,
      taskId: id,
      event: "update",
      title: { en: updated.title, de: updated.titleDe, it: updated.titleIt },
      ids: await recipientIds(tx, actor, updated),
    });
    return updated;
  });
  return { task: toPublicTask(row, locale) };
}

export async function updateTaskStatus(actor: TasksActor, id: string, status: string, locale: string) {
  if (!isUuid(id)) return { error: "NOT_FOUND" as const };
  const next = status === "done" || status === "DONE" ? "DONE" : status === "open" || status === "OPEN" ? "OPEN" : null;
  if (!next) return { error: "INVALID" as const };
  const existing = await prisma.hotelTask.findFirst({ where: { id, ...visibleTaskWhere(actor) } });
  if (!existing) return { error: "NOT_FOUND" as const };
  if (existing.status === next) {
    const row = await prisma.hotelTask.findFirst({ where: { id }, include });
    return row ? { task: toPublicTask(row, locale) } : { error: "NOT_FOUND" as const };
  }
  const row = await prisma.$transaction(async (tx) => {
    const updated = await tx.hotelTask.update({
      where: { id },
      data: {
        status: next,
        completedAt: next === "DONE" ? new Date() : null,
        completedById: next === "DONE" ? actor.id : null,
      },
      include,
    });
    await recordAuditLog(tx, {
      hotelTenantId: actor.hotel_tenant_id,
      actorId: actor.id,
      action: "STATUS_CHANGE",
      entityType: "TASK",
      entityId: id,
      changes: {
        before: { en: existing.title, de: existing.titleDe, it: existing.titleIt, status: existing.status },
        after: { en: existing.title, de: existing.titleDe, it: existing.titleIt, status: next },
      },
    });
    if (next === "DONE") {
      await notify(tx, {
        actor,
        taskId: id,
        event: "done",
        title: { en: updated.title, de: updated.titleDe, it: updated.titleIt },
        ids: await taskRoleUserIds(tx, actor.hotel_tenant_id, actor.id),
      });
    }
    return updated;
  });
  return { task: toPublicTask(row, locale) };
}
