import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { recruitingActor } from "../../../../lib/recruiting/access";
import { pickRecommendationBody } from "../../../../lib/ai/recommendation-body";

export async function GET(request: Request) {
  const actor = await recruitingActor();
  if (!actor) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const locale = new URL(request.url).searchParams.get("locale") ?? "";
  try {
    const row = await prisma.hotelAiRecommendation.findUnique({
      where: { hotelTenantId_place: { hotelTenantId: actor.hotel_tenant_id, place: "RECRUITING" } },
    });
    if (!row) return NextResponse.json({ briefing: null }, { headers: { "Cache-Control": "no-store" } });
    return NextResponse.json(
      { briefing: pickRecommendationBody(row, locale), generatedAt: row.generatedAt.toISOString() },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json({ briefing: null }, { headers: { "Cache-Control": "no-store" } });
  }
}
