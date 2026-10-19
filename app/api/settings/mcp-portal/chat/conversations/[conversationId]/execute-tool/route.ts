import { NextResponse } from "next/server";
import { executeMcpTool, getMcpServerTools, getMcpServers, McpApiError } from "@/lib/mcp/client";
import { normalizeTools } from "@/lib/mcp/chat-data";
import { object, rows } from "@/lib/mcp/prompt-data";
import { getMcpPortalContext } from "@/lib/mcp/portal-context";

export const runtime = "nodejs";
function text(value: unknown) { return typeof value === "string" ? value.trim() : ""; }

export async function POST(request: Request, { params }: { params: Promise<{ conversationId: string }> }) {
  const { conversationId } = await params;
  const body = object(await request.json().catch(() => null));
  const serverId = text(body.serverId), tool = text(body.tool), args = object(body.arguments);
  if (!conversationId || conversationId.length > 160 || !serverId || !tool) return NextResponse.json({ error: "INVALID_TOOL_REQUEST" }, { status: 400 });
  try {
    const context = await getMcpPortalContext();
    if ("error" in context) return NextResponse.json({ error: context.error }, { status: context.status });
    const servers = rows(await getMcpServers(context.token), ["servers", "data"]).map(object);
    if (!servers.some((server) => text(server.id) === serverId && server.isActive !== false)) return NextResponse.json({ error: "INVALID_TOOL_SERVER" }, { status: 400 });
    if (!normalizeTools(await getMcpServerTools(context.token, serverId)).some((item) => item.name === tool)) return NextResponse.json({ error: "INVALID_TOOL" }, { status: 400 });
    const result = object(await executeMcpTool(context.token, conversationId, serverId, tool, args));
    const resultObject = object(result.result);
    const firstContent = rows(resultObject.content)[0];
    const content = text(object(firstContent).text);
    return NextResponse.json({ success: true, toolMessageId: text(result.toolMessageId), content, result });
  } catch (error) {
    console.error("MCP tool execution failed.", error);
    return NextResponse.json({ error: "MCP_REQUEST_FAILED", message: error instanceof McpApiError ? error.message : "Tool execution failed." }, { status: 502 });
  }
}
