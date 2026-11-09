import { NextResponse } from "next/server";
import { accessibleModules, currentAccessUser } from "../../../lib/auth/module-access";
import { pickRecommendationBody } from "../../../lib/ai/recommendation-body";
import { prisma } from "../../../lib/prisma";

const PLACES = {
  DASHBOARD: "dashboard",
  HANDOVERS: "handovers",
  TASKS: "tasks",
} as const;

export async function GET(request: Request) {
  const user = await currentAccessUser();
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  const url = new URL(request.url);
  const place = url.searchParams.get("place") ?? "";
  if (!(place in PLACES)) return NextResponse.json({ error: "INVALID" }, { status: 400 });
  const key = place as keyof typeof PLACES;
  if (user.role !== "ADMIN" && !(await accessibleModules(user)).includes(PLACES[key])) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }
  try {
    const row = await prisma.hotelAiRecommendation.findUnique({
      where: { hotelTenantId_place: { hotelTenantId: user.hotel_tenant_id, place: key } },
    });
    if (!row) return NextResponse.json({ body: "" }, { headers: { "Cache-Control": "no-store" } });
    return NextResponse.json(
      { body: pickRecommendationBody(row, url.searchParams.get("locale") ?? ""), generatedAt: row.generatedAt.toISOString() },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json({ body: "" }, { headers: { "Cache-Control": "no-store" } });
  }
}
