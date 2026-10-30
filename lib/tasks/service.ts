import "server-only";

import { randomUUID } from "node:crypto";
import type { HotelTaskAssignType, Prisma } from "../../app/generated/prisma/client";
import { recordAuditLog } from "../audit/audit-service";
import { pickLocalized } from "../recruiting/job-fields";
import { formatHotelDate, formatHotelDateTime } from "../hotel/clock";
import { hotelTimeZoneFor } from "../hotel/context";
import { prisma } from "../prisma";
import { deleteAttachmentFile, isAttachmentUpload, saveAttachmentFile } from "../attachments/storage";
import { departmentIdsOf, usersInDepartments } from "../users/memberships";
import type { TasksActor } from "./access";
import { translateTaskFields } from "./translate";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const include = {
  createdBy: { select: { firstName: true, lastName: true } },
  assignee: { select: { id: true, firstName: true, lastName: true } },
  completedBy: { select: { firstName: true, lastName: true } },
  department: { select: { id: true, nameEn: true, nameDe: true, nameIt: true } },
  departments: {
    select: {
      departmentId: true,
      department: { select: { nameEn: true, nameDe: true, nameIt: true } },
    },
  },
  attachments: { orderBy: { createdAt: "asc" as const } },
};

type Row = Prisma.HotelTaskGetPayload<{ include: typeof include }>;

export function isUuid(value: string) {
  return uuid.test(value);
}

function nameOf(row: { firstName: string; lastName: string } | null) {
  return row ? `${row.firstName} ${row.lastName}`.trim() : "";
}

function dateOf(value: Date | null, locale: string, timeZone?: string | null) {
  if (!value) return "";
  return formatHotelDate(value, locale, timeZone);
}

function dateTimeOf(value: Date | null, locale: string, timeZone?: string | null) {
  if (!value) return "";
  return formatHotelDateTime(value, locale, timeZone);
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

export function toPublicTask(row: Row, locale: string, timeZone?: string | null) {
  const departmentIds = row.departments.length
    ? row.departments.map((item) => item.departmentId)
    : row.departmentId ? [row.departmentId] : [];
  const assignee = row.assignType === "PERSON"
    ? nameOf(row.assignee)
    : row.departments.length
      ? row.departments.map((item) => pickLocalized(item.department.nameEn, item.department.nameDe, item.department.nameIt, locale)).join(", ")
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
    departmentId: departmentIds[0] || "",
    departmentIds,
    due: dateOf(row.dueAt, locale, timeZone),
    dueIso: isoDate(row.dueAt),
    origin: row.origin || "",
    creator: nameOf(row.createdBy),
    completedAt: dateTimeOf(row.completedAt, locale, timeZone),
    completedBy: nameOf(row.completedBy),
    attachments: row.attachments.map((file) => ({
      id: file.id,
      name: file.fileName,
      type: "photo" as const,
      url: `/api/tasks/${row.id}/attachments/${file.id}`,
    })),
  };
}

async function validDepartmentIds(hotelTenantId: string, ids: string[]) {
  const requested = [...new Set(ids.filter(isUuid))];
  if (!requested.length) return [] as string[];
  const rows = await prisma.department.findMany({
    where: { hotelTenantId, isDeleted: false, isActive: true, id: { in: requested } },
    select: { id: true },
  });
  const valid = new Set(rows.map((row) => row.id));
  return requested.filter((id) => valid.has(id));
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
  departments?: { departmentId: string }[];
  assigneeId: string | null;
}) {
  const ids = new Set<string>();
  if (row.assignType === "PERSON" && row.assigneeId) {
    ids.add(row.assigneeId);
  } else if (row.assignType === "DEPT") {
    const departmentIds = row.departments?.length
      ? row.departments.map((item) => item.departmentId)
      : row.departmentId ? [row.departmentId] : [];
    if (!departmentIds.length) return [];
    const users = await tx.user.findMany({
      where: { hotelTenantId: actor.hotel_tenant_id, isActive: true, isDeleted: false, ...usersInDepartments(departmentIds) },
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

export function visibleTaskWhere(actor: { id: string; hotel_tenant_id: string; departmentId: string | null; departmentIds?: string[]; canManage: boolean }): Prisma.HotelTaskWhereInput {
  if (actor.canManage) return { hotelTenantId: actor.hotel_tenant_id };
  return {
    hotelTenantId: actor.hotel_tenant_id,
    OR: [
      { assigneeId: actor.id },
      ...(departmentIdsOf(actor).length ? [{
        assignType: "DEPT" as const,
        OR: [
          { departments: { some: { departmentId: { in: departmentIdsOf(actor) } } } },
          { departmentId: { in: departmentIdsOf(actor) } },
        ],
      }] : []),
    ],
  };
}

export async function listTasks(actor: TasksActor, locale: string) {
  const timeZone = await hotelTimeZoneFor(actor.hotel_tenant_id);
  const rows = await prisma.hotelTask.findMany({
    where: visibleTaskWhere(actor),
    include,
    orderBy: [{ status: "asc" }, { dueAt: "asc" }, { createdAt: "desc" }],
  });
  return rows.map((row) => toPublicTask(row, locale, timeZone));
}

export async function getTask(actor: TasksActor, id: string, locale: string) {
  const timeZone = await hotelTimeZoneFor(actor.hotel_tenant_id);
  if (!isUuid(id)) return null;
  const row = await prisma.hotelTask.findFirst({ where: { id, ...visibleTaskWhere(actor) }, include });
  return row ? toPublicTask(row, locale, timeZone) : null;
}

export async function openTaskCount(actor: { id: string; hotel_tenant_id: string; departmentId: string | null; departmentIds?: string[]; canManage: boolean }) {
  return prisma.hotelTask.count({
    where: { ...visibleTaskWhere(actor), status: "OPEN" },
  });
}

async function parsedBody(actor: TasksActor, body: Record<string, unknown>, locale: string) {
  const title = String(body.title ?? "").trim();
  if (!title) return { error: "INVALID" as const };
  const assignType: HotelTaskAssignType = String(body.assignType) === "person" ? "PERSON" : "DEPT";
  const requestedDepartmentIds = Array.isArray(body.departmentIds)
    ? body.departmentIds.map((id) => String(id))
    : [String(body.departmentId ?? "")];
  const departmentIds = assignType === "DEPT" ? await validDepartmentIds(actor.hotel_tenant_id, requestedDepartmentIds) : [];
  const departmentId = departmentIds[0] ?? null;
  const assigneeId = assignType === "PERSON" ? await validUserId(actor.hotel_tenant_id, String(body.assigneeId ?? "")) : null;
  if (assignType === "DEPT" && !departmentIds.length) return { error: "INVALID" as const };
  if (assignType === "PERSON" && !assigneeId) return { error: "INVALID" as const };
  const locales = await translateTaskFields(actor.hotel_tenant_id, locale, { title, note: String(body.note ?? "") });
  return {
    assignType,
    departmentId,
    departmentIds,
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

const MAX_TASK_FILES = 10;

function parseJsonList(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || !value.trim()) return [] as string[];
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? [...new Set(parsed.map((item) => String(item).trim()).filter(Boolean))] : [];
  } catch {
    return [];
  }
}

async function saveUploads(files: File[]) {
  const saved: { fileName: string; storageKey: string; mimeType: string; byteSize: number }[] = [];
  for (const file of files) {
    const stored = await saveAttachmentFile("tasks", file);
    if (stored) saved.push({ fileName: stored.originalName, storageKey: stored.storageKey, mimeType: stored.mimeType, byteSize: stored.byteSize });
  }
  return saved;
}

async function collectTaskAttachments(form: FormData, existing?: { id: string; storageKey: string }[]) {
  const keepIds = parseJsonList(form.get("keepAttachmentIds")).filter(isUuid);
  const kept = existing?.filter((file) => keepIds.includes(file.id)) ?? [];
  const saved = await saveUploads(form.getAll("files").filter(isAttachmentUpload).slice(0, Math.max(0, MAX_TASK_FILES - kept.length)));
  const removed = existing?.filter((file) => !keepIds.includes(file.id)) ?? [];
  return { saved, removed };
}

async function writeTaskAttachments(tx: Prisma.TransactionClient, taskId: string, files: { saved: { fileName: string; storageKey: string; mimeType: string; byteSize: number }[]; removed: { id: string }[] }) {
  if (files.removed.length) await tx.hotelTaskAttachment.deleteMany({ where: { taskId, id: { in: files.removed.map((file) => file.id) } } });
  if (files.saved.length) await tx.hotelTaskAttachment.createMany({ data: files.saved.map((file) => ({ id: randomUUID(), taskId, ...file })) });
}

async function discardUploads(files: { storageKey: string }[]) {
  for (const file of files) await deleteAttachmentFile("tasks", file.storageKey);
}

export async function readTaskRequest(request: Request) {
  const type = request.headers.get("content-type") ?? "";
  if (type.includes("multipart/form-data")) {
    const form = await request.formData();
    let departmentIds: string[] = [];
    const rawDepartments = form.get("departmentIds");
    if (typeof rawDepartments === "string" && rawDepartments.trim()) {
      try {
        const parsed = JSON.parse(rawDepartments) as unknown;
        departmentIds = Array.isArray(parsed) ? parsed.map((id) => String(id)) : [];
      } catch {
        departmentIds = [];
      }
    }
    const body: Record<string, unknown> = {
      title: String(form.get("title") ?? ""),
      assignType: String(form.get("assignType") ?? ""),
      departmentIds,
      assigneeId: String(form.get("assigneeId") ?? ""),
      dueIso: String(form.get("dueIso") ?? ""),
      note: String(form.get("note") ?? ""),
      status: String(form.get("status") ?? ""),
    };
    return { body, form };
  }
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  return { body, form: null as FormData | null };
}

export async function createTask(actor: TasksActor, body: Record<string, unknown>, locale: string, form?: FormData | null) {
  const timeZone = await hotelTimeZoneFor(actor.hotel_tenant_id);
  const parsed = await parsedBody(actor, body, locale);
  if ("error" in parsed) return parsed;
  const { departmentIds, ...data } = parsed;
  const files = form ? await collectTaskAttachments(form) : null;
  try {
  const row = await prisma.$transaction(async (tx) => {
    const created = await tx.hotelTask.create({
      data: {
        hotelTenantId: actor.hotel_tenant_id,
        createdById: actor.id,
        ...data,
        departments: { create: departmentIds.map((departmentId) => ({ departmentId })) },
      },
      include,
    });
    await recordAuditLog(tx, { module: "tasks",
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
    if (files) await writeTaskAttachments(tx, created.id, files);
    return tx.hotelTask.findFirstOrThrow({ where: { id: created.id }, include });
  });
  return { task: toPublicTask(row, locale, timeZone) };
  } catch (error) {
    if (files) await discardUploads(files.saved);
    throw error;
  }
}

export async function updateTask(actor: TasksActor, id: string, body: Record<string, unknown>, locale: string, form?: FormData | null) {
  const timeZone = await hotelTimeZoneFor(actor.hotel_tenant_id);
  if (!isUuid(id)) return { error: "NOT_FOUND" as const };
  const existing = await prisma.hotelTask.findFirst({ where: { id, hotelTenantId: actor.hotel_tenant_id }, include: { attachments: true } });
  if (!existing) return { error: "NOT_FOUND" as const };
  const parsed = await parsedBody(actor, body, locale);
  if ("error" in parsed) return parsed;
  const { departmentIds, ...data } = parsed;
  const files = form ? await collectTaskAttachments(form, existing.attachments) : null;
  try {
  const row = await prisma.$transaction(async (tx) => {
    const updated = await tx.hotelTask.update({
      where: { id },
      data: {
        ...data,
        departments: {
          deleteMany: {},
          create: departmentIds.map((departmentId) => ({ departmentId })),
        },
      },
      include,
    });
    await recordAuditLog(tx, { module: "tasks",
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
    if (files) await writeTaskAttachments(tx, id, files);
    return tx.hotelTask.findFirstOrThrow({ where: { id }, include });
  });
  if (files) for (const file of files.removed) await deleteAttachmentFile("tasks", file.storageKey);
  return { task: toPublicTask(row, locale, timeZone) };
  } catch (error) {
    if (files) await discardUploads(files.saved);
    throw error;
  }
}

export async function updateTaskStatus(actor: TasksActor, id: string, status: string, locale: string, form?: FormData | null) {
  const timeZone = await hotelTimeZoneFor(actor.hotel_tenant_id);
  if (!isUuid(id)) return { error: "NOT_FOUND" as const };
  const next = status === "done" || status === "DONE" ? "DONE" : status === "open" || status === "OPEN" ? "OPEN" : null;
  if (!next) return { error: "INVALID" as const };
  const existing = await prisma.hotelTask.findFirst({ where: { id, ...visibleTaskWhere(actor) }, include: { attachments: true } });
  if (!existing) return { error: "NOT_FOUND" as const };
  const files = form ? await collectTaskAttachments(form, existing.attachments) : null;
  if (existing.status === next && !files) {
    const row = await prisma.hotelTask.findFirst({ where: { id }, include });
    return row ? { task: toPublicTask(row, locale, timeZone) } : { error: "NOT_FOUND" as const };
  }
  try {
  const row = await prisma.$transaction(async (tx) => {
    if (existing.status !== next) {
      const updated = await tx.hotelTask.update({
        where: { id },
        data: {
          status: next,
          completedAt: next === "DONE" ? new Date() : null,
          completedById: next === "DONE" ? actor.id : null,
        },
      });
      await recordAuditLog(tx, { module: "tasks",
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
    }
    if (files) await writeTaskAttachments(tx, id, files);
    return tx.hotelTask.findFirstOrThrow({ where: { id }, include });
  });
  if (files) for (const file of files.removed) await deleteAttachmentFile("tasks", file.storageKey);
  return { task: toPublicTask(row, locale, timeZone) };
  } catch (error) {
    if (files) await discardUploads(files.saved);
    throw error;
  }
}
