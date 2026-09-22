import { NextResponse } from "next/server";
import { scheduleViewer } from "../../../../lib/schedule/access";
import { createAbsence, listAbsences } from "../../../../lib/schedule/leaves";
import { supportedLocales } from "../../../../lib/i18n/dictionaries";

function localeOf(request: Request) {
  const locale = new URL(request.url).searchParams.get("locale") ?? "";
  return supportedLocales.includes(locale as (typeof supportedLocales)[number]) ? locale : "en";
}

export async function GET(request: Request) {
  const actor = await scheduleViewer();
  if (!actor) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const absences = await listAbsences(actor, localeOf(request));
  return NextResponse.json({ absences }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const actor = await scheduleViewer();
  if (!actor) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  try {
    const result = await createAbsence(actor, body, localeOf(request));
    if ("error" in result) return NextResponse.json(result, { status: 400 });
    return NextResponse.json(result);
  } catch (error) {
    console.error("Create absence failed", error);
    return NextResponse.json({ error: "SAVE_FAILED" }, { status: 500 });
  }
}
