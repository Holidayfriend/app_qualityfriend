import "server-only";

import { randomUUID } from "node:crypto";
import { prisma } from "../prisma";
import { recordAuditLog } from "../audit/audit-service";
import { pickLocalized } from "../recruiting/job-fields";
import { addDaysIso } from "./week";
import { translateShiftNote } from "./translate";
import type { ScheduleActor } from "./access";

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
};

function parseTime(value: string) {
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
}, locale: string): PublicShift {
  const kind = row.kind === "OFF" ? "off" : row.kind === "VACATION" ? "vac" : "work";
  return {
    userId: row.userId,
    date: row.workDate.toISOString().slice(0, 10),
    kind,
    start: row.startTime,
    end: row.endTime,
    breakMins: row.breakMinutes,
    note: pickLocalized(row.note, row.noteDe, row.noteIt, locale),
    templateId: row.templateId ?? "",
  };
}

async function ensureTable() {
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
      "note" TEXT NOT NULL DEFAULT '',
      "note_de" TEXT NOT NULL DEFAULT '',
      "note_it" TEXT NOT NULL DEFAULT '',
      "original_locale" VARCHAR(8) NOT NULL DEFAULT 'en',
      "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "hotel_shifts_pkey" PRIMARY KEY ("id")
    )
  `);
  await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "hotel_shifts_hotel_tenant_id_user_id_work_date_key" ON "hotel_shifts"("hotel_tenant_id", "user_id", "work_date")`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "hotel_shifts_hotel_tenant_id_work_date_idx" ON "hotel_shifts"("hotel_tenant_id", "work_date")`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "hotel_shifts_user_id_work_date_idx" ON "hotel_shifts"("user_id", "work_date")`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "hotel_shifts_created_by_id_idx" ON "hotel_shifts"("created_by_id")`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "hotel_shifts_template_id_idx" ON "hotel_shifts"("template_id")`);
}

export async function listWeekShifts(actor: ScheduleActor, weekStart: string, locale: string) {
  if (!DATE.test(weekStart)) return [];
  await ensureTable();
  const from = new Date(`${weekStart}T00:00:00.000Z`);
  const to = new Date(`${addDaysIso(weekStart, 6)}T00:00:00.000Z`);
  const rows = await prisma.hotelShift.findMany({
    where: { hotelTenantId: actor.hotel_tenant_id, workDate: { gte: from, lte: to } },
  });
  return rows.map((row) => asPublic(row, locale));
}

export async function saveShiftAssignment(actor: ScheduleActor, body: Record<string, unknown> | null, locale: string) {
  await ensureTable();
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
  if (preset === "off") kind = "OFF";
  else if (preset === "vac") kind = "VACATION";
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
  if (kind === "WORK" && (!start || !end)) return { error: "INVALID_TIMES" as const };

  const note = typeof body.note === "string" ? body.note.trim().slice(0, 2000) : "";
  const source = locale === "de" || locale === "it" ? locale : "en";
  const notes = await translateShiftNote(actor.hotel_tenant_id, source, note);

  const rawRepeat = Number(body.repeatWeeks);
  const repeatWeeks = Number.isInteger(rawRepeat) && rawRepeat >= 1 && rawRepeat <= 8 ? rawRepeat : 1;

  const dates = Array.from({ length: repeatWeeks }, (_, index) => addDaysIso(date, index * 7));
  await prisma.$transaction(async (tx) => {
    for (const workDate of dates) {
      const workDateValue = new Date(`${workDate}T00:00:00.000Z`);
      const existing = await tx.hotelShift.findFirst({
        where: { hotelTenantId: actor.hotel_tenant_id, userId, workDate: workDateValue },
        select: { id: true },
      });
      const data = {
        kind,
        templateId,
        startTime: kind === "WORK" ? start : "",
        endTime: kind === "WORK" ? end : "",
        breakMinutes: kind === "WORK" ? breakMins : 0,
        originalLocale: source,
        note: notes.en,
        noteDe: notes.de,
        noteIt: notes.it,
      };
      const row = existing
        ? await tx.hotelShift.update({ where: { id: existing.id }, data })
        : await tx.hotelShift.create({
          data: {
            id: randomUUID(),
            hotelTenantId: actor.hotel_tenant_id,
            userId,
            createdById: actor.id,
            workDate: workDateValue,
            ...data,
          },
        });
      await recordAuditLog(tx, {
        hotelTenantId: actor.hotel_tenant_id,
        actorId: actor.id,
        action: existing ? "UPDATE" : "CREATE",
        entityType: "SHIFT",
        entityId: row.id,
        changes: { after: { date: workDate, kind, start, end, note: notes.en } },
      });
    }
  });
  return { ok: true as const, dates, repeatWeeks };
}
