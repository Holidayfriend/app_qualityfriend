import { NextResponse } from "next/server";
import { scheduleEditor, scheduleViewer } from "../../../../lib/schedule/access";
import { listWeekShifts, saveShiftAssignment } from "../../../../lib/schedule/shifts";
import { supportedLocales } from "../../../../lib/i18n/dictionaries";

function localeOf(request: Request) {
  const locale = new URL(request.url).searchParams.get("locale") ?? "";
  return supportedLocales.includes(locale as (typeof supportedLocales)[number]) ? locale : "en";
}

export async function GET(request: Request) {
  const actor = await scheduleViewer();
  if (!actor) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const weekStart = new URL(request.url).searchParams.get("weekStart") ?? "";
  const shifts = await listWeekShifts(actor, weekStart, localeOf(request));
  return NextResponse.json({ shifts }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const actor = await scheduleEditor();
  if (!actor) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  try {
    const result = await saveShiftAssignment(actor, body, localeOf(request));
    if ("error" in result) return NextResponse.json(result, { status: 400 });
    return NextResponse.json(result);
  } catch (error) {
    console.error("Save shift failed", error);
    return NextResponse.json({ error: "SAVE_FAILED" }, { status: 500 });
  }
}
