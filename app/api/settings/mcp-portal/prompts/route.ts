import { NextResponse, type NextRequest } from "next/server";
import {
  createMcpPrompt,
  getMcpHotelDepartments,
  getMcpHotelUsers,
  getMcpPromptCategories,
  getMcpPrompts,
  McpApiError,
  type McpPromptInput,
} from "@/lib/mcp/client";
import { normalizeCategories, normalizeDepartments, normalizePrompts, normalizeUsers, object } from "@/lib/mcp/prompt-data";
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

export async function GET(request: NextRequest) {
  try {
    const context = await getMcpPortalContext();
    if ("error" in context) return NextResponse.json({ error: context.error }, { status: context.status });
    const profile = object(context.profile);
    const role = text(profile.role);
    const userId = text(profile.id);
    const hotelId = text(profile.hotelId);
    const departmentId = text(profile.departmentId);
    if (!userId || !hotelId) return NextResponse.json({ error: "MCP_PROFILE_INCOMPLETE" }, { status: 409 });
    const search = (request.nextUrl.searchParams.get("search") ?? "").trim().slice(0, 200);
    const primaryPath = role === "author" ? "/prompts" : `/prompts/by-user/${encodeURIComponent(userId)}`;

    const [primaryPayload, departmentPayload, categoriesPayload, departmentsPayload, usersPayload] = await Promise.all([
      getMcpPrompts(context.token, primaryPath, search),
      departmentId ? getMcpPrompts(context.token, `/prompts/by-department/${encodeURIComponent(departmentId)}`, search).catch(() => []) : Promise.resolve([]),
      getMcpPromptCategories(context.token),
      role === "author" ? getMcpHotelDepartments(context.token, hotelId) : Promise.resolve([]),
      role === "author" ? getMcpHotelUsers(context.token, hotelId) : Promise.resolve([]),
    ]);
    const prompts = [...normalizePrompts(primaryPayload), ...normalizePrompts(departmentPayload)];
    const unique = [...new Map(prompts.map((prompt) => [prompt.id, prompt])).values()];
    return NextResponse.json({
      prompts: unique,
      categories: normalizeCategories(categoriesPayload),
      departments: normalizeDepartments(departmentsPayload),
      users: normalizeUsers(usersPayload),
      currentUserId: userId,
      currentDepartmentId: departmentId,
      canManage: role === "author",
    });
  } catch (error) {
    return failure(error, "MCP prompts could not be loaded.");
  }
}

export async function POST(request: Request) {
  const input = promptInput(await request.json().catch(() => null));
  if (!input) return NextResponse.json({ error: "INVALID_PROMPT" }, { status: 400 });
  try {
    const context = await getMcpPortalContext();
    if ("error" in context) return NextResponse.json({ error: context.error }, { status: context.status });
    if (context.profile.role !== "author") return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    const result = await createMcpPrompt(context.token, input);
    return NextResponse.json({ success: true, result }, { status: 201 });
  } catch (error) {
    return failure(error, "MCP prompt could not be created.");
  }
}
