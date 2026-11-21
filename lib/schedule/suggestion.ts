import "server-only";

import { prisma } from "../prisma";
import { pickLocalized } from "../recruiting/job-fields";
import type { ScheduleActor } from "./access";
import { listAbsences } from "./leaves";
import { ensureShiftTable, listShiftsInRange, listWeekShifts } from "./shifts";
import { spanMinutes } from "./shift-rules";
import { addDaysIso, mondayOfIso, parseIsoDate, weekIsoDates } from "./week";
import { describePlan, planWeek, type PlanShift } from "./week-plan";

type Locale = "en" | "de" | "it";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

function localeOf(value: unknown): Locale {
  return value === "de" || value === "it" ? value : "en";
}

function iso(value: Date) {
  return value.toISOString().slice(0, 10);
}

function netHours(start: string, end: string, breakMins: number) {
  const mins = spanMinutes(start, end);
  if (mins == null) return 0;
  return Math.max(0, mins - Math.max(0, breakMins)) / 60;
}

function medianLow(values: number[]) {
  if (!values.length) return null;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.floor((sorted.length - 1) / 2)];
}

function datesBetween(start: string, end: string, from: string, to: string) {
  const dates: string[] = [];
  let cursor = start > from ? start : from;
  const last = end < to ? end : to;
  while (cursor <= last && dates.length < 14) {
    dates.push(cursor);
    cursor = addDaysIso(cursor, 1);
  }
  return dates;
}

export async function listScheduleSuggestion() {
  return null;
}

export async function refreshScheduleSuggestion(actor: ScheduleActor, weekStart: string, locale: unknown) {
  const monday = DATE.test(weekStart) ? mondayOfIso(weekStart) : "";
  if (!monday) return { error: "INVALID_WEEK" as const };
  const language = localeOf(locale);
  await ensureShiftTable();
  const dates = weekIsoDates(monday);
  const weekEnd = dates[6];
  const historyStart = addDaysIso(monday, -28);
  const priorStart = addDaysIso(monday, -6);
  const priorEnd = addDaysIso(monday, -1);
  const [users, shifts, priorRows, nextRows, history, absences, templates, stays] = await Promise.all([
    prisma.user.findMany({
      where: { hotelTenantId: actor.hotel_tenant_id, isActive: true, isDeleted: false },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      select: {
        id: true, firstName: true, lastName: true, departmentId: true,
        department: { select: { id: true, nameEn: true, nameDe: true, nameIt: true, isDeleted: true } },
        departmentMemberships: { select: { department: { select: { id: true, nameEn: true, nameDe: true, nameIt: true, isDeleted: true } } } },
      },
    }),
    listWeekShifts(actor, monday, language),
    listShiftsInRange(actor, priorStart, priorEnd, language),
    listShiftsInRange(actor, addDaysIso(monday, 7), addDaysIso(monday, 12), language),
    prisma.hotelShift.findMany({
      where: {
        hotelTenantId: actor.hotel_tenant_id,
        kind: "WORK",
        workDate: { gte: parseIsoDate(historyStart), lt: parseIsoDate(monday) },
      },
      select: { userId: true, workDate: true, startTime: true, endTime: true, breakMinutes: true },
    }),
    listAbsences(actor, language),
    prisma.hotelShiftTemplate.findMany({
      where: { hotelTenantId: actor.hotel_tenant_id },
      select: { id: true, name: true, nameDe: true, nameIt: true, startTime: true, endTime: true, breakMinutes: true },
    }),
    prisma.reservationRoomStay.findMany({
      where: {
        hotelTenantId: actor.hotel_tenant_id,
        arrivalDate: { lte: parseIsoDate(weekEnd) },
        departureDate: { gte: parseIsoDate(monday) },
        room: { isActive: true, archivedAt: null },
        reservation: { sourcePresent: true, status: { notIn: ["CANCELLED", "NO_SHOW"] } },
      },
      select: { arrivalDate: true, departureDate: true },
    }),
  ]);

  const weeksByUser = new Map<string, Map<string, { days: number; hours: number }>>();
  for (const row of history) {
    const date = iso(row.workDate);
    const week = mondayOfIso(date);
    const byWeek = weeksByUser.get(row.userId) ?? new Map<string, { days: number; hours: number }>();
    const current = byWeek.get(week) ?? { days: 0, hours: 0 };
    current.days += 1;
    current.hours += netHours(row.startTime, row.endTime, row.breakMinutes);
    byWeek.set(week, current);
    weeksByUser.set(row.userId, byWeek);
  }

  const people = users.flatMap((user) => {
    const home = user.department && !user.department.isDeleted
      ? user.department
      : user.departmentMemberships.map((item) => item.department).find((row) => row && !row.isDeleted) ?? null;
    if (!home) return [];
    const past = [...(weeksByUser.get(user.id)?.values() ?? [])];
    const reliable = past.length >= 2;
    const weeklyDays = reliable ? medianLow(past.map((week) => week.days)) ?? 5 : 5;
    const weeklyHours = reliable ? medianLow(past.map((week) => Math.round(week.hours * 10) / 10)) : null;
    return [{
      id: user.id,
      name: `${user.firstName} ${user.lastName}`.trim(),
      departmentId: home.id,
      departmentName: pickLocalized(home.nameEn, home.nameDe || "", home.nameIt || "", language),
      weeklyDays,
      weeklyHours,
    }];
  });

  const asPlanShift = (row: { userId: string; date: string; kind: "work" | "off" | "vac"; start: string; end: string; breakMins: number; leaveCategory?: string }): PlanShift => ({
    userId: row.userId,
    date: row.date,
    kind: row.kind,
    start: row.start,
    end: row.end,
    breakMins: row.breakMins,
    leaveCategory: row.leaveCategory || "",
  });

  const absenceDays = absences.flatMap((row) => {
    if (row.status === "rejected" || row.category === "swap") return [];
    const reason = row.category === "vacation" ? "vacation" as const : row.category === "paidSick" ? "sick" as const : "off" as const;
    return datesBetween(row.start, row.end, monday, weekEnd).map((date) => ({ userId: row.empKey, date, reason }));
  });

  const movements = dates.map((date) => {
    let arrivals = 0;
    let departures = 0;
    let stayovers = 0;
    let occupied = 0;
    for (const stay of stays) {
      const arrival = iso(stay.arrivalDate);
      const departure = iso(stay.departureDate);
      if (arrival === date) arrivals += 1;
      if (departure === date) departures += 1;
      if (arrival < date && date < departure) stayovers += 1;
      if (arrival <= date && departure >= date) occupied += 1;
    }
    return { date, arrivals, departures, stayovers, occupied };
  });

  const { proposals, problems } = planWeek({
    dates,
    people,
    shifts: shifts.map(asPlanShift),
    priorShifts: [...priorRows, ...nextRows].map(asPlanShift),
    absences: absenceDays,
    movements,
    templates: templates.map((template) => ({
      id: template.id,
      name: pickLocalized(template.name, template.nameDe, template.nameIt, language),
      start: template.startTime,
      end: template.endTime,
      breakMins: template.breakMinutes,
    })),
  });
  const text = describePlan(problems, language, proposals.length > 0);
  return { title: text.title, body: text.body, proposals };
}
