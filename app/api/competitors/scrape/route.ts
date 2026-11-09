import { NextResponse } from "next/server";
import type { Prisma } from "../../../../app/generated/prisma/client";
import { accessibleModules } from "../../../../lib/auth/module-access";
import { getSessionUserId } from "../../../../lib/auth/session";
import { LocationLookupError, parseCompetitorSettings } from "../../../../lib/competitors/location";
import { searchCompetitorHotels } from "../../../../lib/competitors/scrape";
import { prisma } from "../../../../lib/prisma";
import { hasTrustedOrigin } from "../../../../lib/security/request-origin";

export const maxDuration = 360;

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

export async function POST(request: Request) {
  if (!hasTrustedOrigin(request)) return NextResponse.json({ error: "FORBIDDEN_ORIGIN" }, { status: 403 });
  const current = await actor();
  if ("error" in current) return NextResponse.json({ error: current.error }, { status: current.error === "FORBIDDEN" ? 403 : 401 });

  const parsed = parseCompetitorSettings(await request.json().catch(() => null));
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const hotel = await prisma.hotelTenant.findFirst({
    where: { id: current.hotelTenantId, isActive: true },
    select: {
      hotelNameEn: true,
      hotelNameDe: true,
      hotelNameIt: true,
      city: true,
      streetAddress: true,
      competitorSettings: { select: { locationCode: true } },
    },
  });
  if (!hotel) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  const hotelName = hotel.hotelNameEn.trim() || hotel.hotelNameDe.trim() || hotel.hotelNameIt.trim();
  const missing = [
    hotel.competitorSettings?.locationCode ? null : "LOCATION_ID",
    hotel.city.trim() ? null : "CITY",
    hotel.streetAddress.trim() ? null : "STREET",
    hotelName ? null : "NAME",
  ].filter((item): item is string => item !== null);
  if (missing.length) return NextResponse.json({ error: "MISSING_FIELDS", missing }, { status: 400 });

  const locationCode = hotel.competitorSettings!.locationCode!;
  try {
    const found = await searchCompetitorHotels({
      locationCode,
      latitude: parsed.latitude,
      longitude: parsed.longitude,
      city: hotel.city,
      streetAddress: hotel.streetAddress,
      hotelName,
      mustInclude: parsed.mustInclude,
    });
    const locationKey = String(locationCode);
    const fetchedAt = new Date();
    const previous = await prisma.competitor.findMany({
      where: { hotelTenantId: current.hotelTenantId, locationKey },
      select: { externalKey: true, adr: true },
    });
    const savedAdr = new Map(previous.map((row) => [row.externalKey, row.adr]));
    await prisma.$transaction(async (tx) => {
      await tx.competitorSettings.upsert({
        where: { hotelTenantId: current.hotelTenantId },
        create: {
          hotelTenantId: current.hotelTenantId,
          latitude: parsed.latitude,
          longitude: parsed.longitude,
          locationCode,
          mustInclude: parsed.mustInclude,
        },
        update: {
          latitude: parsed.latitude,
          longitude: parsed.longitude,
          mustInclude: parsed.mustInclude,
        },
      });
      await tx.competitor.deleteMany({ where: { hotelTenantId: current.hotelTenantId, locationKey } });
      if (found.hotels.length) {
        await tx.competitor.createMany({
          data: found.hotels.map((item, index) => ({
            hotelTenantId: current.hotelTenantId,
            locationKey,
            externalKey: item.key,
            name: item.title,
            accommodationType: item.stars === null ? null : String(item.stars),
            rating: item.rating,
            reviewCount: item.reviewCount === null ? null : Math.max(0, Math.trunc(item.reviewCount)),
            minPrice: item.minPrice,
            maxPrice: item.maxPrice,
            adr: savedAdr.get(item.key) ?? null,
            latitude: item.latitude,
            longitude: item.longitude,
            image: item.image,
            mentions: Object.entries(item.prices).map(([date, price]) => ({ date, price })) as Prisma.InputJsonValue,
            merchandisingLabels: [] as Prisma.InputJsonValue,
            rawPayload: item.raw as Prisma.InputJsonValue,
            bestValueRank: index + 1,
            lastFetchedAt: fetchedAt,
          })),
        });
      }
    });

    return NextResponse.json({
      saved: found.hotels.length,
      mustHave: found.mustHave,
      hotels: found.hotels.map((item) => ({
        name: item.title,
        distanceKm: item.distanceKm === null ? null : Math.round(item.distanceKm * 10) / 10,
        minPrice: item.minPrice,
        maxPrice: item.maxPrice,
        rating: item.rating,
        reviewCount: item.reviewCount,
      })),
    });
  } catch (error) {
    const code = error instanceof LocationLookupError ? error.code : "LOCATION_LOOKUP_FAILED";
    const status = code === "CREDENTIALS_MISSING" || code === "LOCATION_LOOKUP_FAILED" ? 502 : 400;
    return NextResponse.json({ error: code }, { status });
  }
}
