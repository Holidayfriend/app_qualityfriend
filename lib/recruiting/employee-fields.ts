import type { RecruitingEmployee, RecruitingEmployeeStatus, RecruitingInactiveReason } from "../../app/generated/prisma/client";
import type { DeptId } from "../i18n/recruiting-messages";
import { mapDeptId } from "./application-fields";
import type { CertStatus, Employee, EmpStatus } from "./preview-data";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type EmployeeDepartment = { nameEn: string; nameDe: string; nameIt: string };

type EmployeeRow = RecruitingEmployee & { department?: EmployeeDepartment | null };

function text(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function initials(first: string, last: string) {
  return `${first[0] ?? ""}${last[0] ?? ""}`.toUpperCase() || "?";
}

function pickDeptName(dept: EmployeeDepartment | null | undefined, locale?: string) {
  if (!dept) return "";
  if (locale === "de" && dept.nameDe.trim()) return dept.nameDe;
  if (locale === "it" && dept.nameIt.trim()) return dept.nameIt;
  return dept.nameEn || dept.nameDe || dept.nameIt;
}

function formatDate(value: Date | null | undefined, locale?: string) {
  if (!value) return "";
  try {
    return value.toLocaleDateString(locale === "de" ? "de-DE" : locale === "it" ? "it-IT" : "en-GB");
  } catch {
    return value.toISOString().slice(0, 10);
  }
}

function isoDate(value: Date | null | undefined) {
  if (!value) return "";
  return value.toISOString().slice(0, 10);
}

function parseTags(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((tag) => text(tag, 80)).filter(Boolean).slice(0, 40);
}

function parseCertificates(value: unknown): Employee["certificates"] {
  if (!Array.isArray(value)) return [];
  const rows: Employee["certificates"] = [];
  for (const entry of value.slice(0, 40)) {
    if (!entry || typeof entry !== "object") continue;
    const item = entry as Record<string, unknown>;
    const name = item.name === "haccp" ? "haccp" : item.name === "safetyBasic" ? "safetyBasic" : null;
    if (!name) continue;
    const status: CertStatus =
      item.status === "expiring" || item.status === "expired" || item.status === "valid" ? item.status : "valid";
    rows.push({
      name,
      completed: text(item.completed, 40),
      expires: text(item.expires, 40),
      status,
    });
  }
  return rows;
}

function mapStatus(status: RecruitingEmployeeStatus | string): EmpStatus {
  return String(status).toLowerCase() === "inactive" ? "inactive" : "active";
}

function mapReason(reason: RecruitingInactiveReason | null | undefined): Employee["reason"] {
  if (reason === "PENSION") return "pension";
  if (reason === "RESIGNATION") return "resignation";
  return "";
}

export function toPublicEmployee(row: EmployeeRow, locale?: string): Employee {
  const deptName = pickDeptName(row.department, locale);
  const from = formatDate(row.employedFrom, locale);
  const to = formatDate(row.employedTo, locale);
  const employment = from && to ? `${from} – ${to}` : from || to || "";
  return {
    id: row.id,
    applicationId: row.applicationId,
    initials: initials(row.firstName, row.lastName),
    name: `${row.firstName} ${row.lastName}`.trim(),
    dept: mapDeptId(deptName) as DeptId,
    departmentId: row.departmentId,
    departmentName: deptName || "",
    status: mapStatus(row.status),
    reason: mapReason(row.inactiveReason),
    email: row.email || "",
    phone: row.phone || "",
    taxId: row.taxId || "",
    birthdate: isoDate(row.birthdate),
    birthplace: row.birthplace || "",
    employment,
    comments: row.comments || "",
    tags: parseTags(row.tags),
    certificates: parseCertificates(row.certificates),
  };
}

export function employeeAuditSnapshot(row: EmployeeRow) {
  const name = `${row.firstName} ${row.lastName}`.trim();
  return {
    en: name,
    de: name,
    it: name,
    title: name,
    status: row.status,
    departmentId: row.departmentId,
    applicationId: row.applicationId,
  };
}

function parseOptionalDate(value: unknown): Date | null | undefined {
  if (value === null || value === "") return null;
  if (typeof value !== "string") return undefined;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  return new Date(`${value}T00:00:00.000Z`);
}

export function parseManualEmployee(body: unknown) {
  if (!body || typeof body !== "object") return null;
  const data = body as Record<string, unknown>;
  const firstName = text(data.firstName, 120);
  const lastName = text(data.lastName, 120);
  const departmentId = typeof data.departmentId === "string" && uuid.test(data.departmentId) ? data.departmentId : "";
  if (!firstName || !lastName || !departmentId) return null;
  const birthdate = "birthdate" in data ? parseOptionalDate(data.birthdate) : null;
  const employedFrom = "employedFrom" in data ? parseOptionalDate(data.employedFrom) : null;
  const employedTo = "employedTo" in data ? parseOptionalDate(data.employedTo) : null;
  if (birthdate === undefined || employedFrom === undefined || employedTo === undefined) return null;
  return {
    firstName,
    lastName,
    departmentId,
    email: text(data.email, 320),
    phone: text(data.phone, 40),
    taxId: text(data.taxId, 64),
    birthdate,
    birthplace: text(data.birthplace, 180),
    employedFrom,
    employedTo,
    comments: text(data.comments, 8000),
  };
}

export function parseEmployeePatch(body: unknown) {
  if (!body || typeof body !== "object") return null;
  const data = body as Record<string, unknown>;
  const patch: {
    status?: RecruitingEmployeeStatus;
    inactiveReason?: RecruitingInactiveReason | null;
    taxId?: string;
    birthdate?: Date | null;
    birthplace?: string;
    employedFrom?: Date | null;
    employedTo?: Date | null;
    comments?: string;
    email?: string;
    phone?: string;
  } = {};
  if (typeof data.status === "string") {
    const status = data.status.toLowerCase();
    if (status !== "active" && status !== "inactive") return null;
    patch.status = status.toUpperCase() as RecruitingEmployeeStatus;
    if (status === "active") patch.inactiveReason = null;
  }
  if ("inactiveReason" in data) {
    if (data.inactiveReason === null || data.inactiveReason === "") patch.inactiveReason = null;
    else if (typeof data.inactiveReason === "string") {
      const reason = data.inactiveReason.toLowerCase();
      if (reason !== "pension" && reason !== "resignation") return null;
      patch.inactiveReason = reason.toUpperCase() as RecruitingInactiveReason;
    } else return null;
  }
  if (typeof data.taxId === "string") patch.taxId = text(data.taxId, 64);
  if (typeof data.birthplace === "string") patch.birthplace = text(data.birthplace, 180);
  if (typeof data.comments === "string") patch.comments = text(data.comments, 8000);
  if (typeof data.email === "string") patch.email = text(data.email, 320);
  if (typeof data.phone === "string") patch.phone = text(data.phone, 40);
  if ("birthdate" in data) {
    if (data.birthdate === null || data.birthdate === "") patch.birthdate = null;
    else if (typeof data.birthdate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(data.birthdate)) patch.birthdate = new Date(`${data.birthdate}T00:00:00.000Z`);
    else return null;
  }
  if ("employedFrom" in data) {
    if (data.employedFrom === null || data.employedFrom === "") patch.employedFrom = null;
    else if (typeof data.employedFrom === "string" && /^\d{4}-\d{2}-\d{2}$/.test(data.employedFrom)) patch.employedFrom = new Date(`${data.employedFrom}T00:00:00.000Z`);
    else return null;
  }
  if ("employedTo" in data) {
    if (data.employedTo === null || data.employedTo === "") patch.employedTo = null;
    else if (typeof data.employedTo === "string" && /^\d{4}-\d{2}-\d{2}$/.test(data.employedTo)) patch.employedTo = new Date(`${data.employedTo}T00:00:00.000Z`);
    else return null;
  }
  if (!Object.keys(patch).length) return null;
  return patch;
}

export function isEmployeeUuid(value: string) {
  return uuid.test(value);
}
