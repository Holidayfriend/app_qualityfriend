import { NextResponse } from "next/server";
import {
  getMcpConversationsByPrompt,
  getMcpPrompt,
  getMcpPromptFeedback,
  getMcpPromptsByCategory,
  deleteMcpPrompt,
  McpApiError,
  updateMcpPrompt,
  type McpPromptInput,
} from "@/lib/mcp/client";
import { normalizeConversations, normalizePrompt, normalizePromptFeedback, normalizePrompts, object } from "@/lib/mcp/prompt-data";
import { getMcpPortalContext } from "@/lib/mcp/portal-context";

export const runtime = "nodejs";

function text(value: unknown) { return typeof value === "string" ? value : ""; }

function failure(error: unknown, fallback: string) {
  console.error(fallback, error);
  return NextResponse.json({ error: "MCP_REQUEST_FAILED", message: error instanceof McpApiError ? error.message : fallback }, { status: 502 });
}

function promptInput(value: unknown): McpPromptInput | null {
  const body = object(value);
  const title = text(body.title).trim().slice(0, 200);
  const promptBody = text(body.body).trim().slice(0, 20_000);
  const version = text(body.version).trim().slice(0, 40);
  const categoryId = text(body.categoryId).trim();
  const departmentId = text(body.departmentId).trim();
  const assignedUserId = Array.isArray(body.assignedUserId)
    ? [...new Set(body.assignedUserId.filter((item): item is string => typeof item === "string" && Boolean(item.trim())).map((item) => item.trim()))].slice(0, 200)
    : [];
  const tags = Array.isArray(body.tags)
    ? [...new Set(body.tags.filter((item): item is string => typeof item === "string" && Boolean(item.trim())).map((item) => item.trim().toLowerCase().slice(0, 60)))].slice(0, 30)
    : [];
  if (!title || !promptBody || !version || !categoryId || !departmentId || !assignedUserId.length) return null;
  return { title, body: promptBody, version, categoryId, departmentId, assignedUserId, tags };
}

export async function GET(_request: Request, { params }: { params: Promise<{ promptId: string }> }) {
  const { promptId } = await params;
  if (!promptId || promptId.length > 160) return NextResponse.json({ error: "INVALID_PROMPT_ID" }, { status: 400 });
  try {
    const context = await getMcpPortalContext();
    if ("error" in context) return NextResponse.json({ error: context.error }, { status: context.status });
    const prompt = normalizePrompt(await getMcpPrompt(context.token, promptId));
    if (!prompt) return NextResponse.json({ error: "PROMPT_NOT_FOUND" }, { status: 404 });

    const [feedbackPayload, similarPayload, conversationsPayload] = await Promise.all([
      getMcpPromptFeedback(context.token, promptId).catch(() => null),
      prompt.categoryId ? getMcpPromptsByCategory(context.token, prompt.categoryId).catch(() => []) : Promise.resolve([]),
      getMcpConversationsByPrompt(context.token, promptId).catch(() => []),
    ]);
    const similarPrompts = normalizePrompts(similarPayload).filter((item) => item.id !== prompt.id).slice(0, 6);

    return NextResponse.json({
      prompt,
      feedback: normalizePromptFeedback(feedbackPayload),
      similarPrompts,
      conversations: normalizeConversations(conversationsPayload),
      canManage: context.profile.role === "author",
    });
  } catch (error) {
    return failure(error, "MCP prompt could not be loaded.");
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ promptId: string }> }) {
  const { promptId } = await params;
  const input = promptInput(await request.json().catch(() => null));
  if (!promptId || promptId.length > 160 || !input) return NextResponse.json({ error: "INVALID_PROMPT" }, { status: 400 });
  try {
    const context = await getMcpPortalContext();
    if ("error" in context) return NextResponse.json({ error: context.error }, { status: context.status });
    if (context.profile.role !== "author") return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    const result = await updateMcpPrompt(context.token, promptId, input);
    return NextResponse.json({ success: true, result });
  } catch (error) {
    return failure(error, "MCP prompt could not be updated.");
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ promptId: string }> }) {
  const { promptId } = await params;
  if (!promptId || promptId.length > 160) return NextResponse.json({ error: "INVALID_PROMPT_ID" }, { status: 400 });
  try {
    const context = await getMcpPortalContext();
    if ("error" in context) return NextResponse.json({ error: context.error }, { status: context.status });
    if (context.profile.role !== "author") return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    const result = await deleteMcpPrompt(context.token, promptId);
    return NextResponse.json({ success: true, result });
  } catch (error) {
    return failure(error, "MCP prompt could not be deleted.");
  }
}
