import { NextResponse } from "next/server";
import { currentAccessUser } from "../../../../../lib/auth/module-access";
import { createChannelMessage, readChannelMessages } from "../../../../../lib/chat/channel";
import { prisma } from "../../../../../lib/prisma";

async function departmentInHotel(departmentId: string, user: { id: string; hotel_tenant_id: string; role: string }) {
  const department = await prisma.department.findFirst({
    where: { id: departmentId, hotelTenantId: user.hotel_tenant_id, isActive: true, isDeleted: false },
    select: { id: true },
  });
  if (!department || user.role === "ADMIN") return department;
  return prisma.user.findFirst({ where: { id: user.id, departmentId }, select: { id: true } });
}

export async function GET(request: Request, { params }: { params: Promise<{ departmentId: string }> }) {
  const current = await currentAccessUser();
  if (!current) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  const { departmentId } = await params;
  if (!await departmentInHotel(departmentId, current)) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  await prisma.departmentChatRead.upsert({
    where: { userId_departmentId: { userId: current.id, departmentId } },
    create: { userId: current.id, departmentId, lastReadAt: new Date() },
    update: { lastReadAt: new Date() },
  });
  const before = new URL(request.url).searchParams.get("before");
  return NextResponse.json(await readChannelMessages({ hotelTenantId: current.hotel_tenant_id, departmentId }, before));
}

export async function POST(request: Request, { params }: { params: Promise<{ departmentId: string }> }) {
  const current = await currentAccessUser();
  if (!current) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  const { departmentId } = await params;
  if (!await departmentInHotel(departmentId, current)) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  const result = await createChannelMessage({
    hotelTenantId: current.hotel_tenant_id,
    senderId: current.id,
    departmentId,
    form: await request.formData(),
  });
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ message: result.message }, { status: result.status });
}
