import { notesActor } from "../../../../../lib/notes/access";
import { addNoteComment, isUuid } from "../../../../../lib/notes/service";
import { supportedLocales } from "../../../../../lib/i18n/dictionaries";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  const actor = await notesActor();
  if (!actor) return Response.json({ error: "FORBIDDEN" }, { status: 403 });
  const { id } = await context.params;
  if (!isUuid(id)) return Response.json({ error: "NOT_FOUND" }, { status: 404 });
  const locale = new URL(request.url).searchParams.get("locale") ?? "";
  const lang = supportedLocales.includes(locale as (typeof supportedLocales)[number]) ? locale : "en";
  const body = await request.json().catch(() => null) as { text?: string } | null;
  const result = await addNoteComment(actor, id, String(body?.text ?? ""), lang);
  if ("error" in result) {
    const status = result.error === "COMMENT_REQUIRED" ? 400 : 404;
    return Response.json(result, { status });
  }
  return Response.json(result, { status: 201 });
}
