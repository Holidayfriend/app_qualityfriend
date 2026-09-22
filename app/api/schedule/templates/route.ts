import { NextResponse } from "next/server";
import { scheduleEditor, scheduleViewer } from "../../../../lib/schedule/access";
import { createShiftTemplate, listShiftTemplates } from "../../../../lib/schedule/templates";
import { supportedLocales } from "../../../../lib/i18n/dictionaries";

function localeOf(request: Request) {
  const locale = new URL(request.url).searchParams.get("locale") ?? "";
  return supportedLocales.includes(locale as (typeof supportedLocales)[number]) ? locale : "en";
}

export async function GET(request: Request) {
  const actor = await scheduleViewer();
  if (!actor) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const templates = await listShiftTemplates(actor, localeOf(request));
  return NextResponse.json({ templates }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const actor = await scheduleEditor();
  if (!actor) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  try {
    const result = await createShiftTemplate(actor, body, localeOf(request));
    if ("error" in result) return NextResponse.json(result, { status: 400 });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error("Create shift template failed", error);
    return NextResponse.json({ error: "SAVE_FAILED" }, { status: 500 });
  }
}
