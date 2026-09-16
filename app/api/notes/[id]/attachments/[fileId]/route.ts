import { notesActor } from "../../../../../../lib/notes/access";
import { getNote, isUuid } from "../../../../../../lib/notes/service";
import { prisma } from "../../../../../../lib/prisma";
import { mimeFor, readNoteFile } from "../../../../../../lib/notes/storage";

type Context = { params: Promise<{ id: string; fileId: string }> };

export async function GET(_request: Request, context: Context) {
  const actor = await notesActor();
  if (!actor) return Response.json({ error: "FORBIDDEN" }, { status: 403 });
  const { id, fileId } = await context.params;
  if (!isUuid(id) || !isUuid(fileId)) return Response.json({ error: "NOT_FOUND" }, { status: 404 });
  const note = await getNote(actor, id, "en");
  if (!note) return Response.json({ error: "NOT_FOUND" }, { status: 404 });
  const file = await prisma.hotelNoteAttachment.findFirst({ where: { id: fileId, noteId: id } });
  if (!file) return Response.json({ error: "NOT_FOUND" }, { status: 404 });
  const bytes = await readNoteFile(file.storageKey);
  if (!bytes) return Response.json({ error: "NOT_FOUND" }, { status: 404 });
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": file.mimeType || mimeFor(file.storageKey),
      "Content-Disposition": `inline; filename="${encodeURIComponent(file.fileName)}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
