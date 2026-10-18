import { NextResponse } from "next/server";
import { createMcpPromptCategory, getMcpPromptCategories, McpApiError } from "@/lib/mcp/client";
import { getMcpPortalContext } from "@/lib/mcp/portal-context";

export const runtime = "nodejs";

type JsonObject = Record<string, unknown>;

function object(value: unknown): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : {};
}

function categoryRows(payload: unknown) {
  const root = object(payload);
  const rows = Array.isArray(payload)
    ? payload
    : Array.isArray(root.categories)
      ? root.categories
      : Array.isArray(root.data)
        ? root.data
        : [];
  return rows.flatMap((value, index) => {
    const row = object(value);
    const name = typeof row.name === "string" ? row.name.trim() : "";
    if (!name) return [];
    const id = typeof row.id === "string" && row.id ? row.id : `${name}-${index}`;
    return [{ id, name }];
  });
}

function failure(error: unknown, fallback: string) {
  console.error(fallback, error);
  return NextResponse.json(
    { error: "MCP_REQUEST_FAILED", message: error instanceof McpApiError ? error.message : fallback },
    { status: 502 },
  );
}

export async function GET() {
  try {
    const context = await getMcpPortalContext();
    if ("error" in context) return NextResponse.json({ error: context.error }, { status: context.status });
    const payload = await getMcpPromptCategories(context.token);
    return NextResponse.json({
      categories: categoryRows(payload),
      canCreate: context.profile.role === "author",
    });
  } catch (error) {
    return failure(error, "MCP prompt categories could not be loaded.");
  }
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const name = body && typeof body.name === "string" ? body.name.trim() : "";
  if (!name || name.length > 120) return NextResponse.json({ error: "CATEGORY_NAME_REQUIRED" }, { status: 400 });

  try {
    const context = await getMcpPortalContext();
    if ("error" in context) return NextResponse.json({ error: context.error }, { status: context.status });
    if (context.profile.role !== "author") return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    await createMcpPromptCategory(context.token, name);
    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    return failure(error, "MCP prompt category could not be created.");
  }
}
