import { NextResponse } from "next/server";
import { manualsEditor, manualsViewer } from "@/lib/manuals/access";
import { createManual, listManuals, removeManual } from "@/lib/manuals/service";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const actor = await manualsViewer();
  if (!actor) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  const locale = new URL(request.url).searchParams.get("locale") || "en";
  return NextResponse.json(await listManuals(actor, locale));
}

export async function POST(request: Request) {
  const actor = await manualsEditor();
  if (!actor) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  try {
    const result = await createManual(actor, await request.formData());
    if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json({ id: result.document.id });
  } catch {
    return NextResponse.json({ error: "SAVE_FAILED" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const actor = await manualsEditor();
  if (!actor) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const id = new URL(request.url).searchParams.get("id") || "";
  const result = await removeManual(actor, id);
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 404 });
  return NextResponse.json({ success: true });
}
