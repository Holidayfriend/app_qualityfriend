import "server-only";

import { randomUUID } from "node:crypto";
import { completeHotelChatJson, HotelAiNotConfiguredError } from "../ai/complete";
import { prisma } from "../prisma";
import { pickLocalized } from "../recruiting/job-fields";
import type { ScheduleActor } from "./access";
import { activeHousekeeperIds } from "../housekeeping/active-housekeepers";
import { listAbsences } from "./leaves";
import { proposeShifts, type ShiftProposal } from "./shift-proposal";
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
  const language = localeOf(locale);
  const proposals = await weekShiftProposals(actor, monday, language);
  if (!row?.titleEn && proposals.length === 0) return null;
  return {
    weekStart: monday,
    title: row?.titleEn ? (language === "de" ? row.titleDe || row.titleEn : language === "it" ? row.titleIt || row.titleEn : row.titleEn) : "",
    body: row?.titleEn ? (language === "de" ? row.bodyDe || row.bodyEn : language === "it" ? row.bodyIt || row.bodyEn : row.bodyEn) : "",
    generatedAt: row?.generatedAt.toISOString() ?? "",
    proposals,
  };
}

export async function weekShiftProposals(actor: ScheduleActor, monday: string, locale: Locale): Promise<ShiftProposal[]> {
  const dates = weekIsoDates(monday);
  const [users, shifts, housekeepers, assignments] = await Promise.all([
    prisma.user.findMany({
      where: { hotelTenantId: actor.hotel_tenant_id, isActive: true, isDeleted: false },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      select: {
        id: true, firstName: true, lastName: true,
        department: { select: { nameEn: true, nameDe: true, nameIt: true, isDeleted: true } },
        departmentMemberships: { select: { department: { select: { nameEn: true, nameDe: true, nameIt: true, isDeleted: true } } } },
      },
    }),
    listWeekShifts(actor, monday, "en"),
    activeHousekeeperIds(prisma, actor.hotel_tenant_id),
    prisma.housekeepingRoomAssignment.findMany({
      where: { hotelTenantId: actor.hotel_tenant_id, workDate: { gte: parseIsoDate(monday), lte: parseIsoDate(dates[6]) } },
      select: { workDate: true, assignedToId: true },
    }),
  ]);
  const roomGroups = new Map<string, number>();
  for (const row of assignments) {
    const key = `${row.assignedToId ?? ""}|${row.workDate.toISOString().slice(0, 10)}`;
    roomGroups.set(key, (roomGroups.get(key) ?? 0) + 1);
  }
  return proposeShifts({
    dates,
    people: users.map((user) => {
      const rows = [user.department, ...user.departmentMemberships.map((item) => item.department)].filter((row): row is NonNullable<typeof user.department> => Boolean(row && !row.isDeleted));
      return {
        id: user.id,
        name: `${user.firstName} ${user.lastName}`.trim(),
        departments: [...new Set(rows.map((row) => deptName(row, locale)))],
        housekeeper: housekeepers.has(user.id),
      };
    }),
    shifts: shifts.map((shift) => ({ userId: shift.userId, date: shift.date, kind: shift.kind, start: shift.start, end: shift.end })),
    rooms: [...roomGroups.entries()].map(([key, rooms]) => {
      const split = key.indexOf("|");
      return { userId: key.slice(0, split) || null, date: key.slice(split + 1), rooms };
    }),
  });
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
  const assigned = new Set(shifts.map((shift) => `${shift.userId}|${shift.date}`));
  const unassigned = users.flatMap((user) => {
    const missing = dates.filter((date) => !assigned.has(`${user.id}|${date}`));
    return missing.length ? [{ name: names.get(user.id) || user.id, days: missing.length }] : [];
  });
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
  const gapLines = gaps.slice(0, 8).map((gap) => `${gap.date} ${gap.name} is off and nobody else is working in ${departments.get(gap.departmentId)?.nameEn || "that department"}`);
  const unassignedLines = unassigned.map((row) => row.days === dates.length ? `${row.name} has no shift on any day` : `${row.name} has no shift on ${row.days} days`);
  const fallback = fallbackText(monday, unassigned, gaps, departments);
  let parsed: Record<string, unknown> | null = null;
  try {
    parsed = await completeHotelChatJson(prisma, actor.hotel_tenant_id, [
      {
        role: "system",
        content: "Write one short schedule alert in English, German, and Italian. A blank day is not assigned. It is not a day off, and the week is not covered while any unassigned line exists. If unassigned is not empty, name those people and the number of days, and do not say the week is covered. Mention one department gap only when gaps is not empty. If both lists are empty, say the week is covered. Do not invent people, meals, breakfast, or jobs. Return JSON only: {\"en\":{\"title\":\"...\",\"body\":\"...\"},\"de\":{\"title\":\"...\",\"body\":\"...\"},\"it\":{\"title\":\"...\",\"body\":\"...\"}}. Title under 80 characters. Body is one or two sentences under 320 characters. German and Italian must be real translations.",
      },
      { role: "user", content: JSON.stringify({ weekStart: monday, shifts: shiftLines.slice(0, 120), leave: leaveLines, unassigned: unassignedLines, gaps: gapLines }) },
    ], { temperature: 0.2, timeoutMs: 60_000 });
  } catch (error) {
    if (!(error instanceof HotelAiNotConfiguredError)) console.error(JSON.stringify({ hotelTenantId: actor.hotel_tenant_id, error: error instanceof Error ? error.message : String(error) }));
  }
  const text = suggestionFromAi(parsed, fallback);
  if (unassigned.length && [text.en, text.de, text.it].some((item) => /covered|abgedeckt|coperta/i.test(`${item.title} ${item.body}`))) {
    text.en = fallback.en;
    text.de = fallback.de;
    text.it = fallback.it;
  }
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

function nameList(names: string[], locale: Locale) {
  if (names.length <= 1) return names[0] ?? "";
  const last = names[names.length - 1];
  const rest = names.slice(0, -1).join(", ");
  const join = locale === "de" ? " und " : locale === "it" ? " e " : " and ";
  return `${rest}${join}${last}`;
}

function fallbackText(monday: string, unassigned: Array<{ name: string; days: number }>, gaps: Array<{ date: string; name: string; departmentId: string }>, departments: Map<string, { nameEn: string; nameDe: string | null; nameIt: string | null }>): Record<Locale, Text> {
  if (unassigned.length) {
    const whole = unassigned.filter((row) => row.days === 7).map((row) => row.name);
    const partial = unassigned.filter((row) => row.days < 7);
    const partialEn = partial.map((row) => `${row.name} has no shift on ${row.days} days`).join(". ");
    const partialDe = partial.map((row) => `${row.name} hat an ${row.days} Tagen keine Schicht`).join(". ");
    const partialIt = partial.map((row) => `${row.name} non ha un turno per ${row.days} giorni`).join(". ");
    return {
      en: { title: "Shifts are not assigned", body: [whole.length ? `${nameList(whole, "en")} ${whole.length === 1 ? "has" : "have"} no shift on any day this week.` : "", partialEn].filter(Boolean).join(" ") },
      de: { title: "Schichten sind nicht eingeteilt", body: [whole.length ? `${nameList(whole, "de")} ${whole.length === 1 ? "hat" : "haben"} diese Woche an keinem Tag eine Schicht.` : "", partialDe].filter(Boolean).join(" ") },
      it: { title: "Turni non assegnati", body: [whole.length ? `${nameList(whole, "it")} non ${whole.length === 1 ? "ha" : "hanno"} nessun turno in questa settimana.` : "", partialIt].filter(Boolean).join(" ") },
    };
  }
  const gap = gaps[0];
  if (!gap) {
    return {
      en: { title: `Week of ${monday} is covered`, body: "Every person has a shift or an absence on each day, and each absence has someone working in that department." },
      de: { title: `Woche vom ${monday} ist abgedeckt`, body: "Jede Person hat an jedem Tag eine Schicht oder eine Abwesenheit, und für jede Abwesenheit arbeitet jemand in der Abteilung." },
      it: { title: `Settimana del ${monday} coperta`, body: "Ogni persona ha un turno o un'assenza in ogni giorno, e per ogni assenza lavora qualcuno nel reparto." },
    };
  }
  const day = formatDayHeader(gap.date, "en");
  return {
    en: { title: `${day} ${deptName(departments.get(gap.departmentId) || { nameEn: "department", nameDe: "Abteilung", nameIt: "reparto" }, "en")} uncovered`, body: `${gap.name} is off and nobody else in that department is working.` },
    de: { title: `${formatDayHeader(gap.date, "de")} ${deptName(departments.get(gap.departmentId) || { nameEn: "department", nameDe: "Abteilung", nameIt: "reparto" }, "de")} unbesetzt`, body: `${gap.name} hat frei und niemand sonst aus der Abteilung arbeitet.` },
    it: { title: `${formatDayHeader(gap.date, "it")} ${deptName(departments.get(gap.departmentId) || { nameEn: "department", nameDe: "Abteilung", nameIt: "reparto" }, "it")} scoperto`, body: `${gap.name} è assente e nessun altro del reparto lavora.` },
  };
}
