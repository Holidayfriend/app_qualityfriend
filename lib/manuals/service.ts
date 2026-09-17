import "server-only";

import { randomUUID } from "node:crypto";
import { recordAuditLog } from "../audit/audit-service";
import { prisma } from "../prisma";
import { dispatchManualIndex } from "./dispatch";
import { deleteManualFile, isManualUpload, mimeFor, readManualFile, saveManualFile } from "./storage";
import type { ManualsActor } from "./access";

function visibleWhere(actor: ManualsActor) {
  if (actor.canManage) return { hotelTenantId: actor.hotel_tenant_id };
  return { hotelTenantId: actor.hotel_tenant_id, OR: [{ departmentId: null }, ...(actor.departmentId ? [{ departmentId: actor.departmentId }] : [])] };
}

function titleFromFile(name: string) {
  return name.replace(/\.(pdf|docx?|txt)$/i, "").trim().slice(0, 180) || name.slice(0, 180);
}

function manualNotificationData(input: {
  hotelTenantId: string;
  recipientId: string;
  documentId: string;
  title: string;
  author: string;
  department: { nameEn: string; nameDe: string; nameIt: string } | null;
}) {
  const placeEn = input.department ? input.department.nameEn : "hotel-wide";
  const placeDe = input.department ? input.department.nameDe : "hotelweit";
  const placeIt = input.department ? input.department.nameIt : "tutto l’hotel";
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
  department: { id: string; nameEn: string; nameDe: string; nameIt: string } | null;
}) {
  const recipients = await prisma.user.findMany({
    where: {
      hotelTenantId: input.hotelTenantId,
      isActive: true,
      isDeleted: false,
      id: { not: input.actorId },
      ...(input.department ? { departmentId: input.department.id } : {}),
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
      department: input.department,
    })),
  });
}

export async function ensureManualNotifications(user: { id: string; hotelTenantId: string; departmentId: string | null }) {
  const documents = await prisma.manualDocument.findMany({
    where: {
      hotelTenantId: user.hotelTenantId,
      createdById: { not: user.id },
      OR: [{ departmentId: null }, ...(user.departmentId ? [{ departmentId: user.departmentId }] : [])],
    },
    include: {
      department: { select: { id: true, nameEn: true, nameDe: true, nameIt: true } },
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
      department: document.department,
    })),
  });
}

export async function listManuals(actor: ManualsActor, locale: string) {
  const [documents, departments] = await Promise.all([
    prisma.manualDocument.findMany({
      where: visibleWhere(actor),
      orderBy: { createdAt: "desc" },
      include: { department: { select: { id: true, nameEn: true, nameDe: true, nameIt: true } } },
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
    documents: documents.map((document) => ({
      id: document.id,
      title: document.title,
      originalName: document.originalName,
      departmentId: document.departmentId,
      departmentName: name(document.department),
      hotelWide: !document.departmentId,
      updated: document.createdAt.toISOString(),
    })),
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

export async function createManual(actor: ManualsActor, form: FormData) {
  const file = form.get("file");
  if (!isManualUpload(file)) return { error: "INVALID_FILE" as const };
  const scope = String(form.get("scope") || "hotel");
  const departmentId = String(form.get("departmentId") || "").trim();
  const title = String(form.get("title") || "").trim().slice(0, 180) || titleFromFile(file.name);
  let department: { id: string; nameEn: string; nameDe: string; nameIt: string } | null = null;
  if (scope !== "hotel") {
    department = await prisma.department.findFirst({
      where: { id: departmentId, hotelTenantId: actor.hotel_tenant_id, isDeleted: false },
      select: { id: true, nameEn: true, nameDe: true, nameIt: true },
    });
    if (!department) return { error: "INVALID_DEPARTMENT" as const };
  }
  const stored = await saveManualFile(file);
  if (!stored) return { error: "INVALID_FILE" as const };
  try {
    const created = await prisma.$transaction(async (tx) => {
      const document = await tx.manualDocument.create({
        data: {
          hotelTenantId: actor.hotel_tenant_id,
          departmentId: department?.id ?? null,
          createdById: actor.id,
          title,
          originalName: stored.originalName,
          storageKey: stored.storageKey,
          mimeType: stored.mimeType,
          byteSize: stored.byteSize,
        },
      });
      await recordAuditLog(tx, {
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
      department,
    }).catch((error) => console.error("manual notification failed", error));
    await dispatchManualIndex(actor.hotel_tenant_id, created.id).catch((error) => console.error("manual index dispatch failed", error));
    return { document: created };
  } catch (error) {
    await deleteManualFile(stored.storageKey);
    throw error;
  }
}

export async function removeManual(actor: ManualsActor, id: string) {
  const document = await prisma.manualDocument.findFirst({ where: { id, hotelTenantId: actor.hotel_tenant_id } });
  if (!document) return { error: "NOT_FOUND" as const };
  await prisma.$transaction(async (tx) => {
    await tx.manualDocument.delete({ where: { id } });
    await recordAuditLog(tx, {
      hotelTenantId: actor.hotel_tenant_id,
      actorId: actor.id,
      action: "DELETE",
      entityType: "MANUAL",
      entityId: id,
      changes: { before: document.title },
    });
  });
  await deleteManualFile(document.storageKey);
  return { ok: true as const };
}

export async function openManual(actor: ManualsActor, id: string) {
  const document = await prisma.manualDocument.findFirst({ where: { AND: [{ id }, visibleWhere(actor)] } });
  if (!document) return null;
  const data = await readManualFile(document.storageKey);
  if (!data) return null;
  const ext = document.originalName.match(/\.(pdf|docx?|txt)$/i)?.[0] || "";
  const downloadName = `${document.title.trim() || titleFromFile(document.originalName)}${ext}`;
  return { data, mimeType: document.mimeType || mimeFor(document.storageKey), name: downloadName };
}
