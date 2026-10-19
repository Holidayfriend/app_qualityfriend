import { NextResponse } from "next/server";
import { getMcpConversationFiles, McpApiError, uploadMcpConversationFiles } from "@/lib/mcp/client";
import { normalizeChatFiles } from "@/lib/mcp/chat-data";
import { getMcpPortalContext } from "@/lib/mcp/portal-context";

export const runtime = "nodejs";
const allowedExtensions = new Set(["pdf", "docx", "txt", "csv", "xlsx", "pptx", "md", "zip", "png", "jpg", "jpeg", "webp"]);

function failure(error: unknown) { console.error("MCP conversation files request failed.", error); return NextResponse.json({ error: "MCP_REQUEST_FAILED", message: error instanceof McpApiError ? error.message : "Conversation files request failed." }, { status: 502 }); }

export async function GET(_request: Request, { params }: { params: Promise<{ conversationId: string }> }) {
  const { conversationId } = await params;
  if (!conversationId || conversationId.length > 160) return NextResponse.json({ error: "INVALID_CONVERSATION_ID" }, { status: 400 });
  try {
    const context = await getMcpPortalContext();
    if ("error" in context) return NextResponse.json({ error: context.error }, { status: context.status });
    return NextResponse.json({ files: normalizeChatFiles(await getMcpConversationFiles(context.token, conversationId)) });
  } catch (error) { return failure(error); }
}

export async function POST(request: Request, { params }: { params: Promise<{ conversationId: string }> }) {
  const { conversationId } = await params;
  if (!conversationId || conversationId.length > 160) return NextResponse.json({ error: "INVALID_CONVERSATION_ID" }, { status: 400 });
  const incoming = await request.formData().catch(() => null);
  const files = incoming?.getAll("files").filter((item): item is File => item instanceof File) ?? [];
  if (!files.length || files.length > 5 || files.some((file) => file.size > 25 * 1024 * 1024 || !allowedExtensions.has(file.name.split(".").pop()?.toLowerCase() ?? ""))) return NextResponse.json({ error: "INVALID_FILES" }, { status: 400 });
  try {
    const context = await getMcpPortalContext();
    if ("error" in context) return NextResponse.json({ error: context.error }, { status: context.status });
    const form = new FormData();
    files.forEach((file) => form.append("files", file, file.name));
    const result = await uploadMcpConversationFiles(context.token, conversationId, form);
    return NextResponse.json({ success: true, files: normalizeChatFiles(result), result });
  } catch (error) { return failure(error); }
}
