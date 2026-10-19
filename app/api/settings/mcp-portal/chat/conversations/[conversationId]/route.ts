import { NextResponse } from "next/server";
import { deleteMcpConversation, getMcpConversationFiles, getMcpConversationMessages, getMcpConversations, McpApiError, updateMcpConversationTitle } from "@/lib/mcp/client";
import { normalizeChatFiles, normalizeConversationMessages, normalizeConversations } from "@/lib/mcp/chat-data";
import { object } from "@/lib/mcp/prompt-data";
import { getMcpPortalContext } from "@/lib/mcp/portal-context";

export const runtime = "nodejs";

function validId(id: string) { return Boolean(id) && id.length <= 160; }
function failure(error: unknown, fallback: string) { console.error(fallback, error); return NextResponse.json({ error: "MCP_REQUEST_FAILED", message: error instanceof McpApiError ? error.message : fallback }, { status: 502 }); }

export async function GET(_request: Request, { params }: { params: Promise<{ conversationId: string }> }) {
  const { conversationId } = await params;
  if (!validId(conversationId)) return NextResponse.json({ error: "INVALID_CONVERSATION_ID" }, { status: 400 });
  try {
    const context = await getMcpPortalContext();
    if ("error" in context) return NextResponse.json({ error: context.error }, { status: context.status });
    const [messagesPayload, filesPayload, conversationsPayload] = await Promise.all([
      getMcpConversationMessages(context.token, conversationId),
      getMcpConversationFiles(context.token, conversationId).catch(() => ({ files: [] })),
      getMcpConversations(context.token),
    ]);
    const conversations = normalizeConversations(conversationsPayload).filter((item) => !item.archived);
    const conversation = conversations.find((item) => item.id === conversationId) ?? null;
    const messageData = normalizeConversationMessages(messagesPayload);
    return NextResponse.json({ conversation, conversations, messages: messageData.messages, conversationProvider: messageData.conversation, files: normalizeChatFiles(filesPayload) });
  } catch (error) { return failure(error, "MCP conversation could not be loaded."); }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ conversationId: string }> }) {
  const { conversationId } = await params;
  const body = object(await request.json().catch(() => null));
  const title = typeof body.title === "string" ? body.title.trim().slice(0, 200) : "";
  if (!validId(conversationId) || !title) return NextResponse.json({ error: "INVALID_CONVERSATION" }, { status: 400 });
  try {
    const context = await getMcpPortalContext();
    if ("error" in context) return NextResponse.json({ error: context.error }, { status: context.status });
    const result = await updateMcpConversationTitle(context.token, conversationId, title);
    return NextResponse.json({ success: true, result });
  } catch (error) { return failure(error, "MCP conversation could not be renamed."); }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ conversationId: string }> }) {
  const { conversationId } = await params;
  if (!validId(conversationId)) return NextResponse.json({ error: "INVALID_CONVERSATION_ID" }, { status: 400 });
  try {
    const context = await getMcpPortalContext();
    if ("error" in context) return NextResponse.json({ error: context.error }, { status: context.status });
    const result = await deleteMcpConversation(context.token, conversationId);
    return NextResponse.json({ success: true, result });
  } catch (error) { return failure(error, "MCP conversation could not be deleted."); }
}
