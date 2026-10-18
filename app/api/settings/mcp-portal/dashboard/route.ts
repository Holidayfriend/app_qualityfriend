import { NextResponse } from "next/server";
import {
  getMcpAuthorStats,
  getMcpPromptCategories,
  getMcpPromptFeedbacks,
  getMcpPrompts,
  getMcpTrainingStatus,
  McpApiError,
  resetMcpTraining,
  syncMcpTraining,
} from "@/lib/mcp/client";
import {
  normalizeDashboardFeedbacks,
  normalizeDashboardPrompts,
  normalizeDashboardStats,
  normalizeTrainingStatus,
} from "@/lib/mcp/dashboard-data";
import { normalizeCategories, object } from "@/lib/mcp/prompt-data";
import { getMcpPortalContext } from "@/lib/mcp/portal-context";

export const runtime = "nodejs";

function failure(error: unknown, fallback: string) {
  console.error(fallback, error);
  return NextResponse.json({ error: "MCP_REQUEST_FAILED", message: error instanceof McpApiError ? error.message : fallback }, { status: 502 });
}

export async function GET() {
  try {
    const context = await getMcpPortalContext();
    if ("error" in context) return NextResponse.json({ error: context.error }, { status: context.status });
    const [prompts, feedbacks, stats, training, categories] = await Promise.all([
      getMcpPrompts(context.token).catch(() => []),
      getMcpPromptFeedbacks(context.token).catch(() => ({ feedbacks: [] })),
      getMcpAuthorStats(context.token).catch(() => ({})),
      getMcpTrainingStatus(context.token).catch(() => ({})),
      getMcpPromptCategories(context.token).catch(() => []),
    ]);
    return NextResponse.json({
      prompts: normalizeDashboardPrompts(prompts),
      feedbacks: normalizeDashboardFeedbacks(feedbacks),
      stats: normalizeDashboardStats(stats),
      training: normalizeTrainingStatus(training),
      categories: normalizeCategories(categories),
      canManage: context.profile.role === "author",
    });
  } catch (error) {
    return failure(error, "MCP dashboard could not be loaded.");
  }
}

export async function POST(request: Request) {
  const body = object(await request.json().catch(() => null));
  const action = typeof body.action === "string" ? body.action : "";
  if (action !== "training-sync" && action !== "training-reset") return NextResponse.json({ error: "INVALID_ACTION" }, { status: 400 });
  try {
    const context = await getMcpPortalContext();
    if ("error" in context) return NextResponse.json({ error: context.error }, { status: context.status });
    if (context.profile.role !== "author") return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    const result = action === "training-sync" ? await syncMcpTraining(context.token) : await resetMcpTraining(context.token);
    return NextResponse.json({ success: true, result });
  } catch (error) {
    return failure(error, action === "training-sync" ? "MCP training could not be synchronized." : "MCP training could not be reset.");
  }
}
