import { NextResponse } from "next/server";
import { accessibleModules } from "../../../lib/auth/module-access";
import { getSessionUserId } from "../../../lib/auth/session";
import { prisma } from "../../../lib/prisma";
import { hasTrustedOrigin } from "../../../lib/security/request-origin";

async function actor() {
  const id = await getSessionUserId();
  if (!id) return null;
  const user = await prisma.user.findFirst({
    where: { id, isActive: true, isDeleted: false, hotelTenant: { isActive: true, subscriptionStatus: { in: ["ACTIVE", "COMPED"] } } },
    select: { id: true, hotelTenantId: true, role: true },
  });
  if (!user) return null;
  const modules = await accessibleModules({ id: user.id, hotel_tenant_id: user.hotelTenantId, role: user.role });
  if (!modules.includes("competitors")) return null;
  return user;
}

function amount(value: unknown) {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function distance(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return amount((value as { distKm?: unknown }).distKm);
}

export async function GET() {
  const current = await actor();
  if (!current) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const settings = await prisma.competitorSettings.findUnique({
    where: { hotelTenantId: current.hotelTenantId },
    select: { locationCode: true },
  });
  if (!settings?.locationCode) return NextResponse.json({ hotels: [] });

  const rows = await prisma.competitor.findMany({
    where: { hotelTenantId: current.hotelTenantId, locationKey: String(settings.locationCode) },
    orderBy: [{ bestValueRank: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      rating: true,
      reviewCount: true,
      minPrice: true,
      maxPrice: true,
      adr: true,
      accommodationType: true,
      url: true,
      rawPayload: true,
      lastFetchedAt: true,
    },
  });

  return NextResponse.json({
    hotels: rows.map((row) => {
      const own = row.name.startsWith("[OWN HOTEL] ");
      const stars = Number(row.accommodationType);
      return {
        id: row.id,
        name: own ? row.name.slice("[OWN HOTEL] ".length) : row.name,
        own,
        rating: row.rating,
        reviewCount: row.reviewCount,
        minPrice: amount(row.minPrice),
        maxPrice: amount(row.maxPrice),
        adr: amount(row.adr),
        url: row.url ?? "",
        stars: Number.isInteger(stars) && stars > 0 ? Math.min(stars, 5) : null,
        distanceKm: distance(row.rawPayload),
        fetchedAt: row.lastFetchedAt.toISOString(),
      };
    }),
  });
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function optionalNumber(value: unknown) {
  if (value === "" || value === null || value === undefined) return null;
  const parsed = typeof value === "number" ? value : Number(String(value).trim().replace(",", "."));
  if (!Number.isFinite(parsed) || parsed < 0) return undefined;
  return parsed;
}

export async function POST(request: Request) {
  if (!hasTrustedOrigin(request)) return NextResponse.json({ error: "FORBIDDEN_ORIGIN" }, { status: 403 });
  const current = await actor();
  if (!current) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const name = text(body?.name);
  const url = text(body?.url);
  const adr = optionalNumber(body?.adr);
  const distanceKm = optionalNumber(body?.distanceKm);
  if (!name || adr === undefined || distanceKm === undefined) return NextResponse.json({ error: "INVALID_FIELDS" }, { status: 400 });

  const settings = await prisma.competitorSettings.findUnique({
    where: { hotelTenantId: current.hotelTenantId },
    select: { locationCode: true },
  });
  if (!settings?.locationCode) return NextResponse.json({ error: "MISSING_LOCATION_ID" }, { status: 400 });

  const created = await prisma.competitor.create({
    data: {
      hotelTenantId: current.hotelTenantId,
      locationKey: String(settings.locationCode),
      externalKey: `manual-${crypto.randomUUID()}`,
      name,
      url: url || null,
      adr,
      rawPayload: { distKm: distanceKm, manual: true },
      lastFetchedAt: new Date(),
    },
    select: { id: true },
  });
  return NextResponse.json({ id: created.id });
}
