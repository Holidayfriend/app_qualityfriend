import { notesEditor, notesViewer } from "../../../lib/notes/access";
import { createNote, listNotes } from "../../../lib/notes/service";
import { supportedLocales } from "../../../lib/i18n/dictionaries";

function localeOf(request: Request) {
  const locale = new URL(request.url).searchParams.get("locale") ?? "";
  return supportedLocales.includes(locale as (typeof supportedLocales)[number]) ? locale : "en";
}

export async function GET(request: Request) {
  const actor = await notesViewer();
  if (!actor) return Response.json({ error: "FORBIDDEN" }, { status: 403 });
  const kind = new URL(request.url).searchParams.get("kind") === "template" ? "TEMPLATE" : "NOTE";
  if (kind === "TEMPLATE" && !actor.canManage) return Response.json({ notes: [] }, { headers: { "Cache-Control": "no-store" } });
  const notes = await listNotes(actor, localeOf(request), kind);
  return Response.json({ notes }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const actor = await notesEditor();
  if (!actor) return Response.json({ error: "FORBIDDEN" }, { status: 403 });
  const form = await request.formData().catch(() => null);
  if (!form) return Response.json({ error: "INVALID" }, { status: 400 });
  try {
    const result = await createNote(actor, form, localeOf(request));
    if ("error" in result) return Response.json(result, { status: 400 });
    return Response.json(result, { status: 201 });
  } catch (error) {
    console.error("Create note failed", error);
    return Response.json({ error: "SAVE_FAILED" }, { status: 500 });
  }
}
