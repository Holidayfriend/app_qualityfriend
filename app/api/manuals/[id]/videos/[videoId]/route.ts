import { NextResponse } from "next/server";
import { manualsViewer } from "@/lib/manuals/access";
import { manualFileResponse } from "@/lib/manuals/file-response";
import { openManualVideo } from "@/lib/manuals/service";

type Context = { params: Promise<{ id: string; videoId: string }> };

export const runtime = "nodejs";

export async function GET(request: Request, context: Context) {
  const actor = await manualsViewer();
  if (!actor) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  const { id, videoId } = await context.params;
  const file = await openManualVideo(actor, id, videoId);
  if (!file) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  const download = new URL(request.url).searchParams.get("download") === "1";
  return manualFileResponse(request, file, download);
}
