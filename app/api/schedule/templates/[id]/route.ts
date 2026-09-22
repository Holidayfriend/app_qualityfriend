import { NextResponse } from "next/server";
import { scheduleEditor } from "../../../../../lib/schedule/access";
import { deleteShiftTemplate, updateShiftTemplate } from "../../../../../lib/schedule/templates";
import { supportedLocales } from "../../../../../lib/i18n/dictionaries";

type Ctx = { params: Promise<{ id: string }> };

function localeOf(request: Request) {
  const locale = new URL(request.url).searchParams.get("locale") ?? "";
  return supportedLocales.includes(locale as (typeof supportedLocales)[number]) ? locale : "en";
}

export async function PATCH(request: Request, ctx: Ctx) {
  const actor = await scheduleEditor();
  if (!actor) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const { id } = await ctx.params;
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  try {
    const result = await updateShiftTemplate(actor, id, body, localeOf(request));
    if ("error" in result) return NextResponse.json(result, { status: result.error === "NOT_FOUND" ? 404 : 400 });
    return NextResponse.json(result);
  } catch (error) {
    console.error("Update shift template failed", error);
    return NextResponse.json({ error: "SAVE_FAILED" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, ctx: Ctx) {
  const actor = await scheduleEditor();
  if (!actor) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const { id } = await ctx.params;
  try {
    const result = await deleteShiftTemplate(actor, id);
    if ("error" in result) return NextResponse.json(result, { status: 404 });
    return NextResponse.json(result);
  } catch (error) {
    console.error("Delete shift template failed", error);
    return NextResponse.json({ error: "SAVE_FAILED" }, { status: 500 });
  }
}
