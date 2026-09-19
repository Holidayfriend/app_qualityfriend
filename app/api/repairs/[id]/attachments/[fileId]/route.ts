import { repairsViewer } from "../../../../../../lib/repairs/access";
import { getRepair, isUuid } from "../../../../../../lib/repairs/service";
import { prisma } from "../../../../../../lib/prisma";
import { mimeFor, readRepairFile } from "../../../../../../lib/repairs/storage";

type Context = { params: Promise<{ id: string; fileId: string }> };

export async function GET(request: Request, context: Context) {
  const actor = await repairsViewer();
  if (!actor) return Response.json({ error: "FORBIDDEN" }, { status: 403 });
  const { id, fileId } = await context.params;
  if (!isUuid(id) || !isUuid(fileId)) return Response.json({ error: "NOT_FOUND" }, { status: 404 });
  const repair = await getRepair(actor, id, "en");
  if (!repair) return Response.json({ error: "NOT_FOUND" }, { status: 404 });
  const file = await prisma.repairAttachment.findFirst({ where: { id: fileId, repairId: id } });
  if (!file) return Response.json({ error: "NOT_FOUND" }, { status: 404 });
  const bytes = await readRepairFile(file.storageKey);
  if (!bytes) return Response.json({ error: "NOT_FOUND" }, { status: 404 });
  const download = new URL(request.url).searchParams.get("download") === "1";
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": file.mimeType || mimeFor(file.storageKey),
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${encodeURIComponent(file.fileName)}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
