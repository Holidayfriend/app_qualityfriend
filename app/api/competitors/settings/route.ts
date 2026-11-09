import { NextResponse } from "next/server";
import { accessibleModules } from "../../../../lib/auth/module-access";
import { getSessionUserId } from "../../../../lib/auth/session";
import { recordAuditLog } from "../../../../lib/audit/audit-service";
import { findHotelLocation, LocationLookupError, parseCompetitorSettings } from "../../../../lib/competitors/location";
import { prisma } from "../../../../lib/prisma";
import { hasTrustedOrigin } from "../../../../lib/security/request-origin";

async function actor() {
  const id = await getSessionUserId();
  if (!id) return { error: "UNAUTHENTICATED" as const };
  const user = await prisma.user.findFirst({
    where: { id, isActive: true, isDeleted: false, hotelTenant: { isActive: true, subscriptionStatus: { in: ["ACTIVE", "COMPED"] } } },
    select: { id: true, hotelTenantId: true, role: true },
  });
  if (!user) return { error: "UNAUTHENTICATED" as const };
  const modules = await accessibleModules({ id: user.id, hotel_tenant_id: user.hotelTenantId, role: user.role });
  if (!modules.includes("competitors")) return { error: "FORBIDDEN" as const };
  return user;
}

function names(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

export async function GET() {
  const current = await actor();
  if ("error" in current) return NextResponse.json({ error: current.error }, { status: current.error === "FORBIDDEN" ? 403 : 401 });

  const hotel = await prisma.hotelTenant.findFirst({
    where: { id: current.hotelTenantId, isActive: true },
    select: { competitorSettings: true },
  });
  if (!hotel) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  const settings = hotel.competitorSettings;

  return NextResponse.json({
    latitude: settings?.latitude ?? null,
    longitude: settings?.longitude ?? null,
    locationCode: settings?.locationCode ?? null,
    locationName: settings?.locationName ?? null,
    mustInclude: names(settings?.mustInclude),
  });
}

export async function POST(request: Request) {
  if (!hasTrustedOrigin(request)) return NextResponse.json({ error: "FORBIDDEN_ORIGIN" }, { status: 403 });
  const current = await actor();
  if ("error" in current) return NextResponse.json({ error: current.error }, { status: current.error === "FORBIDDEN" ? 403 : 401 });

  const hotel = await prisma.hotelTenant.findFirst({
    where: { id: current.hotelTenantId, isActive: true },
    select: { city: true, country: true },
  });
  if (!hotel) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  try {
    const location = await findHotelLocation(hotel.city, hotel.country);
    const saved = await prisma.competitorSettings.upsert({
      where: { hotelTenantId: current.hotelTenantId },
      create: {
        hotelTenantId: current.hotelTenantId,
        locationCode: location.locationCode,
        locationName: location.locationName,
        mustInclude: [],
      },
      update: {
        locationCode: location.locationCode,
        locationName: location.locationName,
      },
    });
    return NextResponse.json({ locationCode: saved.locationCode, locationName: saved.locationName });
  } catch (error) {
    const code = error instanceof LocationLookupError ? error.code : "LOCATION_LOOKUP_FAILED";
    const status = code === "CREDENTIALS_MISSING" || code === "LOCATION_LOOKUP_FAILED" ? 502 : 400;
    return NextResponse.json({ error: code }, { status });
  }
}

export async function PUT(request: Request) {
  if (!hasTrustedOrigin(request)) return NextResponse.json({ error: "FORBIDDEN_ORIGIN" }, { status: 403 });
  const current = await actor();
  if ("error" in current) return NextResponse.json({ error: current.error }, { status: current.error === "FORBIDDEN" ? 403 : 401 });

  const parsed = parseCompetitorSettings(await request.json().catch(() => null));
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const hotel = await prisma.hotelTenant.findFirst({
    where: { id: current.hotelTenantId, isActive: true },
    select: { id: true },
  });
  if (!hotel) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  try {
    const saved = await prisma.$transaction(async (tx) => {
      const previous = await tx.competitorSettings.findUnique({ where: { hotelTenantId: current.hotelTenantId } });
      const next = await tx.competitorSettings.upsert({
        where: { hotelTenantId: current.hotelTenantId },
        create: {
          hotelTenantId: current.hotelTenantId,
          latitude: parsed.latitude,
          longitude: parsed.longitude,
          mustInclude: parsed.mustInclude,
        },
        update: {
          latitude: parsed.latitude,
          longitude: parsed.longitude,
          mustInclude: parsed.mustInclude,
        },
      });
      await recordAuditLog(tx, {
        module: "revenue",
        hotelTenantId: current.hotelTenantId,
        actorId: current.id,
        action: previous ? "UPDATE" : "CREATE",
        entityType: "COMPETITOR_SETTINGS",
        entityId: current.hotelTenantId,
        changes: {
          before: previous ? { latitude: previous.latitude, longitude: previous.longitude, locationCode: previous.locationCode, mustInclude: previous.mustInclude } : null,
          after: { latitude: next.latitude, longitude: next.longitude, locationCode: next.locationCode, mustInclude: next.mustInclude },
        },
      });
      return next;
    });

    return NextResponse.json({
      latitude: saved.latitude,
      longitude: saved.longitude,
      locationCode: saved.locationCode,
      locationName: saved.locationName,
      mustInclude: names(saved.mustInclude),
    });
  } catch (error) {
    const code = error instanceof LocationLookupError ? error.code : "LOCATION_LOOKUP_FAILED";
    const status = code === "CREDENTIALS_MISSING" || code === "LOCATION_LOOKUP_FAILED" ? 502 : 400;
    return NextResponse.json({ error: code }, { status });
  }
}
