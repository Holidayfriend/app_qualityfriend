import { NextResponse } from "next/server";
import { scheduleEditor } from "../../../../lib/schedule/access";
import { publishWeekShifts } from "../../../../lib/schedule/shifts";

export async function POST() {
  const actor = await scheduleEditor();
  if (!actor) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  try {
    const result = await publishWeekShifts(actor);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Publish schedule failed", error);
    return NextResponse.json({ error: "SAVE_FAILED" }, { status: 500 });
  }
}
