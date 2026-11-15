import { notesEditor, notesViewer } from "../../../../lib/notes/access";
import { getNote, isUuid, updateNote, updateNoteStamp, updateNoteStatus } from "../../../../lib/notes/service";
import { supportedLocales } from "../../../../lib/i18n/dictionaries";

type Context = { params: Promise<{ id: string }> };

function localeOf(request: Request) {
  const locale = new URL(request.url).searchParams.get("locale") ?? "";
  return supportedLocales.includes(locale as (typeof supportedLocales)[number]) ? locale : "en";
}

export async function GET(request: Request, context: Context) {
  const actor = await notesViewer();
  if (!actor) return Response.json({ error: "FORBIDDEN" }, { status: 403 });
  const { id } = await context.params;
  if (!isUuid(id)) return Response.json({ error: "NOT_FOUND" }, { status: 404 });
  const note = await getNote(actor, id, localeOf(request));
  if (!note) return Response.json({ error: "NOT_FOUND" }, { status: 404 });
  return Response.json({ note }, { headers: { "Cache-Control": "no-store" } });
}

export async function PATCH(request: Request, context: Context) {
  const actor = await notesEditor();
  if (!actor) return Response.json({ error: "FORBIDDEN" }, { status: 403 });
  const { id } = await context.params;
  const locale = localeOf(request);
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const body = await request.json().catch(() => null) as { status?: string; createdAt?: string; email?: string } | null;
    if (body && (typeof body.createdAt === "string" || typeof body.email === "string")) {
      const result = await updateNoteStamp(actor, id, { createdAt: body.createdAt, email: body.email }, locale);
      if ("error" in result) {
        const status = result.error === "FORBIDDEN" ? 403 : result.error === "NOT_FOUND" ? 404 : 400;
        return Response.json(result, { status });
      }
      return Response.json(result);
    }
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
