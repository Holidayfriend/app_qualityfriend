import { NextResponse } from "next/server";
import { accessibleModules } from "../../../../lib/auth/module-access";
import { getSessionUserId } from "../../../../lib/auth/session";
import { prisma } from "../../../../lib/prisma";
import { listCurrentRevenueWeek, setRevenueRecommendationAdopted } from "../../../../lib/revenue/daily-recommendations";
import { listForecastNarrative } from "../../../../lib/revenue/narratives";
import { hasTrustedOrigin } from "../../../../lib/security/request-origin";

async function actor() {
  const id = await getSessionUserId();
  if (!id) return null;
  const user = await prisma.user.findFirst({
    where: { id, isActive: true, isDeleted: false, hotelTenant: { isActive: true, subscriptionStatus: { in: ["ACTIVE", "COMPED"] } } },
    select: { id: true, hotelTenantId: true, role: true },
  });
  if (!user) return null;
  const modules = await accessibleModules({ id: user.id, hotel_tenant_id: user.hotelTenantId, role: user.role });
  if (!modules.includes("revenue")) return null;
  return user;
}

export async function GET() {
  const current = await actor();
  if (!current) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  const [week, narrative] = await Promise.all([
    listCurrentRevenueWeek(prisma, current.hotelTenantId),
    listForecastNarrative(prisma, current.hotelTenantId),
  ]);
  return NextResponse.json({ ...week, summary: narrative.price });
}

export async function PATCH(request: Request) {
  if (!hasTrustedOrigin(request)) return NextResponse.json({ error: "FORBIDDEN_ORIGIN" }, { status: 403 });
  const current = await actor();
  if (!current) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  const body = await request.json().catch(() => null) as { date?: unknown; adopted?: unknown } | null;
  const date = typeof body?.date === "string" ? body.date : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || typeof body?.adopted !== "boolean") {
    return NextResponse.json({ error: "INVALID_FIELDS" }, { status: 400 });
  }
  const saved = await setRevenueRecommendationAdopted(prisma, current.hotelTenantId, date, body.adopted);
  if (!saved) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
