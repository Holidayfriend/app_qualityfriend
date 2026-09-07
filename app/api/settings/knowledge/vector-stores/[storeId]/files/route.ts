import { NextResponse } from "next/server";
import { getSessionUserId } from "../../../../../../../lib/auth/session";
import { loginMcpUser } from "../../../../../../../lib/mcp/client";
import { prisma } from "../../../../../../../lib/prisma";

type Context = { params: Promise<{ storeId: string }> };
const baseUrl = () => (process.env.MCP_API_BASE_URL || "https://apis.qualityfriend.solutions").replace(/\/$/, "");

async function context() {
  const userId = await getSessionUserId(); if (!userId) return null;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true, hotelTenantId: true, hotelTenant: { select: { activeMcp: true, mcpHotelId: true, mcpUserEmail: true, mcpUserPassword: true } } } });
  if (!user) return null; const hotel = user.hotelTenant;
  if (!hotel.activeMcp || !hotel.mcpHotelId || !hotel.mcpUserEmail || !hotel.mcpUserPassword) return { unavailable: true } as const;
  return { role: user.role, tenantId: user.hotelTenantId, hotelId: hotel.mcpHotelId, token: await loginMcpUser(hotel.mcpUserEmail, hotel.mcpUserPassword) };
}

async function read(response: Response) { const data = await response.json().catch(() => null); if (!response.ok) throw new Error(data?.details || data?.message || data?.error || "MCP knowledge request failed."); return data; }
function failed(error: unknown, code: string) { return NextResponse.json({ error: code, message: error instanceof Error ? error.message : "MCP knowledge request failed." }, { status: 502 }); }

export async function GET(_request: Request, { params }: Context) {
  try {
    const auth = await context(); if (!auth) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 }); if ("unavailable" in auth) return NextResponse.json({ error: "MCP_NOT_ACTIVE" }, { status: 409 });
    const storeId = (await params).storeId;
    const [result, departments] = await Promise.all([
      fetch(`${baseUrl()}/rag/vector-stores/${encodeURIComponent(storeId)}/files?limit=50&hotelId=${encodeURIComponent(auth.hotelId)}`, { headers: { Authorization: `Bearer ${auth.token}` }, cache: "no-store", signal: AbortSignal.timeout(15_000) }).then(read),
      prisma.department.findMany({ where: { hotelTenantId: auth.tenantId, isActive: true, isDeleted: false, mcpDepartmentId: { not: null } }, orderBy: { nameEn: "asc" }, select: { id: true, nameEn: true, nameDe: true, nameIt: true, mcpDepartmentId: true } }),
    ]);
    return NextResponse.json({ files: Array.isArray(result) ? result : result?.data ?? result?.files ?? [], departments });
  } catch (error) { return failed(error, "KNOWLEDGE_FILES_LOAD_FAILED"); }
}

export async function POST(request: Request, { params }: Context) {
  try {
    const auth = await context(); if (!auth) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 }); if ("unavailable" in auth) return NextResponse.json({ error: "MCP_NOT_ACTIVE" }, { status: 409 }); if (auth.role !== "ADMIN") return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    const input = await request.formData(), title = String(input.get("title") || "").trim(), description = String(input.get("description") || "").trim(), localDepartmentId = String(input.get("departmentId") || ""), tags = String(input.get("tags") || "");
    const files = input.getAll("files").filter((entry): entry is File => entry instanceof File), department = await prisma.department.findFirst({ where: { id: localDepartmentId, hotelTenantId: auth.tenantId, isActive: true, isDeleted: false }, select: { mcpDepartmentId: true } });
    if (!title || !description || !department?.mcpDepartmentId || !files.length || files.length > 20) return NextResponse.json({ error: "INVALID_FIELDS" }, { status: 400 });
    if (description.replace(/\s+/g, "").length > 510 || files.some(file => !/\.(pdf|doc|docx|txt|jpg|jpeg|png)$/i.test(file.name))) return NextResponse.json({ error: "INVALID_FILE_OR_DESCRIPTION" }, { status: 400 });
    const form = new FormData(); form.set("title", title); form.set("departmentId", department.mcpDepartmentId); form.set("description", description); form.set("hotelId", auth.hotelId); if (tags) form.set("tags", JSON.stringify(tags.split(",").map(tag => tag.trim()).filter(Boolean))); files.forEach(file => form.append("files", file, file.name));
    return NextResponse.json(await read(await fetch(`${baseUrl()}/rag/vector-stores/${encodeURIComponent((await params).storeId)}/files`, { method: "POST", headers: { Authorization: `Bearer ${auth.token}` }, body: form, cache: "no-store", signal: AbortSignal.timeout(60_000) })));
  } catch (error) { return failed(error, "KNOWLEDGE_FILES_UPLOAD_FAILED"); }
}

export async function DELETE(request: Request, { params }: Context) {
  try {
    const auth = await context(); if (!auth) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 }); if ("unavailable" in auth) return NextResponse.json({ error: "MCP_NOT_ACTIVE" }, { status: 409 }); if (auth.role !== "ADMIN") return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    const fileId = new URL(request.url).searchParams.get("fileId"); if (!fileId) return NextResponse.json({ error: "MISSING_FILE_ID" }, { status: 400 });
    const response = await fetch(`${baseUrl()}/rag/vector-stores/${encodeURIComponent((await params).storeId)}/files/${encodeURIComponent(fileId)}?hotelId=${encodeURIComponent(auth.hotelId)}`, { method: "DELETE", headers: { Authorization: `Bearer ${auth.token}` }, cache: "no-store", signal: AbortSignal.timeout(15_000) }); if (response.status !== 204) await read(response); return NextResponse.json({ success: true });
  } catch (error) { return failed(error, "KNOWLEDGE_FILE_DELETE_FAILED"); }
}
