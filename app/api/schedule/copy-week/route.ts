import { NextResponse } from "next/server";
import { scheduleEditor } from "../../../../lib/schedule/access";
import { copyWeekShifts } from "../../../../lib/schedule/shifts";

export async function POST(request: Request) {
  const actor = await scheduleEditor();
  if (!actor) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const body = await request.json().catch(() => null) as { fromWeekStart?: string; toWeekStart?: string } | null;
  try {
    const result = await copyWeekShifts(actor, body?.fromWeekStart ?? "", body?.toWeekStart ?? "");
    if ("error" in result) return NextResponse.json(result, { status: 400 });
    return NextResponse.json(result);
  } catch (error) {
    console.error("Copy week failed", error);
    return NextResponse.json({ error: "SAVE_FAILED" }, { status: 500 });
  }
}
