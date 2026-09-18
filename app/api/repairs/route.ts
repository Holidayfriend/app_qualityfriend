import { NextResponse } from "next/server";
import { repairsEditor, repairsViewer } from "../../../lib/repairs/access";
import { createRepair, listRepairs, averageResponseDays } from "../../../lib/repairs/service";
import { supportedLocales } from "../../../lib/i18n/dictionaries";

function localeOf(request: Request) {
  const locale = new URL(request.url).searchParams.get("locale") ?? "";
  return supportedLocales.includes(locale as (typeof supportedLocales)[number]) ? locale : "en";
}

export async function GET(request: Request) {
  const actor = await repairsViewer();
  if (!actor) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const kind = new URL(request.url).searchParams.get("kind") === "template" ? "TEMPLATE" : "REPAIR";
  if (kind === "TEMPLATE" && !actor.canManage) return NextResponse.json({ repairs: [] });
  const repairs = await listRepairs(actor, localeOf(request), kind);
  const avgResponseDays = kind === "REPAIR" ? await averageResponseDays(actor) : null;
  return NextResponse.json({ repairs, canManage: actor.canManage, avgResponseDays });
}

export async function POST(request: Request) {
  const actor = await repairsEditor();
  if (!actor) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "INVALID" }, { status: 400 });
  const result = await createRepair(actor, body, localeOf(request));
  if ("error" in result) return NextResponse.json(result, { status: result.error === "FORBIDDEN" ? 403 : 400 });
  return NextResponse.json(result, { status: 201 });
}
