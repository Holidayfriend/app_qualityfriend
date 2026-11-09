import "server-only";

import { randomUUID } from "node:crypto";
import { completeHotelChatJson, HotelAiNotConfiguredError } from "../ai/complete";
import { prisma } from "../prisma";
import { pickLocalized } from "../recruiting/job-fields";
import type { ScheduleActor } from "./access";
import { listAbsences } from "./leaves";
import { listWeekShifts } from "./shifts";
import { formatDayHeader, mondayOfIso, parseIsoDate, weekIsoDates } from "./week";

type Locale = "en" | "de" | "it";
type Text = { title: string; body: string };

const DATE = /^\d{4}-\d{2}-\d{2}$/;

function localeOf(value: unknown): Locale {
  return value === "de" || value === "it" ? value : "en";
}

function clean(value: unknown, min: number, max: number) {
  if (typeof value !== "string") return "";
  const text = value.replace(/\s+/g, " ").trim();
  return text.length >= min && text.length <= max ? text : "";
}

function side(value: unknown): Text {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { title: "", body: "" };
  const row = value as { title?: unknown; body?: unknown };
  return { title: clean(row.title, 8, 160), body: clean(row.body, 12, 500) };
}

function same(left: string, right: string) {
  return left.length > 0 && left.toLowerCase() === right.toLowerCase();
}

export function suggestionFromAi(parsed: Record<string, unknown> | null, fallback: Record<Locale, Text>) {
  let en = side(parsed?.en);
  let de = side(parsed?.de);
  let it = side(parsed?.it);
  if (!en.title || !en.body) en = fallback.en;
  if (!de.title || !de.body || same(de.title, en.title) || same(de.body, en.body)) de = fallback.de;
  if (!it.title || !it.body || same(it.title, en.title) || same(it.body, en.body) || same(it.body, de.body)) it = fallback.it;
  return { en, de, it };
}

function deptName(row: { nameEn: string; nameDe: string | null; nameIt: string | null }, locale: Locale) {
  return pickLocalized(row.nameEn, row.nameDe || "", row.nameIt || "", locale);
}

export async function listScheduleSuggestion(actor: ScheduleActor, weekStart: string, locale: unknown) {
  const monday = DATE.test(weekStart) ? mondayOfIso(weekStart) : "";
  if (!monday) return null;
  const row = await prisma.scheduleAiSuggestion.findUnique({
    where: { hotelTenantId_weekStart: { hotelTenantId: actor.hotel_tenant_id, weekStart: parseIsoDate(monday) } },
  });
  if (!row?.titleEn) return null;
  const language = localeOf(locale);
  return {
    weekStart: monday,
    title: language === "de" ? row.titleDe || row.titleEn : language === "it" ? row.titleIt || row.titleEn : row.titleEn,
    body: language === "de" ? row.bodyDe || row.bodyEn : language === "it" ? row.bodyIt || row.bodyEn : row.bodyEn,
    generatedAt: row.generatedAt.toISOString(),
  };
}

export async function refreshScheduleSuggestion(actor: ScheduleActor, weekStart: string, locale: unknown) {
  const monday = DATE.test(weekStart) ? mondayOfIso(weekStart) : "";
  if (!monday) return { error: "INVALID_WEEK" as const };
  const dates = weekIsoDates(monday);
  const end = dates[6];
  const [users, shifts, absences] = await Promise.all([
    prisma.user.findMany({
      where: { hotelTenantId: actor.hotel_tenant_id, isActive: true, isDeleted: false },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      select: {
        id: true, firstName: true, lastName: true,
        department: { select: { id: true, nameEn: true, nameDe: true, nameIt: true, isDeleted: true } },
        departmentMemberships: { select: { department: { select: { id: true, nameEn: true, nameDe: true, nameIt: true, isDeleted: true } } } },
      },
    }),
    listWeekShifts(actor, monday, "en"),
    listAbsences(actor, "en"),
  ]);
  const departments = new Map<string, { nameEn: string; nameDe: string | null; nameIt: string | null }>();
  const deptIds = new Map<string, string[]>();
  for (const user of users) {
    const rows = [user.department, ...user.departmentMemberships.map((item) => item.department)].filter((row): row is NonNullable<typeof user.department> => Boolean(row && !row.isDeleted));
    for (const row of rows) departments.set(row.id, row);
    deptIds.set(user.id, [...new Set(rows.map((row) => row.id))]);
  }
  const names = new Map(users.map((user) => [user.id, `${user.firstName} ${user.lastName}`.trim()]));
  const gaps: Array<{ date: string; name: string; departmentId: string }> = [];
  for (const date of dates) {
    const day = shifts.filter((shift) => shift.date === date);
    const working = day.filter((shift) => shift.kind === "work");
    for (const absent of day.filter((shift) => shift.kind === "vac" || shift.kind === "off")) {
      for (const departmentId of deptIds.get(absent.userId) ?? []) {
        const covered = working.some((shift) => (deptIds.get(shift.userId) ?? []).includes(departmentId));
        if (!covered) gaps.push({ date, name: names.get(absent.userId) || absent.userId, departmentId });
      }
    }
  }
  const shiftLines = shifts.map((shift) => {
    const who = names.get(shift.userId) || shift.userId;
    const depts = (deptIds.get(shift.userId) ?? []).map((id) => departments.get(id)?.nameEn || id).join(", ") || "no department";
    const kind = shift.kind === "vac" ? "VACATION" : shift.kind === "off" ? "OFF" : "WORK";
    const times = shift.start && shift.end ? `${shift.start.slice(0, 5)}-${shift.end.slice(0, 5)}` : "full day";
    return `${who} | ${depts} | ${shift.date} | ${kind} ${times}${shift.draft ? " DRAFT" : ""}`;
  });
  const leaveLines = absences.filter((row) => row.status !== "rejected" && row.start <= end && row.end >= monday).slice(0, 30).map((row) => `${row.status} ${row.category} ${row.employee} ${row.start}${row.end !== row.start ? `-${row.end}` : ""}`);
  const gapLines = gaps.slice(0, 12).map((gap) => `${gap.date} ${gap.name} off, nobody else working in ${departments.get(gap.departmentId)?.nameEn || "department"}`);
  const fallback = fallbackText(monday, gaps, departments);
  let parsed: Record<string, unknown> | null = null;
  try {
    parsed = await completeHotelChatJson(prisma, actor.hotel_tenant_id, [
      {
        role: "system",
        content: "Write one short schedule alert in English, German, and Italian. Use only the names, dates, and gaps in the facts. If a gap is listed, use the first one. If no gap is listed, say this week is covered. Do not invent people, meals, breakfast, or jobs. Return JSON only: {\"en\":{\"title\":\"...\",\"body\":\"...\"},\"de\":{\"title\":\"...\",\"body\":\"...\"},\"it\":{\"title\":\"...\",\"body\":\"...\"}}. Title under 80 characters. Body is one sentence under 240 characters. German and Italian must be real translations.",
      },
      { role: "user", content: JSON.stringify({ weekStart: monday, shifts: shiftLines.slice(0, 120), leave: leaveLines, gaps: gapLines }) },
    ], { temperature: 0.2, timeoutMs: 60_000 });
  } catch (error) {
    if (!(error instanceof HotelAiNotConfiguredError)) console.error(JSON.stringify({ hotelTenantId: actor.hotel_tenant_id, error: error instanceof Error ? error.message : String(error) }));
  }
  const text = suggestionFromAi(parsed, fallback);
  const generatedAt = new Date();
  await prisma.scheduleAiSuggestion.upsert({
    where: { hotelTenantId_weekStart: { hotelTenantId: actor.hotel_tenant_id, weekStart: parseIsoDate(monday) } },
    create: {
      id: randomUUID(),
      hotelTenantId: actor.hotel_tenant_id,
      weekStart: parseIsoDate(monday),
      titleEn: text.en.title, titleDe: text.de.title, titleIt: text.it.title,
      bodyEn: text.en.body, bodyDe: text.de.body, bodyIt: text.it.body,
      generatedAt,
    },
    update: {
      titleEn: text.en.title, titleDe: text.de.title, titleIt: text.it.title,
      bodyEn: text.en.body, bodyDe: text.de.body, bodyIt: text.it.body,
      generatedAt,
    },
  });
  return listScheduleSuggestion(actor, monday, locale);
}

function fallbackText(monday: string, gaps: Array<{ date: string; name: string; departmentId: string }>, departments: Map<string, { nameEn: string; nameDe: string | null; nameIt: string | null }>): Record<Locale, Text> {
  const gap = gaps[0];
  if (!gap) {
    return {
      en: { title: `Week of ${monday} is covered`, body: "No saved absence leaves a department without someone working that day." },
      de: { title: `Woche vom ${monday} ist abgedeckt`, body: "Keine gespeicherte Abwesenheit lässt eine Abteilung an dem Tag ohne Mitarbeitende." },
      it: { title: `Settimana del ${monday} coperta`, body: "Nessuna assenza salvata lascia un reparto senza una persona al lavoro quel giorno." },
    };
  }
  const day = formatDayHeader(gap.date, "en");
  return {
    en: { title: `${day} ${deptName(departments.get(gap.departmentId) || { nameEn: "department", nameDe: "Abteilung", nameIt: "reparto" }, "en")} uncovered`, body: `${gap.name} is off and nobody else in that department is working.` },
    de: { title: `${formatDayHeader(gap.date, "de")} ${deptName(departments.get(gap.departmentId) || { nameEn: "department", nameDe: "Abteilung", nameIt: "reparto" }, "de")} unbesetzt`, body: `${gap.name} hat frei und niemand sonst aus der Abteilung arbeitet.` },
    it: { title: `${formatDayHeader(gap.date, "it")} ${deptName(departments.get(gap.departmentId) || { nameEn: "department", nameDe: "Abteilung", nameIt: "reparto" }, "it")} scoperto`, body: `${gap.name} è assente e nessun altro del reparto lavora.` },
  };
}
