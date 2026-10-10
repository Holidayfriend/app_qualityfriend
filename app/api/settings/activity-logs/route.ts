import { NextResponse } from "next/server";
import type { Prisma } from "../../../../app/generated/prisma/client";
import { getSessionUserId } from "../../../../lib/auth/session";
import { hotelDayStart } from "../../../../lib/hotel/clock";
import { hotelTimeZoneFor } from "../../../../lib/hotel/context";
import { prisma } from "../../../../lib/prisma";

const auditModules = new Set([
  "settings",
  "manuals",
  "recruiting",
  "revenue",
  "schedule",
  "notes",
  "repairs",
  "housekeeping",
  "tasks",
  "handovers",
]);

export async function GET(request: Request) {
  const id = await getSessionUserId();
  if (!id) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const actor = await prisma.user.findFirst({
    where: { id, isActive: true, isDeleted: false },
    select: {
      id: true,
      hotelTenantId: true,
      role: true,
      hotelTenant: { select: { hotelNameEn: true, hotelNameDe: true, hotelNameIt: true } },
    },
  });
  if (!actor) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const admin = actor.role === "ADMIN";
  const url = new URL(request.url);
  const requestedUserId = url.searchParams.get("userId");
  const requestedDate = url.searchParams.get("date");
  const requestedModule = url.searchParams.get("module");
  const search = (url.searchParams.get("search") ?? "").trim().slice(0, 100);
  const validDate = requestedDate && /^\d{4}-\d{2}-\d{2}$/.test(requestedDate) ? requestedDate : null;
  const moduleFilter = requestedModule && auditModules.has(requestedModule) ? requestedModule : null;

  let userFilter = admin ? null : actor.id;
  if (admin && requestedUserId) {
    const allowed = await prisma.user.findFirst({
      where: { id: requestedUserId, hotelTenantId: actor.hotelTenantId },
      select: { id: true },
    });
    userFilter = allowed?.id ?? null;
  }

  const timeZone = await hotelTimeZoneFor(actor.hotelTenantId);
  const dateFilter = validDate
    ? (() => {
        const noon = new Date(validDate + "T12:00:00.000Z");
        return {
          gte: hotelDayStart(timeZone, noon),
          lt: hotelDayStart(timeZone, new Date(noon.getTime() + 86_400_000)),
        };
      })()
    : undefined;

  const where: Prisma.AuditLogWhereInput = {
    hotelTenantId: actor.hotelTenantId,
    ...(userFilter ? { actorId: userFilter } : {}),
    ...(moduleFilter ? { module: moduleFilter } : {}),
    ...(dateFilter ? { createdAt: dateFilter } : {}),
    ...(search
      ? {
          OR: [
            { entityType: { contains: search, mode: "insensitive" } },
            { action: { contains: search, mode: "insensitive" } },
            { description: { path: ["en"], string_contains: search } },
            { description: { path: ["de"], string_contains: search } },
            { description: { path: ["it"], string_contains: search } },
            {
              actor: {
                is: {
                  OR: [
                    { firstName: { contains: search, mode: "insensitive" } },
                    { lastName: { contains: search, mode: "insensitive" } },
                    { email: { contains: search, mode: "insensitive" } },
                  ],
                },
              },
            },
          ],
        }
      : {}),
  };

  const [logs, users] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 250,
      include: { actor: { select: { firstName: true, lastName: true } } },
    }),
    admin
      ? prisma.user.findMany({
          where: { hotelTenantId: actor.hotelTenantId, isDeleted: false },
          orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
          select: { id: true, firstName: true, lastName: true },
        })
      : Promise.resolve([]),
  ]);

  return NextResponse.json({
    canViewAll: admin,
    hotel: {
      en: actor.hotelTenant.hotelNameEn,
      de: actor.hotelTenant.hotelNameDe,
      it: actor.hotelTenant.hotelNameIt,
    },
    logs: logs.map((log) => ({
      id: log.id,
      module: log.module,
      action: log.action,
      entity_type: log.entityType,
      entity_id: log.entityId,
      changes: log.changes,
      description: log.description,
      created_at: log.createdAt,
      actor_name: log.actor ? log.actor.firstName + " " + log.actor.lastName : "Deleted user",
    })),
    users: users.map((user) => ({
      id: user.id,
      first_name: user.firstName,
      last_name: user.lastName,
    })),
  });
}
