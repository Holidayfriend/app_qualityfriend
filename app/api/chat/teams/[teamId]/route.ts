import { NextResponse } from "next/server";
import { currentAccessUser } from "../../../../../lib/auth/module-access";
import { createChannelMessage, readChannelMessages } from "../../../../../lib/chat/channel";
import { prisma } from "../../../../../lib/prisma";

async function teamInHotel(teamId: string, user: { id: string; hotel_tenant_id: string; role: string }) {
  const team = await prisma.team.findFirst({
    where: { id: teamId, hotelTenantId: user.hotel_tenant_id, isActive: true, isDeleted: false },
    select: { id: true },
  });
  if (!team || user.role === "ADMIN") return team;
  return prisma.userTeam.findFirst({ where: { userId: user.id, teamId }, select: { userId: true } });
}

export async function GET(request: Request, { params }: { params: Promise<{ teamId: string }> }) {
  const current = await currentAccessUser();
  if (!current) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  const { teamId } = await params;
  if (!await teamInHotel(teamId, current)) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  await prisma.teamChatRead.upsert({
    where: { userId_teamId: { userId: current.id, teamId } },
    create: { userId: current.id, teamId, lastReadAt: new Date() },
    update: { lastReadAt: new Date() },
  });
  const before = new URL(request.url).searchParams.get("before");
  return NextResponse.json(await readChannelMessages({ hotelTenantId: current.hotel_tenant_id, teamId }, before));
}

export async function POST(request: Request, { params }: { params: Promise<{ teamId: string }> }) {
  const current = await currentAccessUser();
  if (!current) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  const { teamId } = await params;
  if (!await teamInHotel(teamId, current)) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  const result = await createChannelMessage({
    hotelTenantId: current.hotel_tenant_id,
    senderId: current.id,
    teamId,
    form: await request.formData(),
  });
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ message: result.message }, { status: result.status });
}
