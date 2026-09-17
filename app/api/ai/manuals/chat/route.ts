import { NextResponse } from "next/server";
import { manualsViewer } from "@/lib/manuals/access";
import { answerManualQuestion } from "@/lib/manuals/chat";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const actor = await manualsViewer();
  if (!actor) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  const body = await request.json().catch(() => null);
  const message = typeof body?.message === "string" ? body.message : "";
  const history = Array.isArray(body?.history)
    ? body.history.flatMap((item: { role?: string; content?: string }) => {
        if ((item?.role !== "user" && item?.role !== "assistant") || typeof item.content !== "string") return [];
        return [{ role: item.role, content: item.content }];
      })
    : [];
  try {
    const result = await answerManualQuestion(actor, message, history, body?.locale);
    if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.error === "EMPTY" ? 400 : 502 });
    return NextResponse.json({ answer: result.answer });
  } catch {
    return NextResponse.json({ error: "FAILED" }, { status: 500 });
  }
}
