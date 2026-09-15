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

function parseIsoOrEmpty(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const de = trimmed.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (de) return `${de[3]}-${de[2]}-${de[1]}`;
  const month = trimmed.match(/^(\d{2})\.(\d{4})$/);
  if (month) return `${month[2]}-${month[1]}-01`;
  return null;
}

function certificateStatusFromExpires(expires: string): CertStatus {
  const iso = parseIsoOrEmpty(expires);
  if (!iso) return "valid";
  const end = new Date(`${iso}T00:00:00.000Z`);
  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  if (end.getTime() < today.getTime()) return "expired";
  const soon = new Date(today);
  soon.setUTCDate(soon.getUTCDate() + 90);
  if (end.getTime() <= soon.getTime()) return "expiring";
  return "valid";
}

export function parseCertificates(value: unknown): Employee["certificates"] {
  if (!Array.isArray(value)) return [];
  const rows: Employee["certificates"] = [];
  for (const entry of value.slice(0, 40)) {
    if (!entry || typeof entry !== "object") continue;
    const item = entry as Record<string, unknown>;
    const name = item.name === "haccp" ? "haccp" : item.name === "safetyBasic" ? "safetyBasic" : null;
    if (!name) continue;
    const completed = parseIsoOrEmpty(item.completed) || text(item.completed, 40);
    const expires = parseIsoOrEmpty(item.expires) || text(item.expires, 40);
    if (!completed || !expires) continue;
    rows.push({
      name,
      completed,
      expires,
      status: certificateStatusFromExpires(expires),
    });
  }
  return rows;
}

export function normalizeCertificatesInput(value: unknown): Employee["certificates"] | null {
  if (!Array.isArray(value) || value.length > 40) return null;
  const rows: Employee["certificates"] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") return null;
    const item = entry as Record<string, unknown>;
    const name = item.name === "haccp" ? "haccp" : item.name === "safetyBasic" ? "safetyBasic" : null;
    const completed = parseIsoOrEmpty(item.completed);
    const expires = parseIsoOrEmpty(item.expires);
    if (!name || !completed || !expires) return null;
    rows.push({ name, completed, expires, status: certificateStatusFromExpires(expires) });
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
    certificates?: Employee["certificates"];
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
  if ("certificates" in data) {
    const certificates = normalizeCertificatesInput(data.certificates);
    if (!certificates) return null;
    patch.certificates = certificates;
  }
  if (!Object.keys(patch).length) return null;
  return patch;
}

export function isEmployeeUuid(value: string) {
  return uuid.test(value);
}
