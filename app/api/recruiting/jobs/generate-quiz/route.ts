import { NextResponse } from "next/server";
import { recruitingActor } from "@/lib/recruiting/access";
import { generateQuizCopy } from "@/lib/recruiting/generate-quiz";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const actor = await recruitingActor();
  if (!actor) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const body = await request.json().catch(() => null);
  const title = typeof body?.title === "string" ? body.title.trim().slice(0, 180) : "";
  const departmentName = typeof body?.departmentName === "string" ? body.departmentName.trim().slice(0, 180) : "";
  const locale = body?.locale === "de" || body?.locale === "it" ? body.locale : "en";
  const facts = body?.facts && typeof body.facts === "object" ? {
    startFrom: typeof body.facts.startFrom === "string" ? body.facts.startFrom.trim().slice(0, 120) : "",
    workHours: typeof body.facts.workHours === "string" ? body.facts.workHours.trim().slice(0, 200) : "",
    salary: typeof body.facts.salary === "string" ? body.facts.salary.trim().slice(0, 200) : "",
    benefits: typeof body.facts.benefits === "string" ? body.facts.benefits.trim().slice(0, 1000) : "",
    contactPerson: typeof body.facts.contactPerson === "string" ? body.facts.contactPerson.trim().slice(0, 200) : "",
  } : { startFrom: "", workHours: "", salary: "", benefits: "", contactPerson: "" };
  if (!title || !departmentName) return NextResponse.json({ error: "TITLE_AND_DEPARTMENT_REQUIRED" }, { status: 400 });
  try {
    return NextResponse.json(await generateQuizCopy({ hotelTenantId: actor.hotel_tenant_id, title, departmentName, locale, pages: body?.pages, facts }));
  } catch (error) {
    console.error("Recruiting quiz generation failed", error);
    return NextResponse.json({ error: "GENERATE_FAILED" }, { status: 502 });
  }
}
