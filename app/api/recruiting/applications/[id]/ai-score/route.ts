import { after } from "next/server";
import { NextResponse } from "next/server";
import { prisma } from "../../../../../lib/prisma";
import { recruitingActor } from "../../../../../lib/recruiting/access";
import { scoreRecruitingApplication } from "../../../../../lib/recruiting/ai-score-job";
import { isUuid, toPublicApplicant } from "../../../../../lib/recruiting/application-fields";
import { dispatchRecruitingAiScore } from "../../../../../lib/recruiting/dispatch-ai-score";

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
  await prisma.recruitingApplication.update({
    where: { id },
    data: { aiStatus: "PENDING", aiError: null },
  });
  const payload = { hotelTenantId: actor.hotel_tenant_id, applicationId: id };
  try {
    const queued = await dispatchRecruitingAiScore(actor.hotel_tenant_id, id);
    if (!queued) {
      after(() => scoreRecruitingApplication(payload).catch((error) => console.error("Recruiting AI score fallback failed", error)));
    }
  } catch {
    after(() => scoreRecruitingApplication(payload).catch((error) => console.error("Recruiting AI score fallback failed", error)));
  }
  const updated = await prisma.recruitingApplication.findFirst({
    where: { id, hotelTenantId: actor.hotel_tenant_id },
    include: { job: jobInclude },
  });
  return NextResponse.json({ application: toPublicApplicant(updated ?? row, (updated ?? row).job, locale) });
}
