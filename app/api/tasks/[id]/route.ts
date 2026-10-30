import { NextResponse } from "next/server";
import { tasksEditor, tasksViewer } from "../../../../lib/tasks/access";
import { getTask, readTaskRequest, updateTask, updateTaskStatus } from "../../../../lib/tasks/service";
import { supportedLocales } from "../../../../lib/i18n/dictionaries";

type Ctx = { params: Promise<{ id: string }> };

function localeOf(request: Request) {
  const locale = new URL(request.url).searchParams.get("locale") ?? "";
  return supportedLocales.includes(locale as (typeof supportedLocales)[number]) ? locale : "en";
}

export async function GET(request: Request, ctx: Ctx) {
  const actor = await tasksViewer();
  if (!actor) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const { id } = await ctx.params;
  const task = await getTask(actor, id, localeOf(request));
  if (!task) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  return NextResponse.json({ task, canManage: actor.canManage });
}

export async function PATCH(request: Request, ctx: Ctx) {
  const viewer = await tasksViewer();
  if (!viewer) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const { id } = await ctx.params;
  const { body, form } = await readTaskRequest(request);
  if (!body) return NextResponse.json({ error: "INVALID" }, { status: 400 });
  try {
    const status = typeof body.status === "string" ? body.status : "";
    if (status === "open" || status === "done" || status === "OPEN" || status === "DONE") {
      const result = await updateTaskStatus(viewer, id, status, localeOf(request), form);
      if ("error" in result) return NextResponse.json(result, { status: result.error === "NOT_FOUND" ? 404 : 400 });
      return NextResponse.json(result);
    }
    const actor = await tasksEditor();
    if (!actor) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    const result = await updateTask(actor, id, body, localeOf(request), form);
    if ("error" in result) return NextResponse.json(result, { status: result.error === "NOT_FOUND" ? 404 : 400 });
    return NextResponse.json(result);
  } catch (error) {
    console.error("Update task failed", error);
    return NextResponse.json({ error: "SAVE_FAILED" }, { status: 500 });
  }
}
