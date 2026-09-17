import { NextResponse } from "next/server";
import { manualsViewer } from "@/lib/manuals/access";
import { openManual } from "@/lib/manuals/service";

type Context = { params: Promise<{ id: string }> };

export const runtime = "nodejs";

function fileHeaders(name: string, mimeType: string, download: boolean) {
  const safe = name.replace(/[\r\n"]+/g, " ").trim() || "document";
  const encoded = encodeURIComponent(safe);
  return {
    "Content-Type": mimeType,
    "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${safe.replace(/[^\x20-\x7E]/g, "_")}"; filename*=UTF-8''${encoded}`,
    "Cache-Control": "private, max-age=0, must-revalidate",
    "Accept-Ranges": "bytes",
    "X-Content-Type-Options": "nosniff",
  };
}

export async function GET(request: Request, { params }: Context) {
  const actor = await manualsViewer();
  if (!actor) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  const file = await openManual(actor, (await params).id);
  if (!file) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  const download = new URL(request.url).searchParams.get("download") === "1";
  const data = file.data;
  const headers = fileHeaders(file.name, file.mimeType, download);
  const range = request.headers.get("range");
  if (range && !download) {
    const match = /bytes=(\d*)-(\d*)/.exec(range);
    const start = match?.[1] ? Number(match[1]) : 0;
    const end = match?.[2] ? Math.min(Number(match[2]), data.length - 1) : data.length - 1;
    if (start > end || start >= data.length) {
      return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${data.length}` } });
    }
    const chunk = data.subarray(start, end + 1);
    return new Response(chunk, {
      status: 206,
      headers: { ...headers, "Content-Length": String(chunk.length), "Content-Range": `bytes ${start}-${end}/${data.length}` },
    });
  }
  return new Response(data, { headers: { ...headers, "Content-Length": String(data.length) } });
}
