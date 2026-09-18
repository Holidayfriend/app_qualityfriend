import { NextResponse } from "next/server";
import { repairsEditor, repairsViewer } from "../../../../lib/repairs/access";
import { addRepairComment, getRepair, updateRepair, updateRepairAssignee, updateRepairStatus } from "../../../../lib/repairs/service";
import { supportedLocales } from "../../../../lib/i18n/dictionaries";

type Ctx = { params: Promise<{ id: string }> };

function localeOf(request: Request) {
  const locale = new URL(request.url).searchParams.get("locale") ?? "";
  return supportedLocales.includes(locale as (typeof supportedLocales)[number]) ? locale : "en";
}

export async function GET(request: Request, ctx: Ctx) {
  const actor = await repairsViewer();
  if (!actor) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const { id } = await ctx.params;
  const repair = await getRepair(actor, id, localeOf(request));
  if (!repair) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  return NextResponse.json({ repair, canManage: actor.canManage });
}

export async function PATCH(request: Request, ctx: Ctx) {
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "INVALID" }, { status: 400 });
  const action = String(body.action ?? "update");
  const actor = action === "update" ? await repairsEditor() : await repairsViewer();
  if (!actor) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  if (action === "update" && !actor.canManage) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const { id } = await ctx.params;
  const locale = localeOf(request);
  const result = action === "status"
    ? await updateRepairStatus(actor, id, String(body.status ?? ""), locale)
    : action === "assignee"
      ? await updateRepairAssignee(actor, id, String(body.assigneeId ?? ""), locale)
      : action === "comment"
        ? await addRepairComment(actor, id, String(body.text ?? ""), locale)
        : await updateRepair(actor, id, body, locale);
  if ("error" in result) return NextResponse.json(result, { status: result.error === "NOT_FOUND" ? 404 : result.error === "FORBIDDEN" ? 403 : 400 });
  return NextResponse.json(result);
}
