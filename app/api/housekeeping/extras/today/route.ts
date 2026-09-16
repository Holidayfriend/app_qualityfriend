import { Prisma } from "../../../../../app/generated/prisma/client";
import { getSessionUserId } from "../../../../../lib/auth/session";
import { housekeepingAccess } from "../../../../../lib/housekeeping/access";
import { prisma } from "../../../../../lib/prisma";

type Locale = "en" | "de" | "it";
const locale = (value: string | null): Locale => value === "de" || value === "it" ? value : "en";

function hotelDate(timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts();
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

function translated(activeLocale: Locale, item: { descriptionEn: string; descriptionDe: string; descriptionIt: string; descriptionSnapshot: string }) {
  const fromJob = activeLocale === "de" ? item.descriptionDe || item.descriptionEn : activeLocale === "it" ? item.descriptionIt || item.descriptionEn : item.descriptionEn;
  return fromJob || item.descriptionSnapshot;
}

async function actor() {
  const id = await getSessionUserId();
  if (!id) return null;
  const user = await prisma.user.findFirst({
    where: { id, isActive: true, isDeleted: false },
    select: { id: true, hotelTenantId: true, role: true, hotelTenant: { select: { timeZone: true } } },
  });
  if (!user) return null;
  const access = await housekeepingAccess({ id: user.id, hotel_tenant_id: user.hotelTenantId, role: user.role });
  if (!access.board) return null;
  return { user, access };
}

export async function GET(request: Request) {
  const current = await actor();
  if (!current) return Response.json({ error: "FORBIDDEN" }, { status: 403 });
  const { user, access } = current;
  const activeLocale = locale(new URL(request.url).searchParams.get("locale"));
  let date: string;
  try { date = hotelDate(user.hotelTenant.timeZone?.trim() || "UTC"); } catch { return Response.json({ error: "INVALID_HOTEL_TIME_ZONE" }, { status: 500 }); }

  const assignments = await prisma.housekeepingExtraJobAssignment.findMany({
    where: { hotelTenantId: user.hotelTenantId, workDate: new Date(`${date}T00:00:00.000Z`) },
    orderBy: [{ descriptionSnapshot: "asc" }, { id: "asc" }],
    select: {
      id: true,
      plannedMinutes: true,
      descriptionSnapshot: true,
      completedAt: true,
      assignedToId: true,
      assignedTo: { select: { id: true, firstName: true, lastName: true } },
      extraJob: { select: { descriptionEn: true, descriptionDe: true, descriptionIt: true } },
    },
  });

  const mapJob = (assignment: (typeof assignments)[number]) => ({
    assignmentId: assignment.id,
    description: translated(activeLocale, { ...assignment.extraJob, descriptionSnapshot: assignment.descriptionSnapshot }),
    minutes: assignment.plannedMinutes,
    completed: assignment.completedAt !== null,
    employeeId: assignment.assignedToId,
    employeeName: `${assignment.assignedTo.firstName} ${assignment.assignedTo.lastName}`.trim(),
  });

  const all = access.admin ? assignments.map(mapJob) : [];
  const mine = access.housekeeper ? assignments.filter((assignment) => assignment.assignedToId === user.id).map(mapJob) : [];

  return Response.json({
    date,
    canAdmin: access.admin,
    canHousekeeper: access.housekeeper,
    all,
    mine,
  }, { headers: { "Cache-Control": "no-store" } });
}

export async function PATCH(request: Request) {
  const current = await actor();
  if (!current) return Response.json({ error: "FORBIDDEN" }, { status: 403 });
  const { user, access } = current;
  if (!access.housekeeper && !access.admin) return Response.json({ error: "FORBIDDEN" }, { status: 403 });

  const body = await request.json().catch(() => null) as { assignmentId?: unknown; completed?: unknown } | null;
  const assignmentId = typeof body?.assignmentId === "string" ? body.assignmentId : "";
  if (!assignmentId || typeof body?.completed !== "boolean") return Response.json({ error: "INVALID_FIELDS" }, { status: 400 });

  let date: string;
  try { date = hotelDate(user.hotelTenant.timeZone?.trim() || "UTC"); } catch { return Response.json({ error: "INVALID_HOTEL_TIME_ZONE" }, { status: 500 }); }

  const assignment = await prisma.housekeepingExtraJobAssignment.findFirst({
    where: { id: assignmentId, hotelTenantId: user.hotelTenantId, workDate: new Date(`${date}T00:00:00.000Z`) },
    select: { id: true, assignedToId: true },
  });
  if (!assignment) return Response.json({ error: "NOT_FOUND" }, { status: 404 });
  if (!access.admin && assignment.assignedToId !== user.id) return Response.json({ error: "FORBIDDEN" }, { status: 403 });

  try {
    await prisma.housekeepingExtraJobAssignment.update({
      where: { id: assignment.id },
      data: { completedAt: body.completed ? new Date() : null },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) return Response.json({ error: "UPDATE_FAILED" }, { status: 409 });
    throw error;
  }

  return Response.json({ success: true, completed: body.completed });
}
