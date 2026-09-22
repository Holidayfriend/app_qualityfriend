import "server-only";

import { randomUUID } from "node:crypto";
import { prisma } from "../prisma";
import { recordAuditLog } from "../audit/audit-service";
import { pickLocalized } from "../recruiting/job-fields";
import { translateShiftTemplateFields } from "./translate";
import type { ScheduleActor } from "./access";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type PublicShiftTemplate = {
  id: string;
  name: string;
  start: string;
  end: string;
  breakMins: number;
  note: string;
};

type TemplateRow = {
  id: string;
  name: string;
  nameDe: string;
  nameIt: string;
  startTime: string;
  endTime: string;
  breakMinutes: number;
  note: string;
  noteDe: string;
  noteIt: string;
};

function namesOf(row: Pick<TemplateRow, "name" | "nameDe" | "nameIt">) {
  return { en: row.name, de: row.nameDe, it: row.nameIt };
}

function asTemplate(row: TemplateRow, locale: string): PublicShiftTemplate {
  return {
    id: row.id,
    name: pickLocalized(row.name, row.nameDe, row.nameIt, locale),
    start: row.startTime,
    end: row.endTime,
    breakMins: row.breakMinutes,
    note: pickLocalized(row.note, row.noteDe, row.noteIt, locale),
  };
}

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

async function ensureTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "hotel_shift_templates" (
      "id" UUID NOT NULL,
      "hotel_tenant_id" UUID NOT NULL,
      "created_by_id" UUID NOT NULL,
      "name" VARCHAR(180) NOT NULL,
      "name_de" VARCHAR(180) NOT NULL DEFAULT '',
      "name_it" VARCHAR(180) NOT NULL DEFAULT '',
      "start_time" VARCHAR(5) NOT NULL,
      "end_time" VARCHAR(5) NOT NULL,
      "break_minutes" INTEGER NOT NULL DEFAULT 0,
      "note" TEXT NOT NULL DEFAULT '',
      "note_de" TEXT NOT NULL DEFAULT '',
      "note_it" TEXT NOT NULL DEFAULT '',
      "original_locale" VARCHAR(8) NOT NULL DEFAULT 'en',
      "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "hotel_shift_templates_pkey" PRIMARY KEY ("id")
    )
  `);
  await prisma.$executeRawUnsafe(`ALTER TABLE "hotel_shift_templates" ADD COLUMN IF NOT EXISTS "name_de" VARCHAR(180) NOT NULL DEFAULT ''`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "hotel_shift_templates" ADD COLUMN IF NOT EXISTS "name_it" VARCHAR(180) NOT NULL DEFAULT ''`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "hotel_shift_templates" ADD COLUMN IF NOT EXISTS "note_de" TEXT NOT NULL DEFAULT ''`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "hotel_shift_templates" ADD COLUMN IF NOT EXISTS "note_it" TEXT NOT NULL DEFAULT ''`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "hotel_shift_templates" ADD COLUMN IF NOT EXISTS "original_locale" VARCHAR(8) NOT NULL DEFAULT 'en'`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "hotel_shift_templates_hotel_tenant_id_name_idx" ON "hotel_shift_templates"("hotel_tenant_id", "name")`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "hotel_shift_templates_created_by_id_idx" ON "hotel_shift_templates"("created_by_id")`);
}

export function parseTemplateInput(body: Record<string, unknown> | null) {
  if (!body) return null;
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 180) : "";
  const start = parseTime(typeof body.start === "string" ? body.start : "");
  const end = parseTime(typeof body.end === "string" ? body.end : "");
  const note = typeof body.note === "string" ? body.note.trim().slice(0, 2000) : "";
  const breakMins = parseBreakMins(body.breakMins);
  if (!name) return { error: "NAME_REQUIRED" as const };
  if (!start || !end) return { error: "INVALID_TIMES" as const };
  if (breakMins === null || breakMins < 0 || breakMins > 720) return { error: "INVALID_BREAK" as const };
  return { name, startTime: start, endTime: end, breakMinutes: breakMins, note };
}

async function localizedFields(hotelTenantId: string, locale: string, name: string, note: string) {
  const source = locale === "de" || locale === "it" ? locale : "en";
  const locales = await translateShiftTemplateFields(hotelTenantId, source, { name, note });
  return {
    originalLocale: source,
    name: locales.name.en,
    nameDe: locales.name.de,
    nameIt: locales.name.it,
    note: locales.note.en,
    noteDe: locales.note.de,
    noteIt: locales.note.it,
  };
}

export async function listShiftTemplates(actor: ScheduleActor, locale: string) {
  await ensureTable();
  const rows = await prisma.hotelShiftTemplate.findMany({
    where: { hotelTenantId: actor.hotel_tenant_id },
    orderBy: [{ name: "asc" }, { createdAt: "asc" }],
  });
  return rows.map((row) => asTemplate(row, locale));
}

export async function createShiftTemplate(actor: ScheduleActor, body: Record<string, unknown> | null, locale: string) {
  await ensureTable();
  const input = parseTemplateInput(body);
  if (!input || "error" in input) return input ?? { error: "INVALID" as const };
  const locales = await localizedFields(actor.hotel_tenant_id, locale, input.name, input.note);
  const row = await prisma.$transaction(async (tx) => {
    const created = await tx.hotelShiftTemplate.create({
      data: {
        id: randomUUID(),
        hotelTenantId: actor.hotel_tenant_id,
        createdById: actor.id,
        startTime: input.startTime,
        endTime: input.endTime,
        breakMinutes: input.breakMinutes,
        ...locales,
      },
    });
    await recordAuditLog(tx, {
      hotelTenantId: actor.hotel_tenant_id,
      actorId: actor.id,
      action: "CREATE",
      entityType: "SHIFT_TEMPLATE",
      entityId: created.id,
      changes: { after: namesOf(created) },
    });
    return created;
  });
  return { template: asTemplate(row, locale) };
}

export async function updateShiftTemplate(actor: ScheduleActor, id: string, body: Record<string, unknown> | null, locale: string) {
  await ensureTable();
  if (!UUID.test(id)) return { error: "NOT_FOUND" as const };
  const input = parseTemplateInput(body);
  if (!input || "error" in input) return input ?? { error: "INVALID" as const };
  const locales = await localizedFields(actor.hotel_tenant_id, locale, input.name, input.note);
  const result = await prisma.$transaction(async (tx) => {
    const previous = await tx.hotelShiftTemplate.findFirst({ where: { id, hotelTenantId: actor.hotel_tenant_id } });
    if (!previous) return null;
    const updated = await tx.hotelShiftTemplate.update({
      where: { id },
      data: {
        startTime: input.startTime,
        endTime: input.endTime,
        breakMinutes: input.breakMinutes,
        ...locales,
      },
    });
    await recordAuditLog(tx, {
      hotelTenantId: actor.hotel_tenant_id,
      actorId: actor.id,
      action: "UPDATE",
      entityType: "SHIFT_TEMPLATE",
      entityId: updated.id,
      changes: { before: namesOf(previous), after: namesOf(updated) },
    });
    return updated;
  });
  if (!result) return { error: "NOT_FOUND" as const };
  return { template: asTemplate(result, locale) };
}

export async function deleteShiftTemplate(actor: ScheduleActor, id: string) {
  await ensureTable();
  if (!UUID.test(id)) return { error: "NOT_FOUND" as const };
  const result = await prisma.$transaction(async (tx) => {
    const previous = await tx.hotelShiftTemplate.findFirst({ where: { id, hotelTenantId: actor.hotel_tenant_id } });
    if (!previous) return null;
    await tx.hotelShiftTemplate.delete({ where: { id } });
    await recordAuditLog(tx, {
      hotelTenantId: actor.hotel_tenant_id,
      actorId: actor.id,
      action: "DELETE",
      entityType: "SHIFT_TEMPLATE",
      entityId: previous.id,
      changes: { before: namesOf(previous) },
    });
    return previous;
  });
  if (!result) return { error: "NOT_FOUND" as const };
  return { ok: true as const };
}
