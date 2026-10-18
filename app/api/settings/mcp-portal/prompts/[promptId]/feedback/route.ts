import { NextResponse } from "next/server";
import { McpApiError, setMcpPromptFeedback } from "@/lib/mcp/client";
import { object } from "@/lib/mcp/prompt-data";
import { getMcpPortalContext } from "@/lib/mcp/portal-context";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ promptId: string }> }) {
  const { promptId } = await params;
  const body = object(await request.json().catch(() => null));
  const feedbackScore = typeof body.feedbackScore === "number" ? body.feedbackScore : Number(body.feedbackScore);
  const reaction = body.reaction === "like" || body.reaction === "dislike" || body.reaction === "none" ? body.reaction : null;

  if (!promptId || promptId.length > 160 || !Number.isFinite(feedbackScore) || feedbackScore < 0 || feedbackScore > 100 || !reaction) {
    return NextResponse.json({ error: "INVALID_FEEDBACK" }, { status: 400 });
  }

  try {
    const context = await getMcpPortalContext();
    if ("error" in context) return NextResponse.json({ error: context.error }, { status: context.status });
    const result = await setMcpPromptFeedback(context.token, promptId, Math.round(feedbackScore), reaction);
    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error("MCP prompt feedback could not be saved.", error);
    return NextResponse.json(
      { error: "MCP_REQUEST_FAILED", message: error instanceof McpApiError ? error.message : "MCP prompt feedback could not be saved." },
      { status: 502 },
    );
  }
}
