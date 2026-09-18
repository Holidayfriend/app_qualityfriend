import { NextResponse } from "next/server";
import { handoversEditor, handoversViewer } from "../../../../lib/handovers/access";
import { getHandover, updateHandover, updateHandoverPin, updateHandoverStatus } from "../../../../lib/handovers/service";
import { supportedLocales } from "../../../../lib/i18n/dictionaries";

type Ctx = { params: Promise<{ id: string }> };

function localeOf(request: Request) {
  const locale = new URL(request.url).searchParams.get("locale") ?? "";
  return supportedLocales.includes(locale as (typeof supportedLocales)[number]) ? locale : "en";
}

export async function GET(request: Request, ctx: Ctx) {
  const actor = await handoversViewer();
  if (!actor) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const { id } = await ctx.params;
  const handover = await getHandover(actor, id, localeOf(request));
  if (!handover) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  return NextResponse.json({ handover, canManage: actor.canManage });
}

export async function PATCH(request: Request, ctx: Ctx) {
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "INVALID" }, { status: 400 });
  const action = String(body.action ?? "update");
  const actor = action === "update" ? await handoversEditor() : await handoversViewer();
  if (!actor) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  if (action === "update" && !actor.canManage) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const { id } = await ctx.params;
  const locale = localeOf(request);
  const result = action === "status"
    ? await updateHandoverStatus(actor, id, String(body.status ?? ""), locale)
    : action === "pin"
      ? await updateHandoverPin(actor, id, Boolean(body.pinned), locale)
      : await updateHandover(actor, id, body, locale);
  if ("error" in result) return NextResponse.json(result, { status: result.error === "NOT_FOUND" ? 404 : result.error === "FORBIDDEN" ? 403 : 400 });
  return NextResponse.json(result);
}
