import { NextResponse } from "next/server";
import { scheduleEditor } from "../../../../../lib/schedule/access";
import { decideAbsence, deleteAbsence } from "../../../../../lib/schedule/leaves";
import { supportedLocales } from "../../../../../lib/i18n/dictionaries";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await scheduleEditor();
  if (!actor) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const { id } = await params;
  const locale = new URL(request.url).searchParams.get("locale") ?? "";
  const lang = supportedLocales.includes(locale as (typeof supportedLocales)[number]) ? locale : "en";
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const status = body?.status === "rejected" ? "rejected" : body?.status === "approved" ? "approved" : null;
  if (!status) return NextResponse.json({ error: "INVALID" }, { status: 400 });
  try {
    const reason = typeof body?.reason === "string" ? body.reason : "";
    const result = await decideAbsence(actor, id, status, lang, body?.confirmOverwrite === true, reason);
    if ("error" in result) {
      const statusCode = result.error === "FORBIDDEN" ? 403 : result.error === "SHIFT_CONFLICT" ? 409 : 404;
      return NextResponse.json(result, { status: statusCode });
    }
    return NextResponse.json(result);
  } catch (error) {
    console.error("Decide absence failed", error);
    return NextResponse.json({ error: "SAVE_FAILED" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await scheduleEditor();
  if (!actor) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const { id } = await params;
  try {
    const result = await deleteAbsence(actor, id);
    if ("error" in result) return NextResponse.json(result, { status: result.error === "FORBIDDEN" ? 403 : 404 });
    return NextResponse.json(result);
  } catch (error) {
    console.error("Delete absence failed", error);
    return NextResponse.json({ error: "SAVE_FAILED" }, { status: 500 });
  }
}
