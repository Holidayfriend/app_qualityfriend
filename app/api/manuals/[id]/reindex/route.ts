import { NextResponse } from "next/server";
import { manualsEditor } from "@/lib/manuals/access";
import { reindexManual } from "@/lib/manuals/service";

type Context = { params: Promise<{ id: string }> };

export const runtime = "nodejs";

export async function POST(_request: Request, context: Context) {
  const actor = await manualsEditor();
  if (!actor) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const { id } = await context.params;
  try {
    const result = await reindexManual(actor, id);
    if ("error" in result) {
      const status = result.error === "NOT_FOUND" ? 404 : 400;
      return NextResponse.json(result, { status });
    }
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "INDEX_FAILED" }, { status: 500 });
  }
}
