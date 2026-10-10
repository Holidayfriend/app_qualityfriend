import { canChangeApplicationStage } from "../../../../lib/recruiting/application-actions";
import { Prisma } from "../../../../app/generated/prisma/client";
import { prisma } from "../../../../lib/prisma";
import { recordAuditLog } from "../../../../lib/audit/audit-service";
import { hotelLocalIso } from "../../../../lib/hotel/clock";
import { hotelTimeZoneFor } from "../../../../lib/hotel/context";
import { recruitingActor } from "../../../../lib/recruiting/access";
import { parseApplicationNotes } from "../../../../lib/recruiting/application-fields";
import {
  employeeAuditSnapshot,
  isEmployeeUuid,
  parseManualEmployee,
  toPublicEmployee,
} from "../../../../lib/recruiting/employee-fields";

const departmentSelect = { select: { nameEn: true, nameDe: true, nameIt: true } } as const;

function hotelCalendarDate(timeZone: string) {
  return new Date(`${hotelLocalIso(timeZone)}T00:00:00.000Z`);
}

function employmentStart(startFrom: string, timeZone: string) {
  const value = startFrom.trim();
  const iso = value.match(/(\d{4})-(\d{2})(?:-(\d{2}))?/);
  if (iso) return new Date(Date.UTC(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3] || 1)));
  const full = value.match(/(\d{2})\.(\d{2})\.(\d{4})/);
  if (full) return new Date(Date.UTC(Number(full[3]), Number(full[2]) - 1, Number(full[1])));
  const month = value.match(/(\d{2})\.(\d{4})/);
  if (month) return new Date(Date.UTC(Number(month[2]), Number(month[1]) - 1, 1));
  return hotelCalendarDate(timeZone);
}

export async function GET(request: Request) {
  const actor = await recruitingActor();
  if (!actor) return Response.json({ error: "FORBIDDEN" }, { status: 403 });
  const locale = new URL(request.url).searchParams.get("locale") ?? "";
  const timeZone = await hotelTimeZoneFor(actor.hotel_tenant_id);
  const rows = await prisma.recruitingEmployee.findMany({
    where: { hotelTenantId: actor.hotel_tenant_id },
    orderBy: { createdAt: "desc" },
    include: { department: departmentSelect },
  });
  return Response.json({
    employees: rows.map((row) => toPublicEmployee(row, locale, timeZone)),
  }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const actor = await recruitingActor();
  if (!actor) return Response.json({ error: "FORBIDDEN" }, { status: 403 });
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return Response.json({ error: "INVALID_FIELDS" }, { status: 400 });
  const data = body as { applicationId?: unknown; locale?: unknown };
  const locale = typeof data.locale === "string" ? data.locale : "";
  const timeZone = await hotelTimeZoneFor(actor.hotel_tenant_id);

  if (typeof data.applicationId === "string") {
    const applicationId = data.applicationId;
    if (!isEmployeeUuid(applicationId)) return Response.json({ error: "INVALID_FIELDS" }, { status: 400 });
    try {
      const result = await prisma.$transaction(async (tx) => {
        const existing = await tx.recruitingEmployee.findFirst({
          where: { hotelTenantId: actor.hotel_tenant_id, applicationId },
          include: { department: departmentSelect },
        });
        if (existing) return { kind: "exists" as const, employee: existing };

        const application = await tx.recruitingApplication.findFirst({
          where: { id: applicationId, hotelTenantId: actor.hotel_tenant_id },
          include: { job: { select: { departmentId: true, startFrom: true } } },
        });
        if (!application) return { kind: "missing" as const };
        if (!canChangeApplicationStage(application.stage, "hired")) return { kind: "invalidStage" as const };

        const changed = await tx.recruitingApplication.updateMany({
          where: { id: application.id, hotelTenantId: actor.hotel_tenant_id, stage: application.stage, updatedAt: application.updatedAt },
          data: { stage: "HIRED" },
        });
        if (changed.count !== 1) return { kind: "invalidStage" as const };
        const notes = parseApplicationNotes(application.notes);
        const created = await tx.recruitingEmployee.create({
          data: {
            hotelTenantId: actor.hotel_tenant_id,
            applicationId: application.id,
            departmentId: application.job.departmentId,
            firstName: application.firstName,
            lastName: application.lastName,
            email: application.email,
            phone: application.phone,
            taxId: "",
            birthplace: "",
            employedFrom: employmentStart(application.job.startFrom, timeZone),
            comments: "",
            tags: notes.tags,
            certificates: [],
          },
          include: { department: departmentSelect },
        });
        await recordAuditLog(tx, { module: "recruiting",
          hotelTenantId: actor.hotel_tenant_id,
          actorId: actor.id,
          action: "CREATE",
          entityType: "RECRUITING_EMPLOYEE",
          entityId: created.id,
          changes: { after: employeeAuditSnapshot(created) },
        });
        await recordAuditLog(tx, { module: "recruiting",
          hotelTenantId: actor.hotel_tenant_id,
          actorId: actor.id,
          action: "STATUS_CHANGE",
          entityType: "RECRUITING_APPLICATION",
          entityId: application.id,
          changes: { before: { stage: application.stage }, after: { stage: "HIRED" } },
        });
        return { kind: "created" as const, employee: created };
      });
      if (result.kind === "invalidStage") return Response.json({ error: "INVALID_STAGE" }, { status: 409 });
      if (result.kind === "missing") return Response.json({ error: "NOT_FOUND" }, { status: 404 });
      return Response.json({
        employee: toPublicEmployee(result.employee, locale, timeZone),
        alreadyExists: result.kind === "exists",
      }, { status: result.kind === "created" ? 201 : 200 });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const existing = await prisma.recruitingEmployee.findFirst({
          where: { hotelTenantId: actor.hotel_tenant_id, applicationId: data.applicationId },
          include: { department: departmentSelect },
        });
        if (existing) return Response.json({ employee: toPublicEmployee(existing, locale, timeZone), alreadyExists: true });
      }
      throw error;
    }
  }

  const input = parseManualEmployee(body);
  if (!input) return Response.json({ error: "INVALID_FIELDS" }, { status: 400 });
  const department = await prisma.department.findFirst({
    where: { id: input.departmentId, hotelTenantId: actor.hotel_tenant_id, isDeleted: false, isActive: true },
    select: { id: true, nameEn: true, nameDe: true, nameIt: true },
  });
  if (!department) return Response.json({ error: "INVALID_FIELDS" }, { status: 400 });
  const created = await prisma.$transaction(async (tx) => {
    const employee = await tx.recruitingEmployee.create({
      data: {
        hotelTenantId: actor.hotel_tenant_id,
        departmentId: department.id,
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email,
        phone: input.phone,
        taxId: input.taxId,
        birthdate: input.birthdate,
        birthplace: input.birthplace,
        employedFrom: input.employedFrom ?? hotelCalendarDate(timeZone),
        employedTo: input.employedTo,
        comments: input.comments,
        tags: [],
        certificates: [],
      },
      include: { department: departmentSelect },
    });
    await recordAuditLog(tx, { module: "recruiting",
      hotelTenantId: actor.hotel_tenant_id,
      actorId: actor.id,
      action: "CREATE",
      entityType: "RECRUITING_EMPLOYEE",
      entityId: employee.id,
      changes: { after: employeeAuditSnapshot(employee) },
    });
    return employee;
  });
  return Response.json({ employee: toPublicEmployee(created, locale, timeZone) }, { status: 201 });
}
