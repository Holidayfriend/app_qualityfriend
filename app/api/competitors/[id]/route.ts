import { NextResponse } from "next/server";
import { accessibleModules } from "../../../../lib/auth/module-access";
import { getSessionUserId } from "../../../../lib/auth/session";
import { prisma } from "../../../../lib/prisma";
import { hasTrustedOrigin } from "../../../../lib/security/request-origin";

async function actor() {
  const id = await getSessionUserId();
  if (!id) return null;
  const user = await prisma.user.findFirst({
    where: { id, isActive: true, isDeleted: false, hotelTenant: { isActive: true, subscriptionStatus: { in: ["ACTIVE", "COMPED"] } } },
    select: { id: true, hotelTenantId: true, role: true },
  });
  if (!user) return null;
  const modules = await accessibleModules({ id: user.id, hotel_tenant_id: user.hotelTenantId, role: user.role });
  if (!modules.includes("competitors")) return null;
  return user;
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function optionalNumber(value: unknown) {
  if (value === "" || value === null || value === undefined) return null;
  const parsed = typeof value === "number" ? value : Number(String(value).trim().replace(",", "."));
  if (!Number.isFinite(parsed) || parsed < 0) return undefined;
  return parsed;
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!hasTrustedOrigin(request)) return NextResponse.json({ error: "FORBIDDEN_ORIGIN" }, { status: 403 });
  const current = await actor();
  if (!current) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  const { id } = await context.params;
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const name = text(body?.name);
  const url = text(body?.url);
  const adr = optionalNumber(body?.adr);
  const distanceKm = optionalNumber(body?.distanceKm);
  if (!name || adr === undefined || distanceKm === undefined) return NextResponse.json({ error: "INVALID_FIELDS" }, { status: 400 });

  const existing = await prisma.competitor.findFirst({
    where: { id, hotelTenantId: current.hotelTenantId },
    select: { name: true, rawPayload: true },
  });
  if (!existing) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  const raw = existing.rawPayload && typeof existing.rawPayload === "object" && !Array.isArray(existing.rawPayload) ? existing.rawPayload : {};
  const storedName = existing.name.startsWith("[OWN HOTEL] ") ? `[OWN HOTEL] ${name}` : name;
  await prisma.competitor.update({
    where: { id },
    data: {
      name: storedName,
      url: url || null,
      adr,
      rawPayload: { ...raw, distKm: distanceKm },
    },
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!hasTrustedOrigin(request)) return NextResponse.json({ error: "FORBIDDEN_ORIGIN" }, { status: 403 });
  const current = await actor();
  if (!current) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  const { id } = await context.params;
  const existing = await prisma.competitor.findFirst({ where: { id, hotelTenantId: current.hotelTenantId }, select: { id: true } });
  if (!existing) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  await prisma.competitor.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
