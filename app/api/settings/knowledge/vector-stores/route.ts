import { NextResponse } from "next/server";
import { getSessionUserId } from "../../../../../lib/auth/session";
import { loginMcpUser } from "../../../../../lib/mcp/client";
import { prisma } from "../../../../../lib/prisma";

const baseUrl = () => (process.env.MCP_API_BASE_URL || "https://apis.qualityfriend.solutions").replace(/\/$/, "");

async function context() {
  const userId = await getSessionUserId();
  if (!userId) return null;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true, hotelTenantId: true, hotelTenant: { select: { activeMcp: true, mcpHotelId: true, mcpUserEmail: true, mcpUserPassword: true } } } });
  if (!user) return null;
  const hotel = user.hotelTenant;
  if (!hotel.activeMcp || !hotel.mcpHotelId || !hotel.mcpUserEmail || !hotel.mcpUserPassword) return { unavailable: true } as const;
  return { role: user.role, tenantId: user.hotelTenantId, hotelId: hotel.mcpHotelId, token: await loginMcpUser(hotel.mcpUserEmail, hotel.mcpUserPassword) };
}

async function payload(response: Response) {
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.details || data?.message || data?.error || "MCP vector store request failed.");
  return data;
}

export async function GET() {
  try {
    const auth = await context();
    if (!auth) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
    if ("unavailable" in auth) return NextResponse.json({ error: "MCP_NOT_ACTIVE" }, { status: 409 });
    const [stores, departments] = await Promise.all([
      fetch(`${baseUrl()}/rag/vector-stores?hotelId=${encodeURIComponent(auth.hotelId)}`, { headers: { Authorization: `Bearer ${auth.token}` }, cache: "no-store", signal: AbortSignal.timeout(15_000) }).then(payload),
      prisma.department.findMany({ where: { hotelTenantId: auth.tenantId, isActive: true, isDeleted: false }, orderBy: { nameEn: "asc" }, select: { id: true, nameEn: true, nameDe: true, nameIt: true, mcpDepartmentId: true } }),
    ]);
    return NextResponse.json({ stores: Array.isArray(stores) ? stores : stores?.vectorStores ?? stores?.data ?? [], departments });
  } catch (error) { return NextResponse.json({ error: "VECTOR_STORES_LOAD_FAILED", message: error instanceof Error ? error.message : "Vector stores could not be loaded." }, { status: 502 }); }
}

export async function POST(request: Request) {
  try {
    const auth = await context();
    if (!auth) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
    if ("unavailable" in auth) return NextResponse.json({ error: "MCP_NOT_ACTIVE" }, { status: 409 });
    if (auth.role !== "ADMIN") return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    const body = await request.json().catch(() => null), name = typeof body?.name === "string" ? body.name.trim() : "", departmentId = typeof body?.departmentId === "string" ? body.departmentId : "";
    const department = await prisma.department.findFirst({ where: { id: departmentId, hotelTenantId: auth.tenantId, isActive: true, isDeleted: false }, select: { mcpDepartmentId: true } });
    if (!name || !department?.mcpDepartmentId) return NextResponse.json({ error: "INVALID_FIELDS", message: "A synchronized MCP department is required." }, { status: 400 });
    const response = await fetch(`${baseUrl()}/rag/vector-stores`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${auth.token}` }, body: JSON.stringify({ hotelId: auth.hotelId, departmentId: department.mcpDepartmentId, name }), cache: "no-store", signal: AbortSignal.timeout(15_000) });
    return NextResponse.json(await payload(response));
  } catch (error) { return NextResponse.json({ error: "VECTOR_STORE_CREATE_FAILED", message: error instanceof Error ? error.message : "Vector store could not be created." }, { status: 502 }); }
}

export async function DELETE(request: Request) {
  try {
    const auth = await context();
    if (!auth) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
    if ("unavailable" in auth) return NextResponse.json({ error: "MCP_NOT_ACTIVE" }, { status: 409 });
    if (auth.role !== "ADMIN") return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    const id = new URL(request.url).searchParams.get("id");
    if (!id) return NextResponse.json({ error: "MISSING_ID" }, { status: 400 });
    const response = await fetch(`${baseUrl()}/rag/vector-stores/${encodeURIComponent(id)}?hotelId=${encodeURIComponent(auth.hotelId)}`, { method: "DELETE", headers: { Authorization: `Bearer ${auth.token}` }, cache: "no-store", signal: AbortSignal.timeout(15_000) });
    if (response.status !== 204) await payload(response);
    return NextResponse.json({ success: true });
  } catch (error) { return NextResponse.json({ error: "VECTOR_STORE_DELETE_FAILED", message: error instanceof Error ? error.message : "Vector store could not be deleted." }, { status: 502 }); }
}
