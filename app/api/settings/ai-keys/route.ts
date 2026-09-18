import { NextResponse } from "next/server";
import { currentAccessUser } from "../../../../lib/auth/module-access";
import { prisma } from "../../../../lib/prisma";
import { isAiProviderId } from "../../../../lib/ai/providers";
import { listHotelAiProviders, saveHotelAiProvider } from "../../../../lib/ai/complete";
import { recordAuditLog } from "../../../../lib/audit/audit-service";

async function sessionUser() {
  return currentAccessUser();
}

function canManageAi(role: string) {
  return role === "ADMIN" || role === "MANAGEMENT";
}

export async function GET() {
  const user = await sessionUser();
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  return NextResponse.json(
    { ...(await listHotelAiProviders(prisma, user.hotel_tenant_id)), canEdit: canManageAi(user.role) },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function PUT(request: Request) {
  const user = await sessionUser();
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  if (!canManageAi(user.role)) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const body = await request.json().catch(() => null) as { provider?: unknown; model?: unknown; apiKey?: unknown; clearKey?: unknown; activeProvider?: unknown } | null;
  if (!isAiProviderId(body?.provider)) return NextResponse.json({ error: "INVALID_PROVIDER" }, { status: 400 });
  const activeProvider = isAiProviderId(body?.activeProvider) ? body.activeProvider : undefined;
  const result = await saveHotelAiProvider(prisma, user.hotel_tenant_id, {
    provider: body.provider,
    model: typeof body?.model === "string" ? body.model : undefined,
    apiKey: typeof body?.apiKey === "string" ? body.apiKey : undefined,
    clearKey: body?.clearKey === true,
    activeProvider,
  });
  await recordAuditLog(prisma, {
    hotelTenantId: user.hotel_tenant_id,
    actorId: user.id,
    action: "UPDATE",
    entityType: "HOTEL",
    entityId: user.hotel_tenant_id,
    changes: { field: "aiProvider", provider: body.provider, model: typeof body?.model === "string" ? body.model : null, keyChanged: Boolean(typeof body?.apiKey === "string" && body.apiKey.trim()) || body?.clearKey === true },
  });
  return NextResponse.json({ ...result, canEdit: true });
}
