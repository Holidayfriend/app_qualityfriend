import "server-only";

import { randomUUID } from "node:crypto";
import type { Prisma } from "../../app/generated/prisma/client";
import type { HotelNoteKind, HotelNoteStatus, HotelNoteVisibility } from "../../app/generated/prisma/client";
import { recordAuditLog } from "../audit/audit-service";
import { pickLocalized } from "../recruiting/job-fields";
import { prisma } from "../prisma";
import type { NotesActor } from "./access";
import { deleteNoteFile, isNoteUpload, saveNoteFile } from "./storage";

export const MAX_NOTE_FILES = 10;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const include = {
  createdBy: { select: { firstName: true, lastName: true } },
  departments: { select: { departmentId: true } },
  users: { select: { userId: true } },
  attachments: { orderBy: { createdAt: "asc" as const } },
  comments: {
    orderBy: { createdAt: "asc" as const },
    include: { author: { select: { firstName: true, lastName: true } } },
  },
};

type NoteRow = Prisma.HotelNoteGetPayload<{ include: typeof include }>;

export function isUuid(value: string) {
  return uuid.test(value);
}

export function visibleWhere(actor: NotesActor, kind: HotelNoteKind): Prisma.HotelNoteWhereInput {
  if (kind === "TEMPLATE") {
    return { hotelTenantId: actor.hotel_tenant_id, kind: "TEMPLATE" };
  }
  const shared: Prisma.HotelNoteWhereInput[] = [
    { visibility: "ALL" },
    { visibility: "USER", users: { some: { userId: actor.id } } },
  ];
  if (actor.departmentId) {
    shared.push({ visibility: "DEPARTMENT", departments: { some: { departmentId: actor.departmentId } } });
  }
  return {
    hotelTenantId: actor.hotel_tenant_id,
    kind: "NOTE",
    status: actor.canManage ? { not: "DRAFT" } : "ACTIVE",
    AND: [
      {
        OR: [
          { createdById: actor.id },
          { AND: [{ visibility: { not: "PRIVATE" } }, { OR: shared }] },
        ],
      },
    ],
  };
}

export function toPublicNote(row: NoteRow, locale: string) {
  const visibility = row.visibility === "DEPARTMENT" ? "dept" : row.visibility === "USER" ? "user" : row.visibility === "PRIVATE" ? "privat" : "alle";
  const status = row.status === "INACTIVE" ? "inaktiv" : "aktiv";
  return {
    id: row.id,
    createdById: row.createdById,
    kind: row.kind === "TEMPLATE" ? "template" : "note",
    title: pickLocalized(row.title, row.titleDe, row.titleIt, locale),
    desc: pickLocalized(row.description, row.descriptionDe, row.descriptionIt, locale),
    creator: `${row.createdBy.firstName} ${row.createdBy.lastName}`.trim(),
    date: row.createdAt.toLocaleDateString("de-DE"),
    status,
    visibility,
    depts: row.departments.map((item) => item.departmentId),
    userIds: row.users.map((item) => item.userId),
    tags: locale === "de" ? row.tagsDe : locale === "it" ? row.tagsIt : row.tags,
    origLang: row.originalLocale,
    attachments: row.attachments.map((file) => ({
      id: file.id,
      name: file.fileName,
      url: `/api/notes/${row.id}/attachments/${file.id}`,
    })),
    comments: row.comments.map((item) => ({
      id: item.id,
      text: pickLocalized(item.text, item.textDe, item.textIt, locale),
      author: `${item.author.firstName} ${item.author.lastName}`.trim(),
      date: item.createdAt.toLocaleDateString("de-DE"),
    })),
  };
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

function visibilityOf(value: string): HotelNoteVisibility {
  const key = value.trim().toLowerCase();
  if (key === "dept" || key === "department") return "DEPARTMENT";
  if (key === "user") return "USER";
  if (key === "privat" || key === "private" || key === "onlyme" || key === "only-me") return "PRIVATE";
  return "ALL";
}

function kindOf(value: string): HotelNoteKind {
  return value === "template" ? "TEMPLATE" : "NOTE";
}

function statusOf(value: string, fallback: HotelNoteStatus): HotelNoteStatus {
  if (value === "draft") return "DRAFT";
  if (value === "inaktiv") return "INACTIVE";
  if (value === "aktiv") return "ACTIVE";
  return fallback;
}

async function validDepartmentIds(hotelTenantId: string, ids: string[]) {
  if (!ids.length) return [] as string[];
  const rows = await prisma.department.findMany({
    where: { hotelTenantId, isDeleted: false, isActive: true, id: { in: ids.filter(isUuid) } },
    select: { id: true },
  });
  return rows.map((row) => row.id);
}

async function validUserIds(hotelTenantId: string, ids: string[]) {
  if (!ids.length) return [] as string[];
  const rows = await prisma.user.findMany({
    where: { hotelTenantId, isDeleted: false, isActive: true, id: { in: ids.filter(isUuid) } },
    select: { id: true },
  });
  return rows.map((row) => row.id);
}

async function noteManagerIds(tx: Prisma.TransactionClient, hotelTenantId: string) {
  const [users, permissions] = await Promise.all([
    tx.user.findMany({
      where: { hotelTenantId, isActive: true, isDeleted: false },
      select: { id: true, role: true },
    }),
    tx.roleModulePermission.findMany({
      where: { hotelTenantId, moduleKey: "notes" },
      select: { role: true, canView: true },
    }),
  ]);
  const override = new Map(permissions.map((item) => [item.role, item.canView]));
  return users.filter((user) => {
    if (user.role === "ADMIN") return true;
    if (override.has(user.role)) return override.get(user.role) === true;
    return user.role === "EMPLOYEE" || user.role === "TEAM_LEAD";
  }).map((user) => user.id);
}

async function assignedUserIds(
  tx: Prisma.TransactionClient,
  input: { hotelTenantId: string; visibility: HotelNoteVisibility; departmentIds: string[]; userIds: string[]; excludeId: string },
) {
  const base: Prisma.UserWhereInput = {
    hotelTenantId: input.hotelTenantId,
    isActive: true,
    isDeleted: false,
    id: { not: input.excludeId },
  };
  if (input.visibility === "PRIVATE") return [] as string[];
  if (input.visibility === "DEPARTMENT") {
    if (!input.departmentIds.length) return [];
    const rows = await tx.user.findMany({ where: { ...base, departmentId: { in: input.departmentIds } }, select: { id: true } });
    return rows.map((row) => row.id);
  }
  if (input.visibility === "USER") {
    const ids = input.userIds.filter((id) => id !== input.excludeId);
    if (!ids.length) return [];
    const rows = await tx.user.findMany({ where: { ...base, id: { in: ids } }, select: { id: true } });
    return rows.map((row) => row.id);
  }
  const rows = await tx.user.findMany({ where: base, select: { id: true } });
  return rows.map((row) => row.id);
}

async function notifyRecipients(
  tx: Prisma.TransactionClient,
  input: {
    actor: NotesActor;
    noteId: string;
    kind: HotelNoteKind;
    status: HotelNoteStatus;
    visibility: HotelNoteVisibility;
    departmentIds: string[];
    userIds: string[];
    title: string;
    event: "create" | "update" | "comment";
  },
) {
  if (input.kind !== "NOTE" || input.status === "DRAFT" || input.visibility === "PRIVATE") return;
  const assigned = await assignedUserIds(tx, {
    hotelTenantId: input.actor.hotel_tenant_id,
    visibility: input.visibility,
    departmentIds: input.departmentIds,
    userIds: input.userIds,
    excludeId: input.actor.id,
  });
  const managers = input.event === "comment" ? await noteManagerIds(tx, input.actor.hotel_tenant_id) : [];
  const recipientIds = [...new Set([...assigned, ...managers])].filter((id) => id !== input.actor.id);
  if (!recipientIds.length) return;
  const author = `${input.actor.firstName} ${input.actor.lastName}`.trim();
  const text = input.event === "comment"
    ? {
      en: { title: "New comment", body: `${author} commented on “${input.title}”.` },
      de: { title: "Neuer Kommentar", body: `${author} hat „${input.title}“ kommentiert.` },
      it: { title: "Nuovo commento", body: `${author} ha commentato “${input.title}”.` },
    }
    : input.event === "create"
      ? {
        en: { title: "New note", body: `${author} shared “${input.title}”.` },
        de: { title: "Neue Notiz", body: `${author} hat „${input.title}“ geteilt.` },
        it: { title: "Nuova nota", body: `${author} ha condiviso “${input.title}”.` },
      }
      : {
        en: { title: "Note updated", body: `${author} updated “${input.title}”.` },
        de: { title: "Notiz aktualisiert", body: `${author} hat „${input.title}“ aktualisiert.` },
        it: { title: "Nota aggiornata", body: `${author} ha aggiornato “${input.title}”.` },
      };
  await tx.notification.createMany({
    skipDuplicates: true,
    data: recipientIds.map((recipientId) => ({
      hotelTenantId: input.actor.hotel_tenant_id,
      recipientId,
      moduleKey: "notes",
      eventKey: `notes:${input.noteId}:${input.event}:${randomUUID()}`,
      icon: "notes",
      destination: `/notes/${input.noteId}`,
      titleEn: text.en.title,
      titleDe: text.de.title,
      titleIt: text.it.title,
      bodyEn: text.en.body,
      bodyDe: text.de.body,
      bodyIt: text.it.body,
      requiredScope: input.visibility === "ALL" ? "ALL" : "OWN",
    })),
  });
}

async function saveUploads(files: File[]) {
  const saved: { fileName: string; storageKey: string; mimeType: string; byteSize: number }[] = [];
  for (const file of files) {
    const stored = await saveNoteFile(file);
    if (stored) saved.push({ fileName: stored.originalName, storageKey: stored.storageKey, mimeType: stored.mimeType, byteSize: stored.byteSize });
  }
  return saved;
}

export async function listNotes(actor: NotesActor, locale: string, kind: HotelNoteKind) {
  const rows = await prisma.hotelNote.findMany({
    where: visibleWhere(actor, kind),
    include,
    orderBy: { createdAt: "desc" },
  });
  return rows.map((row) => toPublicNote(row, locale));
}

export async function getNote(actor: NotesActor, id: string, locale: string) {
  if (!isUuid(id)) return null;
  const row = await prisma.hotelNote.findFirst({
    where: { id, AND: [visibleWhere(actor, "NOTE")] },
    include,
  });
  return row ? toPublicNote(row, locale) : null;
}

export async function getOwnedNote(actor: NotesActor, id: string) {
  if (!isUuid(id)) return null;
  const row = await prisma.hotelNote.findFirst({
    where: { id, hotelTenantId: actor.hotel_tenant_id },
    include,
  });
  if (!row) return null;
  if (row.visibility === "PRIVATE" && row.createdById !== actor.id) return null;
  return row;
}

export async function createNote(actor: NotesActor, form: FormData, locale: string) {
  const title = String(form.get("title") ?? "").trim().slice(0, 180);
  const description = String(form.get("description") ?? "").trim().slice(0, 20000);
  if (!title) return { error: "TITLE_REQUIRED" as const };
  const kind = kindOf(String(form.get("kind") ?? "note"));
  const status = statusOf(String(form.get("status") ?? "aktiv"), kind === "TEMPLATE" ? "ACTIVE" : "ACTIVE");
  const visibility = kind === "TEMPLATE" ? "PRIVATE" : visibilityOf(String(form.get("visibility") ?? "alle"));
  const tags = parseJsonList(form.get("tags")).slice(0, 40);
  const departmentIds = visibility === "DEPARTMENT" ? await validDepartmentIds(actor.hotel_tenant_id, parseJsonList(form.get("departmentIds"))) : [];
  const userIds = visibility === "USER" ? await validUserIds(actor.hotel_tenant_id, parseJsonList(form.get("userIds"))) : [];
  const files = form.getAll("files").filter(isNoteUpload).slice(0, MAX_NOTE_FILES);
  const saved = await saveUploads(files);
  const noteStatus = kind === "TEMPLATE" ? "ACTIVE" : status;
  const id = randomUUID();
  const created = await prisma.$transaction(async (tx) => {
    await tx.hotelNote.create({
      data: {
        id,
        hotelTenantId: actor.hotel_tenant_id,
        createdById: actor.id,
        kind,
        status: noteStatus,
        visibility,
        title,
        titleDe: title,
        titleIt: title,
        description,
        descriptionDe: description,
        descriptionIt: description,
        tags,
        tagsDe: tags,
        tagsIt: tags,
        originalLocale: locale,
      },
    });
    if (departmentIds.length) {
      await tx.hotelNoteShareDepartment.createMany({
        data: departmentIds.map((departmentId) => ({ noteId: id, departmentId })),
      });
    }
    if (userIds.length) {
      await tx.hotelNoteShareUser.createMany({
        data: userIds.map((userId) => ({ noteId: id, userId })),
      });
    }
    if (saved.length) {
      await tx.hotelNoteAttachment.createMany({
        data: saved.map((file) => ({ id: randomUUID(), noteId: id, ...file })),
      });
    }
    await recordAuditLog(tx, {
      hotelTenantId: actor.hotel_tenant_id,
      actorId: actor.id,
      action: "CREATE",
      entityType: kind === "TEMPLATE" ? "NOTE_TEMPLATE" : "NOTE",
      entityId: id,
      changes: { after: { title, kind, visibility } },
    });
    await notifyRecipients(tx, {
      actor, noteId: id, kind, status: noteStatus, visibility, departmentIds, userIds, title, event: "create",
    });
    return tx.hotelNote.findFirstOrThrow({ where: { id }, include });
  }, { timeout: 20000 });
  return { note: toPublicNote(created, locale) };
}

export async function updateNote(actor: NotesActor, id: string, form: FormData, locale: string) {
  const existing = await getOwnedNote(actor, id);
  if (!existing || existing.hotelTenantId !== actor.hotel_tenant_id) return { error: "NOT_FOUND" as const };
  if (!actor.canManage) return { error: "FORBIDDEN" as const };
  if (existing.kind === "TEMPLATE") return { error: "NOT_FOUND" as const };
  const title = String(form.get("title") ?? "").trim().slice(0, 180);
  const description = String(form.get("description") ?? "").trim().slice(0, 20000);
  if (!title) return { error: "TITLE_REQUIRED" as const };
  const visibility = visibilityOf(String(form.get("visibility") ?? "alle"));
  const tags = parseJsonList(form.get("tags")).slice(0, 40);
  const departmentIds = visibility === "DEPARTMENT" ? await validDepartmentIds(actor.hotel_tenant_id, parseJsonList(form.get("departmentIds"))) : [];
  const userIds = visibility === "USER" ? await validUserIds(actor.hotel_tenant_id, parseJsonList(form.get("userIds"))) : [];
  const keepIds = parseJsonList(form.get("keepAttachmentIds")).filter(isUuid);
  const kept = existing.attachments.filter((file) => keepIds.includes(file.id));
  const incoming = form.getAll("files").filter(isNoteUpload);
  const remaining = MAX_NOTE_FILES - kept.length;
  const saved = await saveUploads(incoming.slice(0, Math.max(0, remaining)));
  const removed = existing.attachments.filter((file) => !keepIds.includes(file.id));
  const updated = await prisma.$transaction(async (tx) => {
    await tx.hotelNoteShareDepartment.deleteMany({ where: { noteId: id } });
    await tx.hotelNoteShareUser.deleteMany({ where: { noteId: id } });
    if (removed.length) await tx.hotelNoteAttachment.deleteMany({ where: { noteId: id, id: { in: removed.map((file) => file.id) } } });
    await tx.hotelNote.update({
      where: { id },
      data: {
        visibility,
        title,
        titleDe: title,
        titleIt: title,
        description,
        descriptionDe: description,
        descriptionIt: description,
        tags,
        tagsDe: tags,
        tagsIt: tags,
        originalLocale: locale,
      },
    });
    if (departmentIds.length) {
      await tx.hotelNoteShareDepartment.createMany({
        data: departmentIds.map((departmentId) => ({ noteId: id, departmentId })),
      });
    }
    if (userIds.length) {
      await tx.hotelNoteShareUser.createMany({
        data: userIds.map((userId) => ({ noteId: id, userId })),
      });
    }
    if (saved.length) {
      await tx.hotelNoteAttachment.createMany({
        data: saved.map((file) => ({ id: randomUUID(), noteId: id, ...file })),
      });
    }
    const row = await tx.hotelNote.findFirstOrThrow({ where: { id }, include });
    await recordAuditLog(tx, {
      hotelTenantId: actor.hotel_tenant_id,
      actorId: actor.id,
      action: "UPDATE",
      entityType: "NOTE",
      entityId: id,
      changes: { before: { title: existing.title }, after: { title, visibility } },
    });
    await notifyRecipients(tx, {
      actor, noteId: id, kind: "NOTE", status: row.status, visibility, departmentIds, userIds, title, event: "update",
    });
    return row;
  });
  for (const file of removed) await deleteNoteFile(file.storageKey);
  return { note: toPublicNote(updated, locale) };
}

export async function updateNoteStatus(actor: NotesActor, id: string, status: HotelNoteStatus, locale: string) {
  const existing = await getOwnedNote(actor, id);
  if (!existing || existing.kind !== "NOTE") return { error: "NOT_FOUND" as const };
  if (!actor.canManage) return { error: "FORBIDDEN" as const };
  const row = await prisma.$transaction(async (tx) => {
    const updated = await tx.hotelNote.update({ where: { id }, data: { status }, include });
    await recordAuditLog(tx, {
      hotelTenantId: actor.hotel_tenant_id,
      actorId: actor.id,
      action: "STATUS_CHANGE",
      entityType: "NOTE",
      entityId: id,
      changes: { before: { status: existing.status }, after: { status } },
    });
    return updated;
  });
  return { note: toPublicNote(row, locale) };
}

export async function addNoteComment(actor: NotesActor, id: string, text: string, locale: string) {
  const value = text.trim().slice(0, 4000);
  if (!value) return { error: "COMMENT_REQUIRED" as const };
  const existing = await prisma.hotelNote.findFirst({
    where: { id, AND: [visibleWhere(actor, "NOTE")] },
    include,
  });
  if (!existing) return { error: "NOT_FOUND" as const };
  const row = await prisma.$transaction(async (tx) => {
    await tx.hotelNoteComment.create({
      data: { noteId: id, authorId: actor.id, text: value, textDe: value, textIt: value },
    });
    await recordAuditLog(tx, {
      hotelTenantId: actor.hotel_tenant_id,
      actorId: actor.id,
      action: "UPDATE",
      entityType: "NOTE",
      entityId: id,
      changes: { after: { comment: value.slice(0, 80) } },
    });
    await notifyRecipients(tx, {
      actor,
      noteId: id,
      kind: existing.kind,
      status: existing.status,
      visibility: existing.visibility,
      departmentIds: existing.departments.map((item) => item.departmentId),
      userIds: existing.users.map((item) => item.userId),
      title: existing.title,
      event: "comment",
    });
    return tx.hotelNote.findFirstOrThrow({ where: { id }, include });
  });
  return { note: toPublicNote(row, locale) };
}
