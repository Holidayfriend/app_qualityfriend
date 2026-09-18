import { NextResponse } from "next/server";
import { prisma } from "../../../../../../lib/prisma";
import { recruitingActor } from "../../../../../../lib/recruiting/access";
import { isUuid, toPublicApplicant } from "../../../../../../lib/recruiting/application-fields";
import { scoreRecruitingApplicationCached } from "../../../../../../lib/recruiting/score-application";

export const runtime = "nodejs";
export const maxDuration = 60;

type Context = { params: Promise<{ id: string }> };

const jobInclude = {
  select: {
    title: true,
    titleDe: true,
    titleIt: true,
    format: true,
    department: { select: { nameEn: true, nameDe: true, nameIt: true } },
  },
} as const;

export async function POST(request: Request, context: Context) {
  const actor = await recruitingActor();
  if (!actor) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const { id } = await context.params;
  if (!isUuid(id)) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  const locale = new URL(request.url).searchParams.get("locale") ?? "";
  const row = await prisma.recruitingApplication.findFirst({
    where: { id, hotelTenantId: actor.hotel_tenant_id },
    include: { job: jobInclude },
  });
  if (!row) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  try {
    await scoreRecruitingApplicationCached(prisma, actor.hotel_tenant_id, id);
  } catch (error) {
    console.error("Recruiting AI score failed", error);
    const failed = await prisma.recruitingApplication.findFirst({
      where: { id, hotelTenantId: actor.hotel_tenant_id },
      include: { job: jobInclude },
    });
    return NextResponse.json(
      { error: "SCORE_FAILED", application: failed ? toPublicApplicant(failed, failed.job, locale) : undefined },
      { status: 502 },
    );
  }
  const updated = await prisma.recruitingApplication.findFirst({
    where: { id, hotelTenantId: actor.hotel_tenant_id },
    include: { job: jobInclude },
  });
  return NextResponse.json({ application: toPublicApplicant(updated ?? row, (updated ?? row).job, locale) });
}
