import { NextResponse } from "next/server";
import { manualsViewer } from "@/lib/manuals/access";
import { manualFileResponse } from "@/lib/manuals/file-response";
import { openManual } from "@/lib/manuals/service";

type Context = { params: Promise<{ id: string }> };

export const runtime = "nodejs";

export async function GET(request: Request, { params }: Context) {
  const actor = await manualsViewer();
  if (!actor) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  const file = await openManual(actor, (await params).id);
  if (!file) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  const download = new URL(request.url).searchParams.get("download") === "1";
  return manualFileResponse(request, file, download);
}
