import "server-only";

import { pickLocalized } from "../recruiting/job-fields";
import { getScheduleMessages } from "../i18n/schedule-messages";
import { prisma } from "../prisma";
import { scheduleEditor } from "./access";
import { buildScheduleCsv, buildScheduleExcelHtml, entriesFromShifts, totalsByEmployee, type CsvLabels } from "./export";
import { listShiftsInRange } from "./shifts";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

function csvLabels(locale: "en" | "de" | "it"): CsvLabels {
  const t = getScheduleMessages(locale);
  return {
    headers: [t.exportColDate, t.exportColEmployee, t.exportColDepartment, t.exportColType, t.exportColStart, t.exportColEnd, t.exportColBreak, t.exportColHours, t.exportColDuration, t.exportColNote],
    types: { shift: t.exportTypeShift, off: t.exportTypeOff, holiday: t.exportTypeHoliday, sick: t.exportTypeSick },
    durationFull: t.durationFull,
    durationPartial: t.durationPartial,
    total: t.exportTotal,
  };
}

export async function buildScheduleExport(input: {
  from: string;
  to: string;
  department: string;
  userId: string;
  locale: string;
}) {
  const actor = await scheduleEditor();
  if (!actor) return { error: "FORBIDDEN" as const };
  const from = DATE.test(input.from) ? input.from : "";
  const to = DATE.test(input.to) ? input.to : "";
  if (!from || !to) return { error: "DATES" as const };
  if (to < from) return { error: "RANGE" as const };
  const span = Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000) + 1;
  if (span > 93) return { error: "RANGE" as const };
  const locale = input.locale === "de" || input.locale === "it" ? input.locale : "en";
  const [users, shifts] = await Promise.all([
    prisma.user.findMany({
      where: { hotelTenantId: actor.hotel_tenant_id, isDeleted: false, isActive: true },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      select: {
        id: true,
        firstName: true,
        lastName: true,
        departmentId: true,
        department: { select: { nameEn: true, nameDe: true, nameIt: true, isDeleted: true } },
      },
    }),
    listShiftsInRange(actor, from, to, locale),
  ]);
  const people = users.map((row) => ({
    id: row.id,
    name: `${row.firstName} ${row.lastName}`.trim(),
    departmentId: row.department && !row.department.isDeleted ? row.departmentId ?? "" : "",
    departmentName: row.department && !row.department.isDeleted
      ? pickLocalized(row.department.nameEn, row.department.nameDe, row.department.nameIt, locale)
      : "",
  })).filter((person) => {
    if (input.userId && person.id !== input.userId) return false;
    if (input.department === "none") return !person.departmentId;
    if (input.department && input.department !== "all") return person.departmentId === input.department;
    return true;
  });
  const allowed = new Set(people.map((person) => person.id));
  const entries = entriesFromShifts(people, shifts.filter((row) => allowed.has(row.userId)));
  const labels = csvLabels(locale);
  const totals = totalsByEmployee(entries);
  return {
    locale,
    entries,
    totals,
    csv: buildScheduleCsv(entries, totals, labels, locale),
    xls: buildScheduleExcelHtml(entries, totals, labels, locale),
  };
}
