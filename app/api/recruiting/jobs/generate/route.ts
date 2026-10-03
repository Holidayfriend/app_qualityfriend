import { NextResponse } from "next/server";
import { recruitingActor } from "@/lib/recruiting/access";
import { generateJobCopy } from "@/lib/recruiting/generate-job";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const actor = await recruitingActor();
  if (!actor) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const body = await request.json().catch(() => null);
  const title = typeof body?.title === "string" ? body.title.trim().slice(0, 180) : "";
  if (!title) return NextResponse.json({ error: "TITLE_REQUIRED" }, { status: 400 });
  const locale = typeof body?.locale === "string" ? body.locale : "en";
  const departmentName = typeof body?.departmentName === "string" ? body.departmentName.trim().slice(0, 180) : "";
  const workType = typeof body?.workType === "string" ? body.workType.trim().slice(0, 40) : "";
  try {
    const draft = await generateJobCopy({
      hotelTenantId: actor.hotel_tenant_id,
      title,
      departmentName,
      workType,
      startFrom: typeof body?.startFrom === "string" ? body.startFrom.trim().slice(0, 120) : "",
      benefits: typeof body?.benefits === "string" ? body.benefits.trim().slice(0, 400) : "",
      location: typeof body?.location === "string" ? body.location.trim().slice(0, 200) : "",
      descriptionHtml: typeof body?.descriptionHtml === "string" ? body.descriptionHtml.trim().slice(0, 20000) : "",
      cvRequired: body?.cvRequired === true,
      locale,
    });
    return NextResponse.json(draft);
  } catch {
    return NextResponse.json({ error: "GENERATE_FAILED" }, { status: 502 });
  }
}
