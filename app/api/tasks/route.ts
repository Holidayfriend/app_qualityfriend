import { NextResponse } from "next/server";
import { tasksEditor, tasksViewer } from "../../../lib/tasks/access";
import { createTask, listTasks } from "../../../lib/tasks/service";
import { supportedLocales } from "../../../lib/i18n/dictionaries";

function localeOf(request: Request) {
  const locale = new URL(request.url).searchParams.get("locale") ?? "";
  return supportedLocales.includes(locale as (typeof supportedLocales)[number]) ? locale : "en";
}

export async function GET(request: Request) {
  const actor = await tasksViewer();
  if (!actor) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  try {
    const tasks = await listTasks(actor, localeOf(request));
    return NextResponse.json({ tasks, canManage: actor.canManage });
  } catch (error) {
    console.error("List tasks failed", error);
    return NextResponse.json({ tasks: [], canManage: actor.canManage });
  }
}

export async function POST(request: Request) {
  const actor = await tasksEditor();
  if (!actor) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "INVALID" }, { status: 400 });
  try {
    const result = await createTask(actor, body, localeOf(request));
    if ("error" in result) return NextResponse.json(result, { status: 400 });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error("Create task failed", error);
    return NextResponse.json({ error: "SAVE_FAILED" }, { status: 500 });
  }
}
