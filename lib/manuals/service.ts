import "server-only";

import { randomUUID } from "node:crypto";
import { recordAuditLog } from "../audit/audit-service";
import { prisma } from "../prisma";
import { dispatchManualIndex } from "./dispatch";
import { ensureManualDeletedColumn } from "./ensure-deleted";
import { deleteManualBlob, readManualBlob, saveManualBlob } from "./file-blob";
import { deleteManualFile, isManualUpload, MAX_MANUAL_VIDEOS, mimeFor, readManualFile, saveManualFile, saveManualVideo } from "./storage";
import { departmentIdsOf, usersInDepartments } from "../users/memberships";
import type { ManualsActor } from "./access";
import { manualAudienceWhere } from "./visibility";

const departmentSelect = { id: true, nameEn: true, nameDe: true, nameIt: true } as const;
type NamedDepartment = { id: string; nameEn: string; nameDe: string; nameIt: string };

function visibleWhere(actor: ManualsActor) {
  const base = { hotelTenantId: actor.hotel_tenant_id, isDeleted: false };
  if (actor.canManage) return base;
  return { AND: [base, manualAudienceWhere(actor)] };
}

function assignedDepartments(document: { department: NamedDepartment | null; departments: { department: NamedDepartment }[] }) {
  if (document.departments.length) return document.departments.map((row) => row.department);
  return document.department ? [document.department] : [];
}

function titleFromFile(name: string) {
  return name.replace(/\.(pdf|docx?|txt)$/i, "").trim().slice(0, 180) || name.slice(0, 180);
}

function placeNames(departments: { nameEn: string; nameDe: string; nameIt: string }[]) {
  const clip = (value: string) => value.length > 240 ? `${value.slice(0, 237)}…` : value;
  if (!departments.length) return { en: "hotel-wide", de: "hotelweit", it: "tutto l’hotel" };
  return {
    en: clip(departments.map((department) => department.nameEn).join(", ")),
    de: clip(departments.map((department) => department.nameDe).join(", ")),
    it: clip(departments.map((department) => department.nameIt).join(", ")),
  };
}

function manualNotificationData(input: {
  hotelTenantId: string;
  recipientId: string;
  documentId: string;
  title: string;
  author: string;
  departments: { nameEn: string; nameDe: string; nameIt: string }[];
}) {
  const place = placeNames(input.departments);
  const placeEn = place.en;
  const placeDe = place.de;
  const placeIt = place.it;
  return {
    id: randomUUID(),
    hotelTenantId: input.hotelTenantId,
    recipientId: input.recipientId,
    moduleKey: "manuals",
    eventKey: `manuals:create:${input.documentId}`,
    icon: "manuals",
    destination: `/manuals/${input.documentId}`,
    titleEn: "New manual",
    titleDe: "Neues Handbuch",
    titleIt: "Nuovo manuale",
    bodyEn: `${input.author} added “${input.title}” (${placeEn}).`,
    bodyDe: `${input.author} hat „${input.title}“ hinzugefügt (${placeDe}).`,
    bodyIt: `${input.author} ha aggiunto “${input.title}” (${placeIt}).`,
    requiredScope: "OWN" as const,
  };
}

export async function notifyManualDocument(input: {
  hotelTenantId: string;
  actorId: string;
  author: string;
  documentId: string;
  title: string;
  departments: NamedDepartment[];
}) {
  const recipients = await prisma.user.findMany({
    where: {
      hotelTenantId: input.hotelTenantId,
      isActive: true,
      isDeleted: false,
      id: { not: input.actorId },
      ...(input.departments.length ? usersInDepartments(input.departments.map((department) => department.id)) : {}),
    },
    select: { id: true },
  });
  if (!recipients.length) return;
  await prisma.notification.createMany({
    skipDuplicates: true,
    data: recipients.map((recipient) => manualNotificationData({
      hotelTenantId: input.hotelTenantId,
      recipientId: recipient.id,
      documentId: input.documentId,
      title: input.title,
      author: input.author,
      departments: input.departments,
    })),
  });
}

export async function ensureManualNotifications(user: { id: string; hotelTenantId: string; departmentId?: string | null; departmentIds?: string[] }) {
  const departmentIds = departmentIdsOf(user);
  const documents = await prisma.manualDocument.findMany({
    where: {
      hotelTenantId: user.hotelTenantId,
      isDeleted: false,
      createdById: { not: user.id },
      AND: [manualAudienceWhere({ departmentIds })],
    },
    include: {
      department: { select: departmentSelect },
      departments: { include: { department: { select: departmentSelect } } },
      createdBy: { select: { firstName: true, lastName: true } },
    },
  });
  if (!documents.length) return;
  const eventKeys = documents.map((document) => `manuals:create:${document.id}`);
  const existing = await prisma.notification.findMany({
    where: { hotelTenantId: user.hotelTenantId, recipientId: user.id, eventKey: { in: eventKeys } },
    select: { eventKey: true },
  });
  const have = new Set(existing.map((item) => item.eventKey));
  const missing = documents.filter((document) => !have.has(`manuals:create:${document.id}`));
  if (!missing.length) return;
  await prisma.notification.createMany({
    skipDuplicates: true,
    data: missing.map((document) => manualNotificationData({
      hotelTenantId: user.hotelTenantId,
      recipientId: user.id,
      documentId: document.id,
      title: document.title,
      author: `${document.createdBy.firstName} ${document.createdBy.lastName}`.trim(),
      departments: assignedDepartments(document),
    })),
  });
}

export async function listManuals(actor: ManualsActor, locale: string) {
  await ensureManualDeletedColumn();
  const [documents, departments] = await Promise.all([
    prisma.manualDocument.findMany({
      where: visibleWhere(actor),
      orderBy: { createdAt: "desc" },
      include: {
        department: { select: departmentSelect },
        departments: { include: { department: { select: departmentSelect } } },
        videos: { select: { id: true, originalName: true }, orderBy: { createdAt: "asc" } },
      },
    }),
    prisma.department.findMany({
      where: { hotelTenantId: actor.hotel_tenant_id, isDeleted: false },
      orderBy: { nameEn: "asc" },
      select: { id: true, nameEn: true, nameDe: true, nameIt: true },
    }),
  ]);
  const name = (department: { nameEn: string; nameDe: string; nameIt: string } | null) => {
    if (!department) return "";
    return locale === "de" ? department.nameDe : locale === "it" ? department.nameIt : department.nameEn;
  };
  return {
    canManage: actor.canManage,
    departments: departments.map((department) => ({ id: department.id, name: name(department) })),
    documents: documents.map((document) => {
      const departments = assignedDepartments(document);
      return {
        id: document.id,
        title: document.title,
        originalName: document.originalName,
        departmentId: departments[0]?.id ?? document.departmentId,
        departmentIds: departments.map((department) => department.id),
        departmentName: departments.map((department) => name(department)).filter(Boolean).join(", "),
        hotelWide: departments.length === 0,
        updated: document.createdAt.toISOString(),
        videos: document.videos.map((video) => ({ id: video.id, originalName: video.originalName })),
      };
    }),
  };
}

export async function getManualMeta(actor: ManualsActor, id: string) {
  const document = await prisma.manualDocument.findFirst({
    where: { AND: [{ id }, visibleWhere(actor)] },
    select: { id: true, title: true, originalName: true },
  });
  if (!document) return null;
  return document;
}

function requestedDepartmentIds(form: FormData | { departmentId?: unknown; departmentIds?: unknown }) {
  if (form instanceof FormData) {
    const many = form.getAll("departmentIds").map((value) => String(value).trim()).filter(Boolean);
    if (many.length) return [...new Set(many)];
    const single = String(form.get("departmentId") || "").trim();
    return single ? [single] : [];
  }
  if (Array.isArray(form.departmentIds)) {
    return [...new Set(form.departmentIds.map((id) => String(id).trim()).filter(Boolean))];
  }
  const single = String(form.departmentId ?? "").trim();
  return single ? [single] : [];
}

async function departmentsForHotel(hotelTenantId: string, ids: string[]) {
  if (!ids.length) return [];
  const rows = await prisma.department.findMany({
    where: { id: { in: ids }, hotelTenantId, isDeleted: false },
    select: departmentSelect,
  });
  const byId = new Map(rows.map((row) => [row.id, row]));
  if (ids.some((id) => !byId.has(id))) return null;
  return ids.map((id) => byId.get(id)!);
}

export async function createManual(actor: ManualsActor, form: FormData) {
  const file = form.get("file");
  if (!isManualUpload(file)) return { error: "INVALID_FILE" as const };
  const scope = String(form.get("scope") || "hotel");
  const title = String(form.get("title") || "").trim().slice(0, 180) || titleFromFile(file.name);
  const departments = scope === "hotel" ? [] : await departmentsForHotel(actor.hotel_tenant_id, requestedDepartmentIds(form));
  if (departments === null || (scope !== "hotel" && !departments.length)) return { error: "INVALID_DEPARTMENT" as const };
  const stored = await saveManualFile(file);
  if (!stored) return { error: "INVALID_FILE" as const };
  try {
    const created = await prisma.$transaction(async (tx) => {
      const document = await tx.manualDocument.create({
        data: {
          hotelTenantId: actor.hotel_tenant_id,
          departmentId: departments[0]?.id ?? null,
          createdById: actor.id,
          title,
          originalName: stored.originalName,
          storageKey: stored.storageKey,
          mimeType: stored.mimeType,
          byteSize: stored.byteSize,
          ...(departments.length ? { departments: { create: departments.map((department) => ({ departmentId: department.id })) } } : {}),
        },
      });
      await saveManualBlob(tx, stored.storageKey, stored.bytes);
      await recordAuditLog(tx, { module: "manuals",
        hotelTenantId: actor.hotel_tenant_id,
        actorId: actor.id,
        action: "CREATE",
        entityType: "MANUAL",
        entityId: document.id,
        changes: { after: title },
      });
      return document;
    });
    await notifyManualDocument({
      hotelTenantId: actor.hotel_tenant_id,
      actorId: actor.id,
      author: `${actor.firstName} ${actor.lastName}`.trim(),
      documentId: created.id,
      title,
      departments,
    }).catch((error) => console.error("manual notification failed", error));
    await dispatchManualIndex(actor.hotel_tenant_id, created.id).catch((error) => console.error("manual index dispatch failed", error));
    return { document: created };
  } catch (error) {
    await deleteManualFile(stored.storageKey);
    throw error;
  }
}

export async function getManualForEdit(actor: ManualsActor, id: string) {
  await ensureManualDeletedColumn();
  const document = await prisma.manualDocument.findFirst({
    where: { id, hotelTenantId: actor.hotel_tenant_id },
    include: {
      department: { select: departmentSelect },
      departments: { include: { department: { select: departmentSelect } } },
      videos: { select: { id: true, originalName: true }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!document) return null;
  const departments = assignedDepartments(document);
  return {
    id: document.id,
    title: document.title,
    originalName: document.originalName,
    departmentId: departments[0]?.id ?? null,
    departmentIds: departments.map((department) => department.id),
    hotelWide: departments.length === 0,
    isDeleted: document.isDeleted,
    videos: document.videos,
  };
}

export async function updateManual(actor: ManualsActor, id: string, input: { title?: unknown; scope?: unknown; departmentId?: unknown; departmentIds?: unknown }) {
  await ensureManualDeletedColumn();
  const existing = await prisma.manualDocument.findFirst({ where: { id, hotelTenantId: actor.hotel_tenant_id } });
  if (!existing) return { error: "NOT_FOUND" as const };
  const title = String(input.title ?? existing.title).trim().slice(0, 180);
  if (!title) return { error: "INVALID" as const };
  const scope = String(input.scope ?? (existing.departmentId ? "department" : "hotel"));
  const departments = scope === "hotel" ? [] : await departmentsForHotel(actor.hotel_tenant_id, requestedDepartmentIds(input));
  if (departments === null || (scope !== "hotel" && !departments.length)) return { error: "INVALID_DEPARTMENT" as const };
  const departmentId = departments[0]?.id ?? null;
  await prisma.$transaction(async (tx) => {
    await tx.manualDocumentDepartment.deleteMany({ where: { documentId: id } });
    await tx.manualDocument.update({ where: { id }, data: { title, departmentId } });
    if (departments.length) {
      await tx.manualDocumentDepartment.createMany({ data: departments.map((department) => ({ documentId: id, departmentId: department.id })) });
    }
    await tx.manualChunk.updateMany({ where: { documentId: id }, data: { departmentId } });
    await recordAuditLog(tx, { module: "manuals",
      hotelTenantId: actor.hotel_tenant_id,
      actorId: actor.id,
      action: "UPDATE",
      entityType: "MANUAL",
      entityId: id,
      changes: { before: existing.title, after: title },
    });
  });
  return { ok: true as const, isDeleted: existing.isDeleted };
}

function videoUploads(form: FormData) {
  return [...form.getAll("video"), ...form.getAll("videos")].filter(isManualUpload);
}

export async function addManualVideos(actor: ManualsActor, documentId: string, form: FormData) {
  const document = await prisma.manualDocument.findFirst({ where: { id: documentId, hotelTenantId: actor.hotel_tenant_id }, select: { id: true } });
  if (!document) return { error: "NOT_FOUND" as const };
  const files = videoUploads(form);
  if (!files.length) return { error: "INVALID_VIDEO" as const };
  const count = await prisma.manualVideo.count({ where: { documentId } });
  if (count + files.length > MAX_MANUAL_VIDEOS) return { error: "TOO_MANY_VIDEOS" as const };
  const stored: { storageKey: string; originalName: string; mimeType: string; byteSize: number; bytes: Buffer }[] = [];
  for (const file of files) {
    const saved = await saveManualVideo(file);
    if (!saved) {
      await Promise.all(stored.map((item) => deleteManualFile(item.storageKey)));
      return { error: "INVALID_VIDEO" as const };
    }
    stored.push(saved);
  }
  try {
    await prisma.$transaction(async (tx) => {
      for (const item of stored) {
        await tx.manualVideo.create({
          data: {
            documentId,
            hotelTenantId: actor.hotel_tenant_id,
            originalName: item.originalName,
            storageKey: item.storageKey,
            mimeType: item.mimeType,
            byteSize: item.byteSize,
          },
        });
        await saveManualBlob(tx, item.storageKey, item.bytes);
      }
      await recordAuditLog(tx, { module: "manuals",
        hotelTenantId: actor.hotel_tenant_id,
        actorId: actor.id,
        action: "UPDATE",
        entityType: "MANUAL",
        entityId: documentId,
        changes: { after: stored.map((item) => item.originalName).join(", ") },
      });
    });
  } catch (error) {
    await Promise.all(stored.map((item) => deleteManualFile(item.storageKey)));
    throw error;
  }
  return { ok: true as const };
}

export async function removeManualVideo(actor: ManualsActor, documentId: string, videoId: string) {
  const video = await prisma.manualVideo.findFirst({
    where: { id: videoId, documentId, document: { hotelTenantId: actor.hotel_tenant_id } },
  });
  if (!video) return { error: "NOT_FOUND" as const };
  await prisma.$transaction(async (tx) => {
    await tx.manualVideo.delete({ where: { id: video.id } });
    await deleteManualBlob(tx, video.storageKey);
    await recordAuditLog(tx, { module: "manuals",
      hotelTenantId: actor.hotel_tenant_id,
      actorId: actor.id,
      action: "UPDATE",
      entityType: "MANUAL",
      entityId: documentId,
      changes: { before: video.originalName },
    });
  });
  await deleteManualFile(video.storageKey);
  return { ok: true as const };
}

export async function openManualVideo(actor: ManualsActor, documentId: string, videoId: string) {
  const document = await prisma.manualDocument.findFirst({ where: { AND: [{ id: documentId }, visibleWhere(actor)] }, select: { id: true } });
  if (!document) return null;
  const video = await prisma.manualVideo.findFirst({ where: { id: videoId, documentId } });
  if (!video) return null;
  const data = await readManualFile(video.storageKey) ?? await readManualBlob(prisma, video.storageKey);
  if (!data) return null;
  return { data, mimeType: video.mimeType || mimeFor(video.storageKey), name: video.originalName };
}

export async function removeManual(actor: ManualsActor, id: string) {
  await ensureManualDeletedColumn();
  const document = await prisma.manualDocument.findFirst({ where: { id, hotelTenantId: actor.hotel_tenant_id, isDeleted: false } });
  if (!document) return { error: "NOT_FOUND" as const };
  await prisma.$transaction(async (tx) => {
    await tx.manualChunk.deleteMany({ where: { documentId: id } });
    await tx.manualDocument.update({ where: { id }, data: { isDeleted: true, deletedAt: new Date(), indexStatus: "PENDING", indexError: null } });
    await recordAuditLog(tx, { module: "manuals",
      hotelTenantId: actor.hotel_tenant_id,
      actorId: actor.id,
      action: "DELETE",
      entityType: "MANUAL",
      entityId: id,
      changes: { before: document.title },
    });
  });
  return { ok: true as const };
}

export async function openManual(actor: ManualsActor, id: string) {
  const document = await prisma.manualDocument.findFirst({ where: { AND: [{ id }, visibleWhere(actor)] } });
  if (!document) return null;
  const data = await readManualFile(document.storageKey) ?? await readManualBlob(prisma, document.storageKey);
  if (!data) return null;
  const ext = document.originalName.match(/\.(pdf|docx?|txt)$/i)?.[0] || "";
  const downloadName = `${document.title.trim() || titleFromFile(document.originalName)}${ext}`;
  return { data, mimeType: document.mimeType || mimeFor(document.storageKey), name: downloadName };
}
