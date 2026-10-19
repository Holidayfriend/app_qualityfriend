import { NextResponse } from "next/server";
import { getMcpServerTools, getMcpServers, getMcpVectorStores, McpApiError, sendMcpChat } from "@/lib/mcp/client";
import { normalizeTools, normalizeVectorStores } from "@/lib/mcp/chat-data";
import { object, rows } from "@/lib/mcp/prompt-data";
import { getMcpPortalContext } from "@/lib/mcp/portal-context";

export const runtime = "nodejs";
const providers = new Set(["openai", "deepseek", "perplexity", "claude"]);
function text(value: unknown) { return typeof value === "string" ? value.trim() : ""; }

export async function POST(request: Request, { params }: { params: Promise<{ conversationId: string }> }) {
  const { conversationId } = await params;
  const body = object(await request.json().catch(() => null));
  const content = text(body.content).slice(0, 100_000);
  let provider = text(body.provider).toLowerCase();
  let model = text(body.model).slice(0, 120);
  if (!conversationId || conversationId.length > 160 || !content || !providers.has(provider) || !model) return NextResponse.json({ error: "INVALID_MESSAGE" }, { status: 400 });
  try {
    const context = await getMcpPortalContext();
    if ("error" in context) return NextResponse.json({ error: context.error }, { status: context.status });
    const payload: Record<string, unknown> = { conversationId, messages: [{ role: "user", content }], provider, model };
    const tool = object(body.tool);
    const knowledge = object(body.knowledge);

    if (text(tool.serverId) && text(tool.name)) {
      const servers = rows(await getMcpServers(context.token), ["servers", "data"]).map(object);
      const serverId = text(tool.serverId);
      if (!servers.some((server) => text(server.id) === serverId && server.isActive !== false)) return NextResponse.json({ error: "INVALID_TOOL_SERVER" }, { status: 400 });
      const tools = normalizeTools(await getMcpServerTools(context.token, serverId));
      const name = text(tool.name);
      if (!tools.some((item) => item.name === name)) return NextResponse.json({ error: "INVALID_TOOL" }, { status: 400 });
      payload.tool = { serverId, name, args: object(tool.args) };
    } else if (text(knowledge.vectorStoreId)) {
      const profile = object(context.profile), hotel = object(profile.hotel);
      const hotelId = text(profile.hotelId) || text(hotel.id);
      const vectorStoreId = text(knowledge.vectorStoreId);
      const stores = hotelId ? normalizeVectorStores(await getMcpVectorStores(context.token, hotelId)) : [];
      if (!stores.some((store) => store.id === vectorStoreId)) return NextResponse.json({ error: "INVALID_VECTOR_STORE" }, { status: 400 });
      provider = "openai"; model = "gpt-4o-mini";
      payload.provider = provider; payload.model = model;
      payload.knowledge = { enabled: true, vectorStoreId, topK: 5 };
    }

    const result = object(await sendMcpChat(context.token, payload));
    return NextResponse.json({ ...result, provider: text(result.provider) || provider, model: text(result.model) || model });
  } catch (error) {
    console.error("MCP chat message could not be sent.", error);
    return NextResponse.json({ error: "MCP_REQUEST_FAILED", message: error instanceof McpApiError ? error.message : "Message could not be sent." }, { status: 502 });
  }
}
