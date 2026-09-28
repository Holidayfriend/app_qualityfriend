import { NextResponse } from "next/server";
import { currentAccessUser } from "../../../../lib/auth/module-access";
import { prisma } from "../../../../lib/prisma";
import { isAiUsageRange, listHotelAiUsage } from "../../../../lib/ai/usage";

export async function GET(request: Request) {
  const user = await currentAccessUser();
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  const url = new URL(request.url);
  const rangeParam = url.searchParams.get("range");
  const range = isAiUsageRange(rangeParam) ? rangeParam : "today";
  try {
    const usage = await listHotelAiUsage(prisma, user.hotel_tenant_id, range, {
      from: url.searchParams.get("from") ?? undefined,
      to: url.searchParams.get("to") ?? undefined,
    });
    return NextResponse.json(usage, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const code = error instanceof Error && error.message === "INVALID_RANGE" ? error.message : "FAILED";
    return NextResponse.json({ error: code }, { status: code === "FAILED" ? 500 : 400 });
  }
}
