import { getSessionUserId } from "../../../../lib/auth/session";
import { hotelTimeZone } from "../../../../lib/hotel/clock";
import { housekeepingAccess } from "../../../../lib/housekeeping/access";
import { activeHousekeeperIds } from "../../../../lib/housekeeping/active-housekeepers";
import { ensureExtraJobComment } from "../../../../lib/housekeeping/ensure-extra-comment";
import { prisma } from "../../../../lib/prisma";

type Locale = "en" | "de" | "it";
const locale = (value: string | null): Locale => value === "de" || value === "it" ? value : "en";
const dateRe = /^\d{4}-\d{2}-\d{2}$/;

function hotelDate(timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts();
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

function asDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function translatedExtra(activeLocale: Locale, item: { descriptionEn: string; descriptionDe: string; descriptionIt: string; descriptionSnapshot: string }) {
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
  if (!access.admin) return null;
  return user;
}

export async function GET(request: Request) {
  const user = await actor();
  if (!user) return Response.json({ error: "FORBIDDEN" }, { status: 403 });

  const params = new URL(request.url).searchParams;
  const activeLocale = locale(params.get("locale"));
  let today: string;
  try { today = hotelDate(hotelTimeZone(user.hotelTenant.timeZone)); } catch { return Response.json({ error: "INVALID_HOTEL_TIME_ZONE" }, { status: 500 }); }

  const requested = params.get("date")?.trim() || today;
  if (!dateRe.test(requested)) return Response.json({ error: "INVALID_DATE" }, { status: 400 });
  const workDate = asDate(requested);
  await ensureExtraJobComment();

  const [dailyRuns, extras, rooms, housekeepers] = await Promise.all([
    prisma.housekeepingDailyRun.findMany({
      where: { hotelTenantId: user.hotelTenantId },
      orderBy: { workDate: "desc" },
      take: 60,
      select: { workDate: true, status: true, roomsGenerated: true, extrasGenerated: true },
    }),
    prisma.housekeepingExtraJobAssignment.findMany({
      where: { hotelTenantId: user.hotelTenantId, workDate },
      orderBy: [{ descriptionSnapshot: "asc" }, { id: "asc" }],
      select: {
        id: true,
        plannedMinutes: true,
        descriptionSnapshot: true,
        completedAt: true,
        assignedToId: true,
        assignedTo: { select: { firstName: true, lastName: true } },
        comments: {
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            text: true,
            createdAt: true,
            author: { select: { firstName: true, lastName: true } },
          },
        },
        extraJob: { select: { descriptionEn: true, descriptionDe: true, descriptionIt: true } },
      },
    }),
    prisma.housekeepingRoomAssignment.findMany({
      where: { hotelTenantId: user.hotelTenantId, workDate, cleaningType: { not: "NONE" } },
      orderBy: [{ room: { number: "asc" } }],
      select: {
        id: true,
        cleaningType: true,
        plannedMinutes: true,
        completedAt: true,
        assignedToId: true,
        room: { select: { number: true } },
        assignedTo: { select: { firstName: true, lastName: true } },
      },
    }),
    activeHousekeeperIds(prisma, user.hotelTenantId),
  ]);
  const openExtras = extras.filter((row) => row.completedAt || housekeepers.has(row.assignedToId));

  const mapExtra = (row: (typeof extras)[number]) => ({
    id: row.id,
    description: translatedExtra(activeLocale, { ...row.extraJob, descriptionSnapshot: row.descriptionSnapshot }),
    minutes: row.plannedMinutes,
    employeeName: `${row.assignedTo.firstName} ${row.assignedTo.lastName}`.trim(),
    comments: row.comments.map((item) => ({
      id: item.id,
      text: item.text,
      author: `${item.author.firstName} ${item.author.lastName}`.trim(),
      createdAt: item.createdAt.toISOString(),
    })),
    completedAt: row.completedAt?.toISOString() ?? null,
  });

  const mapRoom = (row: (typeof rooms)[number]) => ({
    id: row.id,
    number: row.room.number,
    cleaningType: row.cleaningType,
    minutes: row.plannedMinutes,
    employeeName: row.assignedTo && (row.completedAt || (row.assignedToId && housekeepers.has(row.assignedToId))) ? `${row.assignedTo.firstName} ${row.assignedTo.lastName}`.trim() : null,
    completedAt: row.completedAt?.toISOString() ?? null,
  });

  const availableDates = [...new Set([
    today,
    ...dailyRuns.map((run) => run.workDate.toISOString().slice(0, 10)),
    requested,
  ])].sort((a, b) => b.localeCompare(a));

  return Response.json({
    today,
    date: requested,
    availableDates,
    extrasCompleted: openExtras.filter((row) => row.completedAt).map(mapExtra),
    extrasMissing: openExtras.filter((row) => !row.completedAt).map(mapExtra),
    roomsClean: rooms.filter((row) => row.completedAt).map(mapRoom),
    roomsMissing: rooms.filter((row) => !row.completedAt).map(mapRoom),
  }, { headers: { "Cache-Control": "no-store" } });
}
