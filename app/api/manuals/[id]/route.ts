import { NextResponse } from "next/server";
import { manualsEditor } from "@/lib/manuals/access";
import { getManualForEdit, updateManual } from "@/lib/manuals/service";

type Context = { params: Promise<{ id: string }> };

export const runtime = "nodejs";

export async function GET(_request: Request, context: Context) {
  const actor = await manualsEditor();
  if (!actor) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const { id } = await context.params;
  const document = await getManualForEdit(actor, id);
  if (!document) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  return NextResponse.json({ document });
}

export async function PATCH(request: Request, context: Context) {
  const actor = await manualsEditor();
  if (!actor) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const { id } = await context.params;
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "INVALID" }, { status: 400 });
  const result = await updateManual(actor, id, body);
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.error === "NOT_FOUND" ? 404 : 400 });
  return NextResponse.json(result);
}
