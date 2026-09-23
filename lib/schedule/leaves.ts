import "server-only";

import { randomUUID } from "node:crypto";
import { prisma } from "../prisma";
import { recordAuditLog } from "../audit/audit-service";
import { pickLocalized } from "../recruiting/job-fields";
import { translateShiftNote } from "./translate";
import { applyOffDays, applySwapDays, ensureShiftTable, parseTime } from "./shifts";
import { notifyLeaveDecided, notifyLeaveRequested } from "./notify";
import type { ScheduleActor } from "./access";
import {
  asLeaveCategory, asLeaveDuration, datesInclusive, fromDbCategory, fromDbDuration, personName, toDbCategory, toDbDuration,
  type LeaveCategory, type LeaveDuration,
} from "./leave-fields";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export type PublicAbsence = {
  id: string;
  employee: string;
  empKey: string;
  category: LeaveCategory;
  duration: LeaveDuration;
  start: string;
  end: string;
  startTime: string;
  endTime: string;
  note: string;
  status: "open" | "approved" | "rejected";
  source: "request" | "direct";
  decidedBy: string;
  swapWith: string;
  swapWithUserId: string;
};

async function ensureTable() {
  await ensureShiftTable();
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "hotel_leave_requests" (
      "id" UUID NOT NULL,
      "hotel_tenant_id" UUID NOT NULL,
      "user_id" UUID NOT NULL,
      "created_by_id" UUID NOT NULL,
      "decided_by_id" UUID,
      "start_date" DATE NOT NULL,
      "end_date" DATE NOT NULL,
      "category" VARCHAR(20) NOT NULL,
      "duration" VARCHAR(20) NOT NULL,
      "start_time" VARCHAR(5) NOT NULL DEFAULT '',
      "end_time" VARCHAR(5) NOT NULL DEFAULT '',
      "note" TEXT NOT NULL DEFAULT '',
      "note_de" TEXT NOT NULL DEFAULT '',
      "note_it" TEXT NOT NULL DEFAULT '',
      "original_locale" VARCHAR(8) NOT NULL DEFAULT 'en',
      "status" VARCHAR(20) NOT NULL,
      "source" VARCHAR(20) NOT NULL DEFAULT 'REQUEST',
      "swap_with_user_id" UUID,
      "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "hotel_leave_requests_pkey" PRIMARY KEY ("id")
    )
  `);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "hotel_leave_requests_hotel_tenant_id_status_start_date_idx" ON "hotel_leave_requests"("hotel_tenant_id", "status", "start_date")`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "hotel_leave_requests_user_id_start_date_idx" ON "hotel_leave_requests"("user_id", "start_date")`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "hotel_leave_requests" ADD COLUMN IF NOT EXISTS "swap_with_user_id" UUID`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "hotel_leave_requests_swap_with_user_id_idx" ON "hotel_leave_requests"("swap_with_user_id")`);
}

function isoDate(value: Date | string) {
  if (typeof value === "string") return value.slice(0, 10);
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  return "";
}

function asPublic(row: {
  id: string;
  userId: string;
  startDate: Date | string;
  endDate: Date | string;
  category: string;
  duration: string;
  startTime: string;
  endTime: string;
  note: string;
  noteDe: string;
  noteIt: string;
  status: string;
  source: string;
  user: { firstName: string; lastName: string };
  decidedBy?: { firstName: string; lastName: string } | null;
  swapWith?: { firstName: string; lastName: string } | null;
  swapWithUserId?: string | null;
}, locale: string): PublicAbsence {
  const status = row.status === "APPROVED" ? "approved" : row.status === "REJECTED" ? "rejected" : "open";
  return {
    id: row.id,
    employee: `${row.user.firstName} ${row.user.lastName}`.trim(),
    empKey: row.userId,
    category: fromDbCategory(row.category),
    duration: fromDbDuration(row.duration),
    start: isoDate(row.startDate),
    end: isoDate(row.endDate),
    startTime: row.startTime,
    endTime: row.endTime,
    note: pickLocalized(row.note, row.noteDe, row.noteIt, locale),
    status,
    source: row.source === "DIRECT" ? "direct" : "request",
    decidedBy: personName(row.decidedBy),
    swapWith: personName(row.swapWith),
    swapWithUserId: row.swapWithUserId ?? "",
  };
}

const leaveInclude = {
  user: { select: { firstName: true, lastName: true } },
  decidedBy: { select: { firstName: true, lastName: true } },
  swapWith: { select: { firstName: true, lastName: true } },
} as const;

export async function listAbsences(actor: ScheduleActor, locale: string) {
  await ensureTable();
  const rows = await prisma.hotelLeaveRequest.findMany({
    where: actor.canManage
      ? { hotelTenantId: actor.hotel_tenant_id }
      : { hotelTenantId: actor.hotel_tenant_id, OR: [{ userId: actor.id }, { createdById: actor.id }, { swapWithUserId: actor.id }] },
    include: leaveInclude,
    orderBy: [{ createdAt: "desc" }],
  });
  return rows.map((row) => asPublic(row, locale));
}

export async function createAbsence(actor: ScheduleActor, body: Record<string, unknown> | null, locale: string) {
  await ensureTable();
  if (!body) return { error: "INVALID" as const };
  let userId = typeof body.userId === "string" ? body.userId : actor.id;
  if (!actor.canManage) userId = actor.id;
  if (!UUID.test(userId)) return { error: "INVALID" as const };
  const employee = await prisma.user.findFirst({
    where: { id: userId, hotelTenantId: actor.hotel_tenant_id, isDeleted: false, isActive: true },
    select: { id: true, firstName: true, lastName: true },
  });
  if (!employee) return { error: "INVALID" as const };

  const start = typeof body.start === "string" ? body.start : "";
  const end = typeof body.end === "string" && DATE.test(body.end) ? body.end : start;
  if (!DATE.test(start) || end < start) return { error: "INVALID_DATES" as const };
  const dates = datesInclusive(start, end);
  if (!dates.length) return { error: "INVALID_DATES" as const };

  const category = asLeaveCategory(body.category);
  if (!category) return { error: "INVALID_CATEGORY" as const };
  const duration = category === "swap" ? "full" : asLeaveDuration(body.duration) ?? "full";
  const startTime = parseTime(typeof body.startTime === "string" ? body.startTime : "");
  const endTime = parseTime(typeof body.endTime === "string" ? body.endTime : "");
  if (duration === "partial" && category !== "swap" && (!startTime || !endTime)) return { error: "INVALID_TIMES" as const };

  let swapWithUserId: string | null = null;
  let swapPartnerName = "";
  if (category === "swap") {
    const partnerId = typeof body.swapWithUserId === "string" ? body.swapWithUserId : "";
    if (!UUID.test(partnerId) || partnerId === userId) return { error: "INVALID_SWAP_PARTNER" as const };
    const partner = await prisma.user.findFirst({
      where: { id: partnerId, hotelTenantId: actor.hotel_tenant_id, isDeleted: false, isActive: true },
      select: { id: true, firstName: true, lastName: true },
    });
    if (!partner) return { error: "INVALID_SWAP_PARTNER" as const };
    swapWithUserId = partner.id;
    swapPartnerName = personName(partner);
  }

  const note = typeof body.note === "string" ? body.note.trim().slice(0, 2000) : "";
  const sourceLang = locale === "de" || locale === "it" ? locale : "en";
  const notes = await translateShiftNote(actor.hotel_tenant_id, sourceLang, note);
  const applyNow = actor.canManage && body.applyDirect === true;
  const status = applyNow ? "APPROVED" : "OPEN";
  const source = applyNow ? "DIRECT" : "REQUEST";

  const row = await prisma.$transaction(async (tx) => {
    const created = await tx.hotelLeaveRequest.create({
      data: {
        id: randomUUID(),
        hotelTenantId: actor.hotel_tenant_id,
        userId,
        createdById: actor.id,
        decidedById: applyNow ? actor.id : null,
        startDate: new Date(`${start}T00:00:00.000Z`),
        endDate: new Date(`${end}T00:00:00.000Z`),
        category: toDbCategory(category),
        duration: toDbDuration(duration),
        startTime: duration === "partial" ? startTime : "",
        endTime: duration === "partial" ? endTime : "",
        originalLocale: sourceLang,
        note: notes.en,
        noteDe: notes.de,
        noteIt: notes.it,
        status,
        source,
        swapWithUserId,
      },
      include: leaveInclude,
    });
    if (applyNow && category === "swap" && swapWithUserId) {
      await applySwapDays(tx, actor, { userId, otherUserId: swapWithUserId, dates });
    } else if (applyNow && category !== "swap") {
      await applyOffDays(tx, actor, {
        userId, dates, category, duration, startTime, endTime, notes, locale: sourceLang,
      });
    }
    if (!applyNow) {
      await notifyLeaveRequested(tx, actor.hotel_tenant_id, actor.id, personName(employee), category === "swap", swapPartnerName);
    }
    await recordAuditLog(tx, {
      hotelTenantId: actor.hotel_tenant_id,
      actorId: actor.id,
      action: "CREATE",
      entityType: category === "swap" ? "SWAP_REQUEST" : "LEAVE_REQUEST",
      entityId: created.id,
      changes: { after: { title: `${personName(employee)}${swapPartnerName ? ` ↔ ${swapPartnerName}` : ""} · ${start}${end !== start ? `–${end}` : ""} · ${category}` } },
    });
    return created;
  });
  return { absence: asPublic(row, locale) };
}

export async function decideAbsence(actor: ScheduleActor, id: string, status: "approved" | "rejected", locale: string) {
  await ensureTable();
  if (!actor.canManage || !UUID.test(id)) return { error: "FORBIDDEN" as const };
  const nextStatus = status === "approved" ? "APPROVED" : "REJECTED";
  const result = await prisma.$transaction(async (tx) => {
    const previous = await tx.hotelLeaveRequest.findFirst({
      where: { id, hotelTenantId: actor.hotel_tenant_id },
      include: leaveInclude,
    });
    if (!previous || previous.status !== "OPEN") return null;
    const category = fromDbCategory(previous.category);
    if (status === "approved" && category === "swap" && !previous.swapWithUserId) return null;
    const updated = await tx.hotelLeaveRequest.update({
      where: { id },
      data: { status: nextStatus, decidedById: actor.id },
      include: leaveInclude,
    });
    if (status === "approved") {
      const start = isoDate(previous.startDate);
      const end = isoDate(previous.endDate);
      const dates = datesInclusive(start, end);
      if (category === "swap" && previous.swapWithUserId) {
        await applySwapDays(tx, actor, { userId: previous.userId, otherUserId: previous.swapWithUserId, dates });
      } else if (category !== "swap") {
        await applyOffDays(tx, actor, {
          userId: previous.userId,
          dates,
          category,
          duration: fromDbDuration(previous.duration),
          startTime: previous.startTime,
          endTime: previous.endTime,
          notes: { en: previous.note, de: previous.noteDe, it: previous.noteIt },
          locale: previous.originalLocale === "de" || previous.originalLocale === "it" ? previous.originalLocale : "en",
        });
      }
    }
    const isSwap = fromDbCategory(previous.category) === "swap";
    await notifyLeaveDecided(tx, actor.hotel_tenant_id, previous.userId, actor.id, status === "approved", isSwap);
    if (isSwap && previous.swapWithUserId) {
      await notifyLeaveDecided(tx, actor.hotel_tenant_id, previous.swapWithUserId, actor.id, status === "approved", true);
    }
    const pairTitle = `${personName(previous.user)}${previous.swapWith ? ` ↔ ${personName(previous.swapWith)}` : ""}`;
    await recordAuditLog(tx, {
      hotelTenantId: actor.hotel_tenant_id,
      actorId: actor.id,
      action: "STATUS_CHANGE",
      entityType: isSwap ? "SWAP_REQUEST" : "LEAVE_REQUEST",
      entityId: id,
      changes: {
        before: { status: previous.status, title: pairTitle },
        after: { status: nextStatus, title: pairTitle },
      },
    });
    return updated;
  });
  if (!result) return { error: "NOT_FOUND" as const };
  return { absence: asPublic(result, locale) };
}
