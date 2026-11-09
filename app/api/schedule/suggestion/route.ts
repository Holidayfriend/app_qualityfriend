import { NextResponse } from "next/server";
import { scheduleEditor } from "../../../../lib/schedule/access";
import { listScheduleSuggestion, refreshScheduleSuggestion } from "../../../../lib/schedule/suggestion";
import { supportedLocales } from "../../../../lib/i18n/dictionaries";
import { hasTrustedOrigin } from "../../../../lib/security/request-origin";

function localeOf(value: string | null) {
  return supportedLocales.includes(value as (typeof supportedLocales)[number]) ? value : "en";
}

export async function GET(request: Request) {
  const actor = await scheduleEditor();
  if (!actor) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const url = new URL(request.url);
  const suggestion = await listScheduleSuggestion(actor, url.searchParams.get("weekStart") ?? "", localeOf(url.searchParams.get("locale")));
  return NextResponse.json({ suggestion }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  if (!hasTrustedOrigin(request)) return NextResponse.json({ error: "FORBIDDEN_ORIGIN" }, { status: 403 });
  const actor = await scheduleEditor();
  if (!actor) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const body = await request.json().catch(() => null) as { weekStart?: unknown; locale?: unknown } | null;
  const weekStart = typeof body?.weekStart === "string" ? body.weekStart : "";
  const locale = typeof body?.locale === "string" ? localeOf(body.locale) : "en";
  const suggestion = await refreshScheduleSuggestion(actor, weekStart, locale);
  if (suggestion && "error" in suggestion) return NextResponse.json(suggestion, { status: 400 });
  return NextResponse.json({ suggestion });
}
