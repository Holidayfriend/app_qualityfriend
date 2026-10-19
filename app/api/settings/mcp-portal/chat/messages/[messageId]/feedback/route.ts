import { NextResponse } from "next/server";
import { McpApiError, setMcpMessageFeedback } from "@/lib/mcp/client";
import { object } from "@/lib/mcp/prompt-data";
import { getMcpPortalContext } from "@/lib/mcp/portal-context";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ messageId: string }> }) {
  const { messageId } = await params;
  const body = object(await request.json().catch(() => null));
  const reaction = body.reaction === "like" || body.reaction === "dislike" || body.reaction === "none" ? body.reaction : null;
  if (!messageId || messageId.length > 160 || !reaction) return NextResponse.json({ error: "INVALID_FEEDBACK" }, { status: 400 });
  try {
    const context = await getMcpPortalContext();
    if ("error" in context) return NextResponse.json({ error: context.error }, { status: context.status });
    const result = await setMcpMessageFeedback(context.token, messageId, reaction);
    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error("MCP message feedback could not be saved.", error);
    return NextResponse.json({ error: "MCP_REQUEST_FAILED", message: error instanceof McpApiError ? error.message : "Feedback could not be saved." }, { status: 502 });
  }
}
