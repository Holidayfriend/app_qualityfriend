import { notesEditor } from "../../../../lib/notes/access";
import { isNoteUpload, noteImageExtension, saveInlineNoteImage } from "../../../../lib/notes/storage";

export async function POST(request: Request) {
  const actor = await notesEditor();
  if (!actor) return Response.json({ error: "FORBIDDEN" }, { status: 403 });
  const form = await request.formData().catch(() => null);
  const file = form?.get("file") ?? null;
  if (!isNoteUpload(file)) return Response.json({ error: "INVALID" }, { status: 400 });
  const ext = noteImageExtension(file.type, file.name);
  if (!ext) return Response.json({ error: "INVALID" }, { status: 400 });
  const url = await saveInlineNoteImage(actor.hotel_tenant_id, Buffer.from(await file.arrayBuffer()), ext);
  if (!url) return Response.json({ error: "INVALID" }, { status: 400 });
  return Response.json({ url });
}
