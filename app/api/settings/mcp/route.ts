import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { getSessionUserId, setMcpSessionToken } from "../../../../lib/auth/session";
import { createDefaultMcpServers, createMcpDepartment, createMcpHotel, createMcpUser, loginMcpUser, McpApiError } from "../../../../lib/mcp/client";
import { syncMissingMcpDepartments } from "../../../../lib/mcp/department-sync";
import { syncMissingMcpUsers } from "../../../../lib/mcp/user-sync";
import { prisma } from "../../../../lib/prisma";

async function actor() { const id = await getSessionUserId(); if (!id) return null; return prisma.user.findFirst({ where: { id, isActive: true, isDeleted: false }, select: { id: true, role: true, hotelTenantId: true } }); }

export async function GET() {
  const current = await actor(); if (!current) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  const hotel = await prisma.hotelTenant.findUnique({ where: { id: current.hotelTenantId }, select: { activeMcp: true, mcpHotelId: true, mcpUserEmail: true, mcpUserDepartment: true } });
  return NextResponse.json({ active: Boolean(hotel?.activeMcp && hotel.mcpHotelId), hotelId: hotel?.mcpHotelId ?? null, userEmail: hotel?.mcpUserEmail ?? null, departmentId: hotel?.mcpUserDepartment ?? null });
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
