import { NextResponse } from "next/server";
import { tasksEditor, tasksViewer } from "../../../../lib/tasks/access";
import { completeChecklist, getChecklist, toggleChecklistItem, updateChecklist, updateChecklistStatus } from "../../../../lib/checklists/service";
import { supportedLocales } from "../../../../lib/i18n/dictionaries";

type Ctx = { params: Promise<{ id: string }> };

function localeOf(request: Request) {
  const locale = new URL(request.url).searchParams.get("locale") ?? "";
  return supportedLocales.includes(locale as (typeof supportedLocales)[number]) ? locale : "en";
}

export async function GET(request: Request, ctx: Ctx) {
  const actor = await tasksViewer();
  if (!actor) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const { id } = await ctx.params;
  const checklist = await getChecklist(actor, id, localeOf(request));
  if (!checklist) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  return NextResponse.json({ checklist, canManage: actor.canManage });
}

export async function PATCH(request: Request, ctx: Ctx) {
  const viewer = await tasksViewer();
  if (!viewer) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const { id } = await ctx.params;
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "INVALID" }, { status: 400 });
  const locale = localeOf(request);
  try {
    if (typeof body.itemId === "string") {
      const result = await toggleChecklistItem(viewer, id, body.itemId, locale);
      if ("error" in result) return NextResponse.json(result, { status: result.error === "NOT_FOUND" ? 404 : 400 });
      return NextResponse.json(result);
    }
    if (typeof body.status === "string" && !body.title) {
      const actor = await tasksEditor();
      if (!actor) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
      const result = await updateChecklistStatus(actor, id, body.status, locale);
      if ("error" in result) return NextResponse.json(result, { status: result.error === "NOT_FOUND" ? 404 : 400 });
      return NextResponse.json(result);
    }
    if (body.complete) {
      const result = await completeChecklist(viewer, id, String(body.comment ?? ""), locale);
      if ("error" in result) return NextResponse.json(result, { status: result.error === "NOT_FOUND" ? 404 : 400 });
      return NextResponse.json(result);
    }
    const actor = await tasksEditor();
    if (!actor) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    const result = await updateChecklist(actor, id, body, locale);
    if ("error" in result) return NextResponse.json(result, { status: result.error === "NOT_FOUND" ? 404 : 400 });
    return NextResponse.json(result);
  } catch (error) {
    console.error("Update checklist failed", error);
    return NextResponse.json({ error: "SAVE_FAILED" }, { status: 500 });
  }
}
