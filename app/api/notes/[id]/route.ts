import { notesActor } from "../../../../lib/notes/access";
import { getNote, isUuid, updateNote, updateNoteStatus } from "../../../../lib/notes/service";
import { supportedLocales } from "../../../../lib/i18n/dictionaries";

type Context = { params: Promise<{ id: string }> };

function localeOf(request: Request) {
  const locale = new URL(request.url).searchParams.get("locale") ?? "";
  return supportedLocales.includes(locale as (typeof supportedLocales)[number]) ? locale : "en";
}

export async function GET(request: Request, context: Context) {
  const actor = await notesActor();
  if (!actor) return Response.json({ error: "FORBIDDEN" }, { status: 403 });
  const { id } = await context.params;
  if (!isUuid(id)) return Response.json({ error: "NOT_FOUND" }, { status: 404 });
  const note = await getNote(actor, id, localeOf(request));
  if (!note) return Response.json({ error: "NOT_FOUND" }, { status: 404 });
  return Response.json({ note }, { headers: { "Cache-Control": "no-store" } });
}

export async function PATCH(request: Request, context: Context) {
  const actor = await notesActor();
  if (!actor) return Response.json({ error: "FORBIDDEN" }, { status: 403 });
  const { id } = await context.params;
  const locale = localeOf(request);
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const body = await request.json().catch(() => null) as { status?: string } | null;
    const status = body?.status === "inaktiv" ? "INACTIVE" : body?.status === "aktiv" ? "ACTIVE" : null;
    if (!status) return Response.json({ error: "INVALID" }, { status: 400 });
    const result = await updateNoteStatus(actor, id, status, locale);
    if ("error" in result) return Response.json(result, { status: result.error === "FORBIDDEN" ? 403 : 404 });
    return Response.json(result);
  }
  const form = await request.formData().catch(() => null);
  if (!form) return Response.json({ error: "INVALID" }, { status: 400 });
  try {
    const result = await updateNote(actor, id, form, locale);
    if ("error" in result) {
      const status = result.error === "FORBIDDEN" ? 403 : result.error === "TITLE_REQUIRED" ? 400 : 404;
      return Response.json(result, { status });
    }
    return Response.json(result);
  } catch (error) {
    console.error("Update note failed", error);
    return Response.json({ error: "SAVE_FAILED" }, { status: 500 });
  }
}
