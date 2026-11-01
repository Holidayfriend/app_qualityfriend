import { NextResponse } from "next/server";
import { scheduleEditor } from "../../../../lib/schedule/access";
import { publishWeekShifts } from "../../../../lib/schedule/shifts";

export async function POST(request: Request) {
  const actor = await scheduleEditor();
  if (!actor) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const body = await request.json().catch(() => null) as { weekStart?: unknown } | null;
  const weekStart = typeof body?.weekStart === "string" ? body.weekStart : "";
  try {
    const result = await publishWeekShifts(actor, weekStart);
    if ("error" in result) return NextResponse.json(result, { status: 400 });
    return NextResponse.json(result);
  } catch (error) {
    console.error("Publish schedule failed", error);
    return NextResponse.json({ error: "SAVE_FAILED" }, { status: 500 });
  }
}
