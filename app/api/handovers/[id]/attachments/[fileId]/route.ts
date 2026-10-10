import { handoversViewer } from "../../../../../../lib/handovers/access";
import { getHandover } from "../../../../../../lib/handovers/service";
import { prisma } from "../../../../../../lib/prisma";
import { mimeFor, readAttachmentFile } from "../../../../../../lib/attachments/storage";

type Context = { params: Promise<{ id: string; fileId: string }> };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: Request, context: Context) {
  const actor = await handoversViewer();
  if (!actor) return Response.json({ error: "FORBIDDEN" }, { status: 403 });
  const { id, fileId } = await context.params;
  if (!uuid.test(id) || !uuid.test(fileId)) return Response.json({ error: "NOT_FOUND" }, { status: 404 });
  const handover = await getHandover(actor, id, "en");
  if (!handover) return Response.json({ error: "NOT_FOUND" }, { status: 404 });
  const file = await prisma.handoverAttachment.findFirst({ where: { id: fileId, handoverId: id } });
  if (!file) return Response.json({ error: "NOT_FOUND" }, { status: 404 });
  const bytes = await readAttachmentFile("handovers", file.storageKey);
  if (!bytes) return Response.json({ error: "NOT_FOUND" }, { status: 404 });
  const download = new URL(request.url).searchParams.get("download") === "1";
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": file.mimeType || mimeFor(file.storageKey),
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(file.fileName)}`,
      "Cache-Control": "private, no-store",
    },
  });
}
