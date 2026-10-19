import { NextResponse } from "next/server";
import { createMcpConversation, logMcpPromptUsage, McpApiError } from "@/lib/mcp/client";
import { object } from "@/lib/mcp/prompt-data";
import { getMcpPortalContext } from "@/lib/mcp/portal-context";

export const runtime = "nodejs";

function text(value: unknown) { return typeof value === "string" ? value.trim() : ""; }

export async function POST(request: Request) {
  const body = object(await request.json().catch(() => null));
  const title = text(body.title).slice(0, 200);
  const promptId = text(body.promptId).slice(0, 160);
  if (!title) return NextResponse.json({ error: "TITLE_REQUIRED" }, { status: 400 });
  try {
    const context = await getMcpPortalContext();
    if ("error" in context) return NextResponse.json({ error: context.error }, { status: context.status });
    const result = object(await createMcpConversation(context.token, title, promptId || undefined));
    const nested = object(result.conversation);
    const id = text(result.id) || text(nested.id);
    if (!id) return NextResponse.json({ error: "INVALID_MCP_RESPONSE" }, { status: 502 });
    if (promptId) await logMcpPromptUsage(context.token, promptId, id, context.userId).catch(() => undefined);
    return NextResponse.json({ success: true, id }, { status: 201 });
  } catch (error) {
    console.error("MCP conversation could not be created.", error);
    return NextResponse.json({ error: "MCP_REQUEST_FAILED", message: error instanceof McpApiError ? error.message : "Conversation could not be created." }, { status: 502 });
  }
}
