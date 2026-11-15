import { notesViewer } from "../../../../../lib/notes/access";
import { mimeFor, readInlineNoteImage } from "../../../../../lib/notes/storage";

type Context = { params: Promise<{ key: string }> };

export async function GET(_request: Request, context: Context) {
  const actor = await notesViewer();
  if (!actor) return Response.json({ error: "FORBIDDEN" }, { status: 403 });
  const { key } = await context.params;
  const bytes = await readInlineNoteImage(actor.hotel_tenant_id, key);
  if (!bytes) return Response.json({ error: "NOT_FOUND" }, { status: 404 });
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": mimeFor(key),
      "Cache-Control": "private, max-age=3600",
    },
  });
}
