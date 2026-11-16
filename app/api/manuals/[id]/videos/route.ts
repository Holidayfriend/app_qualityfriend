import { NextResponse } from "next/server";
import { manualsEditor } from "@/lib/manuals/access";
import { addManualVideos, removeManualVideo } from "@/lib/manuals/service";

type Context = { params: Promise<{ id: string }> };

export const runtime = "nodejs";

export async function POST(request: Request, context: Context) {
  const actor = await manualsEditor();
  if (!actor) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const { id } = await context.params;
  try {
    const result = await addManualVideos(actor, id, await request.formData());
    if ("error" in result) {
      const status = result.error === "NOT_FOUND" ? 404 : 400;
      return NextResponse.json({ error: result.error }, { status });
    }
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "SAVE_FAILED" }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: Context) {
  const actor = await manualsEditor();
  if (!actor) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const { id } = await context.params;
  const videoId = new URL(request.url).searchParams.get("id") || "";
  const result = await removeManualVideo(actor, id, videoId);
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 404 });
  return NextResponse.json({ success: true });
}
