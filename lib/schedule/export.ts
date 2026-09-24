import { shiftWorkHours, formatWorkHours } from "./hours";
import type { ShiftCell } from "./demo-data";

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

export type ExportTotal = { employee: string; department: string; hours: number };

export type CsvLabels = {
  headers: string[];
  types: Record<ExportType, string>;
  durationFull: string;
  durationPartial: string;
  total: string;
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
