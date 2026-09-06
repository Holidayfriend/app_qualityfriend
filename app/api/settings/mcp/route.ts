import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { getSessionUserId, setMcpSessionToken } from "../../../../lib/auth/session";
import { createDefaultMcpServers, createMcpDepartment, createMcpHotel, createMcpUser, getMcpProviderCredentials, getMcpProviders, loginMcpUser, McpApiError, setMcpProvider, setMcpProviderCredentials, type McpProvider } from "../../../../lib/mcp/client";
import { syncMissingMcpDepartments } from "../../../../lib/mcp/department-sync";
import { syncMissingMcpUsers } from "../../../../lib/mcp/user-sync";
import { prisma } from "../../../../lib/prisma";

async function actor() { const id = await getSessionUserId(); if (!id) return null; return prisma.user.findFirst({ where: { id, isActive: true, isDeleted: false }, select: { id: true, role: true, hotelTenantId: true } }); }

export async function GET() {
  const current = await actor(); if (!current) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  const hotel = await prisma.hotelTenant.findUnique({ where: { id: current.hotelTenantId }, select: { activeMcp: true, mcpHotelId: true, mcpUserEmail: true, mcpUserDepartment: true } });
  let credentials: Record<string, unknown> = {}, providerStates: unknown = [];
  if (hotel?.activeMcp && hotel.mcpHotelId) {
    const auth = await prisma.hotelTenant.findUnique({ where: { id: current.hotelTenantId }, select: { mcpUserEmail: true, mcpUserPassword: true } });
    if (auth?.mcpUserEmail && auth.mcpUserPassword) { try { const token = await loginMcpUser(auth.mcpUserEmail, auth.mcpUserPassword); [credentials, providerStates] = await Promise.all([Promise.all(providers.map(async (provider) => { try { return [provider, await getMcpProviderCredentials(token, hotel.mcpHotelId!, provider)] as const; } catch { return [provider, { hasKey: false }] as const; } })).then(Object.fromEntries), getMcpProviders(token, hotel.mcpHotelId)]); } catch { credentials = {}; providerStates = []; } }
  }
  return NextResponse.json({ active: Boolean(hotel?.activeMcp && hotel.mcpHotelId), hotelId: hotel?.mcpHotelId ?? null, userEmail: hotel?.mcpUserEmail ?? null, departmentId: hotel?.mcpUserDepartment ?? null, credentials, providerStates });
}

const providerConfig = { openai: { baseUrl: "https://api.openai.com/v1", label: "OpenAI prod" }, deepseek: { baseUrl: "https://api.deepseek.com/v1", label: "DeepSeek prod" }, perplexity: { baseUrl: "https://api.perplexity.ai", label: "Perplexity prod" }, brevo: { baseUrl: "https://api.brevo.com/v3", label: "Brevo API key" }, claude: { baseUrl: "https://api.anthropic.com/v1", label: "Claude prod" } } as const;
const providers = Object.keys(providerConfig) as McpProvider[];

export async function PUT(request: Request) {
  const current = await actor(); if (!current) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 }); if (current.role !== "ADMIN") return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const body = await request.json().catch(() => null), provider = typeof body?.provider === "string" ? body.provider as McpProvider : null, apiKey = typeof body?.apiKey === "string" ? body.apiKey.trim() : "", type = body?.type === "provider" ? "provider" : "credentials";
  if (!provider || !providers.includes(provider) || (type === "credentials" && !apiKey) || (type === "provider" && (provider === "brevo" || typeof body?.isEnabled !== "boolean" || typeof body?.defaultModel !== "string" || !body.defaultModel))) return NextResponse.json({ error: "INVALID_FIELDS" }, { status: 400 });
  const hotel = await prisma.hotelTenant.findUnique({ where: { id: current.hotelTenantId }, select: { activeMcp: true, mcpHotelId: true, mcpUserEmail: true, mcpUserPassword: true } });
  if (!hotel?.activeMcp || !hotel.mcpHotelId || !hotel.mcpUserEmail || !hotel.mcpUserPassword) return NextResponse.json({ error: "MCP_NOT_ACTIVE" }, { status: 409 });
  try { const token = await loginMcpUser(hotel.mcpUserEmail, hotel.mcpUserPassword); if (type === "provider" && provider !== "brevo") return NextResponse.json(await setMcpProvider(token, hotel.mcpHotelId, provider, body.isEnabled, body.defaultModel)); const config = providerConfig[provider]; return NextResponse.json(await setMcpProviderCredentials(token, hotel.mcpHotelId, provider, apiKey, config.baseUrl, config.label)); }
  catch (error) { console.error("MCP credential update failed", error); return NextResponse.json({ error: "MCP_CREDENTIAL_UPDATE_FAILED", message: error instanceof Error ? error.message : "Credential update failed." }, { status: 502 }); }
}

export async function POST() {
  const current = await actor(); if (!current) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  if (current.role !== "ADMIN") return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const hotel = await prisma.hotelTenant.findUnique({ where: { id: current.hotelTenantId }, select: { id: true, hotelNameEn: true, hotelNameDe: true, hotelNameIt: true, activeMcp: true, mcpHotelId: true, mcpUserEmail: true, mcpUserPassword: true, mcpUserDepartment: true } });
  if (!hotel) return NextResponse.json({ error: "HOTEL_NOT_FOUND" }, { status: 404 });
  try {
    if (hotel.activeMcp && hotel.mcpHotelId && hotel.mcpUserEmail && hotel.mcpUserPassword) {
      const token = await loginMcpUser(hotel.mcpUserEmail, hotel.mcpUserPassword);
      await syncMissingMcpDepartments(hotel.id, hotel.mcpHotelId, token);
      if (hotel.mcpUserDepartment) await syncMissingMcpUsers(hotel.id, { hotelId: hotel.mcpHotelId, defaultDepartmentId: hotel.mcpUserDepartment, token });
      await setMcpSessionToken(token);
      return NextResponse.json({ active: true, hotelId: hotel.mcpHotelId, userEmail: hotel.mcpUserEmail, departmentId: hotel.mcpUserDepartment });
    }
    const mcpHotelId = hotel.mcpHotelId || await createMcpHotel(hotel.hotelNameEn || hotel.hotelNameDe || hotel.hotelNameIt);
    if (!hotel.mcpHotelId) await prisma.hotelTenant.update({ where: { id: hotel.id }, data: { mcpHotelId } });
    const departmentId = hotel.mcpUserDepartment || await createMcpDepartment(mcpHotelId);
    if (!hotel.mcpUserDepartment) await prisma.hotelTenant.update({ where: { id: hotel.id }, data: { mcpUserDepartment: departmentId } });
    let email = hotel.mcpUserEmail, password = hotel.mcpUserPassword;
    if (!email || !password) {
      email = `mcp-${hotel.id}@qualityfriend.solutions`; password = randomBytes(24).toString("base64url");
      await createMcpUser(email, password, mcpHotelId, departmentId);
      await prisma.hotelTenant.update({ where: { id: hotel.id }, data: { mcpUserEmail: email, mcpUserPassword: password } });
    }
    const token = await loginMcpUser(email, password);
    await createDefaultMcpServers(mcpHotelId);
    await syncMissingMcpDepartments(hotel.id, mcpHotelId, token);
    await syncMissingMcpUsers(hotel.id, { hotelId: mcpHotelId, defaultDepartmentId: departmentId, token });
    await prisma.hotelTenant.update({ where: { id: hotel.id }, data: { activeMcp: true } });
    await setMcpSessionToken(token);
    return NextResponse.json({ active: true, hotelId: mcpHotelId, userEmail: email, departmentId });
  } catch (error) {
    const message = error instanceof McpApiError ? error.message : "MCP activation failed.";
    console.error("MCP activation failed", error);
    return NextResponse.json({ error: "MCP_ACTIVATION_FAILED", message }, { status: 502 });
  }
}
