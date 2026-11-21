import { NextResponse } from "next/server";
import { scheduleEditor } from "../../../../../lib/schedule/access";
import { saveAiDrafts } from "../../../../../lib/schedule/shifts";
import { hasTrustedOrigin } from "../../../../../lib/security/request-origin";

export async function POST(request: Request) {
  if (!hasTrustedOrigin(request)) return NextResponse.json({ error: "FORBIDDEN_ORIGIN" }, { status: 403 });
  const actor = await scheduleEditor();
  if (!actor) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const body = await request.json().catch(() => null) as { shifts?: unknown } | null;
  const shifts = Array.isArray(body?.shifts) ? body.shifts.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as { userId?: unknown; date?: unknown; start?: unknown; end?: unknown; breakMins?: unknown; templateId?: unknown };
    if (typeof row.userId !== "string" || typeof row.date !== "string" || typeof row.start !== "string" || typeof row.end !== "string") return [];
    return [{
      userId: row.userId,
      date: row.date,
      start: row.start,
      end: row.end,
      breakMins: row.breakMins,
      templateId: typeof row.templateId === "string" ? row.templateId : "",
    }];
  }) : [];
  const result = await saveAiDrafts(actor, shifts);
  return NextResponse.json(result);
}
