import { NextResponse } from "next/server";
import { handoversEditor, handoversViewer } from "../../../lib/handovers/access";
import { createHandover, listHandovers } from "../../../lib/handovers/service";
import { supportedLocales } from "../../../lib/i18n/dictionaries";

function localeOf(request: Request) {
  const locale = new URL(request.url).searchParams.get("locale") ?? "";
  return supportedLocales.includes(locale as (typeof supportedLocales)[number]) ? locale : "en";
}

export async function GET(request: Request) {
  const actor = await handoversViewer();
  if (!actor) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const kind = new URL(request.url).searchParams.get("kind") === "template" ? "TEMPLATE" : "HANDOVER";
  if (kind === "TEMPLATE" && !actor.canManage) return NextResponse.json({ handovers: [], canManage: actor.canManage });
  try {
    const handovers = await listHandovers(actor, localeOf(request), kind);
    return NextResponse.json({ handovers, canManage: actor.canManage });
  } catch (error) {
    console.error("handovers list failed", error);
    return NextResponse.json({ handovers: [], canManage: actor.canManage });
  }
}

export async function POST(request: Request) {
  const actor = await handoversEditor();
  if (!actor) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "INVALID" }, { status: 400 });
  const result = await createHandover(actor, body, localeOf(request));
  if ("error" in result) return NextResponse.json(result, { status: result.error === "FORBIDDEN" ? 403 : 400 });
  return NextResponse.json(result, { status: 201 });
}
