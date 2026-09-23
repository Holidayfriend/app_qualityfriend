import "server-only";

import { randomUUID } from "node:crypto";
import { prisma } from "../prisma";
import { recordAuditLog } from "../audit/audit-service";
import { pickLocalized } from "../recruiting/job-fields";
import { addDaysIso, datesFromThroughWeeks } from "./week";
import { translateShiftNote } from "./translate";
import { notifySchedulePublished } from "./notify";
import { Prisma } from "../../app/generated/prisma/client";
import {
  asLeaveCategory, asLeaveDuration, fromDbCategory, fromDbDuration, personName, toDbCategory, toDbDuration,
  type LeaveCategory, type LeaveDuration,
} from "./leave-fields";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export type PublicShift = {
  userId: string;
  date: string;
  kind: "work" | "off" | "vac";
  start: string;
  end: string;
  breakMins: number;
  note: string;
  templateId: string;
  leaveCategory: LeaveCategory | "";
  leaveDuration: LeaveDuration | "";
  updatedBy: string;
  draft: boolean;
};

export function parseTime(value: string) {
  const match = value.trim().match(/^(\d{1,2}):([0-5]\d)/);
  if (!match) return "";
  const hours = Number(match[1]);
  if (hours > 23) return "";
  return `${String(hours).padStart(2, "0")}:${match[2]}`;
}

function parseBreakMins(value: unknown) {
  if (value === "" || value == null) return 0;
  const amount = typeof value === "number" ? value : Number(String(value).trim());
  if (!Number.isFinite(amount)) return null;
  return Math.round(amount);
}

function asPublic(row: {
  userId: string;
  workDate: Date;
  kind: string;
  startTime: string;
  endTime: string;
  breakMinutes: number;
  note: string;
  noteDe: string;
  noteIt: string;
  templateId: string | null;
  leaveCategory?: string;
  leaveDuration?: string;
  createdBy?: { firstName: string; lastName: string } | null;
  updatedBy?: { firstName: string; lastName: string } | null;
}, locale: string, draft = false): PublicShift {
  const kind = row.kind === "OFF" ? "off" : row.kind === "VACATION" ? "vac" : "work";
  const leaveCategory = kind === "off" ? fromDbCategory(row.leaveCategory ?? "") : "";
  const leaveDuration = kind === "off" || kind === "vac" ? fromDbDuration(row.leaveDuration ?? "") : "";
  return {
    userId: row.userId,
    date: row.workDate.toISOString().slice(0, 10),
    kind,
    start: row.startTime,
    end: row.endTime,
    breakMins: row.breakMinutes,
    note: pickLocalized(row.note, row.noteDe, row.noteIt, locale),
    templateId: row.templateId ?? "",
    leaveCategory: kind === "off" ? leaveCategory : kind === "vac" ? "vacation" : "",
    leaveDuration,
    updatedBy: personName(row.updatedBy) || personName(row.createdBy),
    draft,
  };
}

export async function ensureShiftTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "hotel_shifts" (
      "id" UUID NOT NULL,
      "hotel_tenant_id" UUID NOT NULL,
      "user_id" UUID NOT NULL,
      "created_by_id" UUID NOT NULL,
      "template_id" UUID,
      "work_date" DATE NOT NULL,
      "kind" VARCHAR(20) NOT NULL,
      "start_time" VARCHAR(5) NOT NULL DEFAULT '',
      "end_time" VARCHAR(5) NOT NULL DEFAULT '',
      "break_minutes" INTEGER NOT NULL DEFAULT 0,
      "leave_category" VARCHAR(20) NOT NULL DEFAULT '',
      "leave_duration" VARCHAR(20) NOT NULL DEFAULT '',
      "note" TEXT NOT NULL DEFAULT '',
      "note_de" TEXT NOT NULL DEFAULT '',
      "note_it" TEXT NOT NULL DEFAULT '',
      "original_locale" VARCHAR(8) NOT NULL DEFAULT 'en',
      "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "hotel_shifts_pkey" PRIMARY KEY ("id")
    )
  `);
  await prisma.$executeRawUnsafe(`ALTER TABLE "hotel_shifts" ADD COLUMN IF NOT EXISTS "leave_category" VARCHAR(20) NOT NULL DEFAULT ''`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "hotel_shifts" ADD COLUMN IF NOT EXISTS "leave_duration" VARCHAR(20) NOT NULL DEFAULT ''`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "hotel_shifts" ADD COLUMN IF NOT EXISTS "updated_by_id" UUID`);
  await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "hotel_shifts_hotel_tenant_id_user_id_work_date_key" ON "hotel_shifts"("hotel_tenant_id", "user_id", "work_date")`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "hotel_shifts_hotel_tenant_id_work_date_idx" ON "hotel_shifts"("hotel_tenant_id", "work_date")`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "hotel_shifts_user_id_work_date_idx" ON "hotel_shifts"("user_id", "work_date")`);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "hotel_shift_drafts" (
      "id" UUID NOT NULL,
      "hotel_tenant_id" UUID NOT NULL,
      "user_id" UUID NOT NULL,
      "created_by_id" UUID NOT NULL,
      "template_id" UUID,
      "work_date" DATE NOT NULL,
      "kind" VARCHAR(20) NOT NULL,
      "start_time" VARCHAR(5) NOT NULL DEFAULT '',
      "end_time" VARCHAR(5) NOT NULL DEFAULT '',
      "break_minutes" INTEGER NOT NULL DEFAULT 0,
      "leave_category" VARCHAR(20) NOT NULL DEFAULT '',
      "leave_duration" VARCHAR(20) NOT NULL DEFAULT '',
      "note" TEXT NOT NULL DEFAULT '',
      "note_de" TEXT NOT NULL DEFAULT '',
      "note_it" TEXT NOT NULL DEFAULT '',
      "original_locale" VARCHAR(8) NOT NULL DEFAULT 'en',
      "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updated_by_id" UUID,
      CONSTRAINT "hotel_shift_drafts_pkey" PRIMARY KEY ("id")
    )
  `);
  await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "hotel_shift_drafts_hotel_tenant_id_user_id_work_date_key" ON "hotel_shift_drafts"("hotel_tenant_id", "user_id", "work_date")`);
}

type ShiftWrite = {
  kind: string;
  templateId: string | null;
  startTime: string;
  endTime: string;
  breakMinutes: number;
  leaveCategory: string;
  leaveDuration: string;
  originalLocale: string;
  note: string;
  noteDe: string;
  noteIt: string;
};

async function writeShiftRow(
  tx: Prisma.TransactionClient,
  table: "hotel_shifts" | "hotel_shift_drafts",
  actor: ScheduleActor,
  userId: string,
  workDate: string,
  data: ShiftWrite,
) {
  const id = randomUUID();
  await tx.$executeRawUnsafe(
    `INSERT INTO "${table}" (
      "id","hotel_tenant_id","user_id","created_by_id","updated_by_id","template_id","work_date","kind",
      "start_time","end_time","break_minutes","leave_category","leave_duration","original_locale",
      "note","note_de","note_it","created_at","updated_at"
    ) VALUES ($1,$2,$3,$4,$5,$6,$7::date,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
    ON CONFLICT ("hotel_tenant_id","user_id","work_date") DO UPDATE SET
      "kind"=EXCLUDED."kind",
      "template_id"=EXCLUDED."template_id",
      "start_time"=EXCLUDED."start_time",
      "end_time"=EXCLUDED."end_time",
      "break_minutes"=EXCLUDED."break_minutes",
      "leave_category"=EXCLUDED."leave_category",
      "leave_duration"=EXCLUDED."leave_duration",
      "original_locale"=EXCLUDED."original_locale",
      "note"=EXCLUDED."note",
      "note_de"=EXCLUDED."note_de",
      "note_it"=EXCLUDED."note_it",
      "updated_by_id"=EXCLUDED."updated_by_id",
      "updated_at"=CURRENT_TIMESTAMP`,
    id,
    actor.hotel_tenant_id,
    userId,
    actor.id,
    actor.id,
    data.templateId,
    workDate,
    data.kind,
    data.startTime,
    data.endTime,
    data.breakMinutes,
    data.leaveCategory,
    data.leaveDuration,
    data.originalLocale,
    data.note,
    data.noteDe,
    data.noteIt,
  );
}

export async function upsertShiftDays(
  tx: Prisma.TransactionClient,
  actor: ScheduleActor,
  userId: string,
  dates: string[],
  data: ShiftWrite,
) {
  for (const workDate of dates) {
    await writeShiftRow(tx, "hotel_shift_drafts", actor, userId, workDate, data);
  }
}

export async function applyOffDays(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  actor: ScheduleActor,
  input: {
    userId: string;
    dates: string[];
    category: LeaveCategory;
    duration: LeaveDuration;
    startTime: string;
    endTime: string;
    notes: { en: string; de: string; it: string };
    locale: string;
  },
) {
  if (input.category === "swap") return;
  const vacation = input.category === "vacation";
  const partial = input.duration === "partial";
  const data: ShiftWrite = {
    kind: vacation ? "VACATION" : "OFF",
    templateId: null,
    startTime: partial ? input.startTime : "",
    endTime: partial ? input.endTime : "",
    breakMinutes: 0,
    leaveCategory: vacation ? "" : toDbCategory(input.category),
    leaveDuration: toDbDuration(input.duration),
    originalLocale: input.locale,
    note: input.notes.en,
    noteDe: input.notes.de,
    noteIt: input.notes.it,
  };
  for (const workDate of input.dates) {
    await writeShiftRow(tx, "hotel_shifts", actor, input.userId, workDate, data);
  }
  await tx.hotelShiftDraft.deleteMany({
    where: {
      hotelTenantId: actor.hotel_tenant_id,
      userId: input.userId,
      workDate: { in: input.dates.map((date) => new Date(`${date}T00:00:00.000Z`)) },
    },
  });
}

function shiftKey(userId: string, workDate: Date | string) {
  const date = typeof workDate === "string" ? workDate.slice(0, 10) : workDate.toISOString().slice(0, 10);
  return `${userId}:${date}`;
}

export async function countShiftDrafts(actor: ScheduleActor) {
  if (!actor.canManage) return 0;
  await ensureShiftTable();
  try {
    return await prisma.hotelShiftDraft.count({ where: { hotelTenantId: actor.hotel_tenant_id } });
  } catch {
    return 0;
  }
}

export async function listWeekShifts(actor: ScheduleActor, weekStart: string, locale: string) {
  if (!DATE.test(weekStart)) return [];
  await ensureShiftTable();
  const from = new Date(`${weekStart}T00:00:00.000Z`);
  const to = new Date(`${addDaysIso(weekStart, 6)}T00:00:00.000Z`);
  const include = {
    createdBy: { select: { firstName: true, lastName: true } },
    updatedBy: { select: { firstName: true, lastName: true } },
  };
  const published = await prisma.hotelShift.findMany({
    where: { hotelTenantId: actor.hotel_tenant_id, workDate: { gte: from, lte: to } },
    include,
  });
  if (!actor.canManage) return published.map((row) => asPublic(row, locale, false));

  let drafts: Awaited<ReturnType<typeof prisma.hotelShiftDraft.findMany>> = [];
  try {
    drafts = await prisma.hotelShiftDraft.findMany({
      where: { hotelTenantId: actor.hotel_tenant_id, workDate: { gte: from, lte: to } },
      include,
    });
  } catch {
    drafts = [];
  }
  const merged = new Map<string, PublicShift>();
  for (const row of published) merged.set(shiftKey(row.userId, row.workDate), asPublic(row, locale, false));
  for (const row of drafts) merged.set(shiftKey(row.userId, row.workDate), asPublic(row, locale, true));
  return [...merged.values()];
}

export async function publishWeekShifts(actor: ScheduleActor) {
  await ensureShiftTable();
  const result = await prisma.$transaction(async (tx) => {
    const drafts = await tx.hotelShiftDraft.findMany({
      where: { hotelTenantId: actor.hotel_tenant_id },
    });
    for (const draft of drafts) {
      const existing = await tx.hotelShift.findFirst({
        where: { hotelTenantId: actor.hotel_tenant_id, userId: draft.userId, workDate: draft.workDate },
      });
      const payload = {
        kind: draft.kind,
        templateId: draft.templateId,
        startTime: draft.startTime,
        endTime: draft.endTime,
        breakMinutes: draft.breakMinutes,
        leaveCategory: draft.leaveCategory,
        leaveDuration: draft.leaveDuration,
        originalLocale: draft.originalLocale,
        note: draft.note,
        noteDe: draft.noteDe,
        noteIt: draft.noteIt,
        updatedById: actor.id,
      };
      if (existing) await tx.hotelShift.update({ where: { id: existing.id }, data: payload });
      else {
        await tx.hotelShift.create({
          data: {
            id: randomUUID(),
            hotelTenantId: actor.hotel_tenant_id,
            userId: draft.userId,
            createdById: actor.id,
            workDate: draft.workDate,
            ...payload,
          },
        });
      }
    }
    await tx.hotelShiftDraft.deleteMany({
      where: { hotelTenantId: actor.hotel_tenant_id },
    });
    const publishedUserIds = [...new Set(drafts.map((draft) => draft.userId))];
    await notifySchedulePublished(tx, actor.hotel_tenant_id, publishedUserIds, actor.id);
    await recordAuditLog(tx, {
      hotelTenantId: actor.hotel_tenant_id,
      actorId: actor.id,
      action: "STATUS_CHANGE",
      entityType: "SHIFT",
      entityId: randomUUID(),
      changes: { after: { title: `${drafts.length} cells`, status: "PUBLISHED", cells: drafts.length, employees: publishedUserIds.filter((id) => id !== actor.id).length } },
    });
    return { cells: drafts.length, employees: publishedUserIds.filter((id) => id !== actor.id).length };
  });
  return result;
}

export async function saveShiftAssignment(actor: ScheduleActor, body: Record<string, unknown> | null, locale: string) {
  await ensureShiftTable();
  if (!body) return { error: "INVALID" as const };
  const userId = typeof body.userId === "string" ? body.userId : "";
  const date = typeof body.date === "string" ? body.date : "";
  if (!UUID.test(userId) || !DATE.test(date)) return { error: "INVALID" as const };
  const employee = await prisma.user.findFirst({
    where: { id: userId, hotelTenantId: actor.hotel_tenant_id, isDeleted: false, isActive: true },
    select: { id: true },
  });
  if (!employee) return { error: "INVALID" as const };

  const preset = typeof body.template === "string" ? body.template : "";
  let kind = "WORK";
  let templateId: string | null = null;
  let leaveCategory = "";
  let leaveDuration = "";
  if (preset === "off") {
    kind = "OFF";
    const category = asLeaveCategory(body.leaveCategory) ?? "paid";
    const duration = asLeaveDuration(body.leaveDuration) ?? "full";
    leaveCategory = toDbCategory(category);
    leaveDuration = toDbDuration(duration);
  } else if (preset === "vac") {
    kind = "VACATION";
    leaveDuration = toDbDuration(asLeaveDuration(body.leaveDuration) ?? "full");
  }
  else if (UUID.test(preset)) {
    const template = await prisma.hotelShiftTemplate.findFirst({
      where: { id: preset, hotelTenantId: actor.hotel_tenant_id },
      select: { id: true },
    });
    if (!template) return { error: "INVALID" as const };
    templateId = template.id;
  }

  const start = parseTime(typeof body.start === "string" ? body.start : "");
  const end = parseTime(typeof body.end === "string" ? body.end : "");
  const breakMins = parseBreakMins(body.breakMins);
  if (breakMins === null || breakMins < 0 || breakMins > 720) return { error: "INVALID_BREAK" as const };
  const needsTimes = kind === "WORK" || ((kind === "OFF" || kind === "VACATION") && leaveDuration === "PARTIAL");
  if (needsTimes && (!start || !end)) return { error: "INVALID_TIMES" as const };

  const note = typeof body.note === "string" ? body.note.trim().slice(0, 2000) : "";
  const source = locale === "de" || locale === "it" ? locale : "en";
  const notes = await translateShiftNote(actor.hotel_tenant_id, source, note);

  const repeat = typeof body.repeat === "string" ? body.repeat : "";
  const dates = repeat === "thisWeek"
    ? datesFromThroughWeeks(date, 1)
    : Number.isInteger(Number(repeat)) && Number(repeat) >= 2 && Number(repeat) <= 8
      ? datesFromThroughWeeks(date, Number(repeat))
      : [date];
  const keepTimes = kind === "WORK" || leaveDuration === "PARTIAL";

  await prisma.$transaction(async (tx) => {
    await upsertShiftDays(tx, actor, userId, dates, {
      kind,
      templateId,
      startTime: keepTimes ? start : "",
      endTime: keepTimes ? end : "",
      breakMinutes: kind === "WORK" ? breakMins : 0,
      leaveCategory,
      leaveDuration,
      originalLocale: source,
      note: notes.en,
      noteDe: notes.de,
      noteIt: notes.it,
    });
    await recordAuditLog(tx, {
      hotelTenantId: actor.hotel_tenant_id,
      actorId: actor.id,
      action: "CREATE",
      entityType: "SHIFT_DRAFT",
      entityId: userId,
      changes: { after: { title: `${dates[0]}${dates.length > 1 ? ` +${dates.length - 1}` : ""} · ${kind}` } },
    });
  });
  return { ok: true as const, dates, dayCount: dates.length, repeat: dates.length === 1 ? "none" : repeat || "none" };
}
