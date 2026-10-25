import { shiftWorkHours, formatWorkHours } from "./hours";
import type { ShiftCell } from "./demo-data";
import { datesInclusive, type AbsenceStatus, type LeaveCategory, type LeaveDuration } from "./leave-fields";

export type ExportType = "shift" | "off" | "holiday" | "sick";
export type ExportDuration = "full" | "partial" | "";

export type ExportEntry = {
  date: string;
  employee: string;
  department: string;
  type: ExportType;
  start: string;
  end: string;
  breakMins: number;
  hours: number;
  duration: ExportDuration;
  note: string;
};

export type ExportPerson = { id: string; name: string; departmentId: string; departmentName: string };

export type ShiftExportRow = {
  userId: string;
  date: string;
  kind: "work" | "off" | "vac";
  start: string;
  end: string;
  breakMins: number;
  note: string;
  leaveCategory?: string;
  leaveDuration?: string;
};

export type AbsenceExportRow = {
  userId: string;
  start: string;
  end: string;
  category: LeaveCategory;
  duration: LeaveDuration;
  startTime: string;
  endTime: string;
  note: string;
  status: AbsenceStatus;
};

export function entriesFromShifts(people: ExportPerson[], shifts: ShiftExportRow[]): ExportEntry[] {
  const byId = new Map(people.map((person) => [person.id, person]));
  const rows: ExportEntry[] = [];
  for (const shift of shifts) {
    const person = byId.get(shift.userId);
    if (!person) continue;
    const cell: ShiftCell = {
      kind: shift.kind,
      start: shift.start,
      end: shift.end,
      breakMins: shift.breakMins,
      note: shift.note,
      templateId: "",
      leaveCategory: shift.leaveCategory === "paid" || shift.leaveCategory === "unpaid" || shift.leaveCategory === "paidSick" || shift.leaveCategory === "swap" || shift.leaveCategory === "vacation" ? shift.leaveCategory : "",
      leaveDuration: shift.leaveDuration === "full" || shift.leaveDuration === "partial" ? shift.leaveDuration : "",
      updatedBy: "",
      draft: false,
    };
    const type = cellExportType(cell);
    if (!type) continue;
    const work = type === "shift";
    rows.push({
      date: shift.date,
      employee: person.name,
      department: person.departmentName,
      type,
      start: work || cell.leaveDuration === "partial" ? cell.start.slice(0, 5) : "",
      end: work || cell.leaveDuration === "partial" ? cell.end.slice(0, 5) : "",
      breakMins: work ? Math.max(0, cell.breakMins) : 0,
      hours: shiftWorkHours(cell),
      duration: cell.leaveDuration === "partial" || cell.leaveDuration === "full" ? cell.leaveDuration : "",
      note: cell.note,
    });
  }
  return rows.sort((a, b) => a.date.localeCompare(b.date) || a.employee.localeCompare(b.employee));
}

export function entriesFromApprovedAbsences(people: ExportPerson[], absences: AbsenceExportRow[], from: string, to: string): ExportEntry[] {
  const byId = new Map(people.map((person) => [person.id, person]));
  const rows: ExportEntry[] = [];
  for (const absence of absences) {
    if (absence.status !== "approved" || absence.category === "swap") continue;
    const person = byId.get(absence.userId);
    if (!person) continue;
    const start = absence.start < from ? from : absence.start;
    const end = absence.end > to ? to : absence.end;
    const type: ExportType = absence.category === "vacation" ? "holiday" : absence.category === "paidSick" ? "sick" : "off";
    for (const date of datesInclusive(start, end)) {
      rows.push({
        date,
        employee: person.name,
        department: person.departmentName,
        type,
        start: absence.duration === "partial" ? absence.startTime.slice(0, 5) : "",
        end: absence.duration === "partial" ? absence.endTime.slice(0, 5) : "",
        breakMins: 0,
        hours: 0,
        duration: absence.duration,
        note: absence.note,
      });
    }
  }
  return rows.sort((a, b) => a.date.localeCompare(b.date) || a.employee.localeCompare(b.employee));
}

export function payrollExportEntries(people: ExportPerson[], shifts: ShiftExportRow[], absences: AbsenceExportRow[], from: string, to: string) {
  const work = entriesFromShifts(people, shifts.filter((shift) => shift.kind === "work"));
  const approvedAbsences = entriesFromApprovedAbsences(people, absences, from, to);
  return [...work, ...approvedAbsences].sort((a, b) => a.date.localeCompare(b.date) || a.employee.localeCompare(b.employee));
}

export type ExportTotal = { employee: string; department: string; hours: number };

export type CsvLabels = {
  headers: string[];
  types: Record<ExportType, string>;
  durationFull: string;
  durationPartial: string;
  total: string;
};

export type SchedulePrintLabels = {
  title: string;
  week: string;
  absent: string;
};

export function cellExportType(cell: ShiftCell | undefined): ExportType | null {
  if (!cell || cell.kind === "empty") return null;
  if (cell.kind === "work") return "shift";
  if (cell.kind === "vac") return "holiday";
  if (cell.leaveCategory === "paidSick") return "sick";
  return "off";
}

export function pdfCellLabel(cell: ShiftCell | undefined, absent: string, dash: string) {
  if (!cell || cell.kind === "empty") return dash;
  if (cell.kind === "off" || cell.kind === "vac") return absent;
  const start = cell.start.slice(0, 5);
  const end = cell.end.slice(0, 5);
  return start && end ? `${start}–${end}` : dash;
}

export function weekExportEntries(staff: { name: string; departmentName: string; shifts: ShiftCell[] }[], weekDates: string[]): ExportEntry[] {
  const rows: ExportEntry[] = [];
  for (const person of staff) {
    for (let index = 0; index < weekDates.length; index += 1) {
      const cell = person.shifts[index];
      const type = cellExportType(cell);
      if (!type || !cell) continue;
      const work = type === "shift";
      rows.push({
        date: weekDates[index],
        employee: person.name,
        department: person.departmentName,
        type,
        start: work || cell.leaveDuration === "partial" ? cell.start.slice(0, 5) : "",
        end: work || cell.leaveDuration === "partial" ? cell.end.slice(0, 5) : "",
        breakMins: work ? Math.max(0, cell.breakMins) : 0,
        hours: shiftWorkHours(cell),
        duration: cell.leaveDuration === "partial" || cell.leaveDuration === "full" ? cell.leaveDuration : "",
        note: cell.note,
      });
    }
  }
  return rows;
}

export function totalsByEmployee(entries: ExportEntry[]): ExportTotal[] {
  const map = new Map<string, ExportTotal>();
  for (const row of entries) {
    const current = map.get(row.employee) ?? { employee: row.employee, department: row.department, hours: 0 };
    current.hours += row.hours;
    map.set(row.employee, current);
  }
  return [...map.values()];
}

export function formatExportDate(iso: string, locale: string) {
  const match = iso.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return iso;
  const [, year, month, day] = match;
  if (locale === "de") return `${day}.${month}.${year}`;
  return `${day}/${month}/${year}`;
}

function typeFill(type: ExportType) {
  if (type === "shift") return { bg: "#DCFCE7", fg: "#166534" };
  if (type === "holiday") return { bg: "#DBEAFE", fg: "#1D4ED8" };
  if (type === "sick") return { bg: "#FEE2E2", fg: "#B91C1C" };
  return { bg: "#F3F4F6", fg: "#374151" };
}

function csvEscape(value: string, separator: string) {
  const text = value.replaceAll("\r\n", "\n").replaceAll("\r", "\n");
  if (text.includes('"') || text.includes("\n") || text.includes(separator)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

function htmlEscape(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function exportDates(from: string, to: string) {
  const rows: string[] = [];
  let current = from;
  while (current <= to && rows.length < 93) {
    rows.push(current);
    const next = new Date(`${current}T00:00:00.000Z`);
    next.setUTCDate(next.getUTCDate() + 1);
    current = next.toISOString().slice(0, 10);
  }
  return rows;
}

export function buildSchedulePrintHtml(entries: ExportEntry[], labels: SchedulePrintLabels, locale: string, from: string, to: string) {
  const dates = exportDates(from, to);
  const weeks = Array.from({ length: Math.ceil(dates.length / 7) }, (_, index) => dates.slice(index * 7, index * 7 + 7));
  const people = [...new Map(entries.map((entry) => [`${entry.employee}\u0000${entry.department}`, { employee: entry.employee, department: entry.department }])).values()]
    .sort((a, b) => a.employee.localeCompare(b.employee));
  const byCell = new Map<string, ExportEntry[]>();
  for (const entry of entries) {
    const key = `${entry.employee}\u0000${entry.department}\u0000${entry.date}`;
    byCell.set(key, [...(byCell.get(key) ?? []), entry]);
  }
  const dateLabel = (iso: string) => new Intl.DateTimeFormat(locale, { weekday: "short", day: "2-digit", month: "2-digit", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00.000Z`));
  const sections = weeks.map((week) => {
    const heading = `${labels.week} ${formatExportDate(week[0] ?? from, locale)}–${formatExportDate(week.at(-1) ?? to, locale)}`;
    const header = week.map((date) => `<th>${htmlEscape(dateLabel(date))}</th>`).join("");
    const rows = people.map((person) => {
      const cells = week.map((date) => {
        const values = byCell.get(`${person.employee}\u0000${person.department}\u0000${date}`) ?? [];
        const text = values.map((entry) => entry.type === "shift" ? `${entry.start || "–"}–${entry.end || "–"}` : labels.absent).join(" / ");
        const absent = values.some((entry) => entry.type !== "shift");
        return `<td class="${absent ? "absent" : ""}">${htmlEscape(text || "–")}</td>`;
      }).join("");
      return `<tr><th class="person">${htmlEscape(person.employee)}<small>${htmlEscape(person.department)}</small></th>${cells}</tr>`;
    }).join("");
    return `<section><h2>${htmlEscape(heading)}</h2><table><thead><tr><th class="person"></th>${header}</tr></thead><tbody>${rows}</tbody></table></section>`;
  }).join("");
  return `<!doctype html><html lang="${htmlEscape(locale)}"><head><meta charset="utf-8"><title>${htmlEscape(labels.title)}</title><style>
    @page{size:A4 landscape;margin:10mm}*{box-sizing:border-box}body{font:11px Arial,sans-serif;color:#172033;margin:0}h1{font-size:20px;margin:0 0 4px}p{color:#667085;margin:0 0 18px}section{break-after:page;margin-top:18px}section:last-child{break-after:auto}h2{font-size:13px;margin:0 0 8px}table{border-collapse:collapse;width:100%;table-layout:fixed}th,td{border:1px solid #cfd4dc;padding:7px 5px;text-align:center;vertical-align:middle}thead th{background:#1c2233;color:white}.person{width:150px;text-align:left}.person small{display:block;color:#667085;font-weight:400;margin-top:2px}thead .person small{color:white}.absent{background:#f3f4f6;font-weight:600}@media screen{body{padding:24px;max-width:1200px;margin:auto}}
  </style></head><body onload="setTimeout(function(){window.print()},150)"><h1>${htmlEscape(labels.title)}</h1><p>${htmlEscape(formatExportDate(from, locale))}–${htmlEscape(formatExportDate(to, locale))}</p>${sections}</body></html>`;
}

export function buildScheduleCsv(entries: ExportEntry[], totals: ExportTotal[], labels: CsvLabels, locale: string) {
  const separator = locale === "en" ? "," : ";";
  const decimal = locale === "en" ? "." : ",";
  const hours = (value: number) => formatWorkHours(value).replace(".", decimal);
  const duration = (value: ExportDuration) => (value === "partial" ? labels.durationPartial : value === "full" ? labels.durationFull : "");
  const lines = [
    labels.headers.map((header) => csvEscape(header, separator)).join(separator),
    ...entries.map((row) => [
      formatExportDate(row.date, locale),
      row.employee,
      row.department,
      labels.types[row.type],
      row.start,
      row.end,
      row.breakMins ? String(row.breakMins) : "",
      hours(row.hours),
      duration(row.duration),
      row.note,
    ].map((value) => csvEscape(value, separator)).join(separator)),
    "",
    ...totals.map((row) => [
      labels.total,
      row.employee,
      row.department,
      labels.total,
      "",
      "",
      "",
      hours(row.hours),
      "",
      "",
    ].map((value) => csvEscape(value, separator)).join(separator)),
  ];
  return `\uFEFF${lines.join("\r\n")}\r\n`;
}

export function buildScheduleExcelHtml(entries: ExportEntry[], totals: ExportTotal[], labels: CsvLabels, locale: string) {
  const decimal = locale === "en" ? "." : ",";
  const hours = (value: number) => formatWorkHours(value).replace(".", decimal);
  const duration = (value: ExportDuration) => (value === "partial" ? labels.durationPartial : value === "full" ? labels.durationFull : "");
  const cell = (value: string, extra = "") => `<td style="padding:6px 10px;border:1px solid #D1D5DB;white-space:nowrap;${extra}">${htmlEscape(value)}</td>`;
  const header = labels.headers.map((name) => cell(name, "background:#1C2233;color:#fff;font-weight:700;")).join("");
  const body = entries.map((row) => {
    const fill = typeFill(row.type);
    const paint = `background:${fill.bg};color:${fill.fg};`;
    return `<tr>${cell(formatExportDate(row.date, locale), `${paint}mso-number-format:'\\@';`)}${cell(row.employee, paint)}${cell(row.department, paint)}${cell(labels.types[row.type], `${paint}font-weight:700;`)}${cell(row.start, paint)}${cell(row.end, paint)}${cell(row.breakMins ? String(row.breakMins) : "", paint)}${cell(hours(row.hours), paint)}${cell(duration(row.duration), paint)}${cell(row.note, paint)}</tr>`;
  }).join("");
  const footer = totals.map((row) => {
    const paint = "background:#FEF3C7;color:#92400E;font-weight:700;";
    return `<tr>${cell(labels.total, paint)}${cell(row.employee, paint)}${cell(row.department, paint)}${cell(labels.total, paint)}${cell("", paint)}${cell("", paint)}${cell("", paint)}${cell(hours(row.hours), paint)}${cell("", paint)}${cell("", paint)}</tr>`;
  }).join("");
  return `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8" /></head><body><table border="1">${`<tr>${header}</tr>`}${body}${footer}</table></body></html>`;
}
