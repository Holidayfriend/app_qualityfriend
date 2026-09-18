import { housekeepingAccess } from "../../../../../lib/housekeeping/access";
import { runHousekeepingAiAllocation } from "../../../../../lib/housekeeping/ai-allocate";
import { getSessionUserId } from "../../../../../lib/auth/session";
import { prisma } from "../../../../../lib/prisma";

async function actor() {
  const id = await getSessionUserId();
  if (!id) return null;
  const user = await prisma.user.findFirst({
    where: { id, isActive: true, isDeleted: false },
    select: { id: true, hotelTenantId: true, role: true, hotelTenant: { select: { timeZone: true } } },
  });
  return user && (await housekeepingAccess({ id: user.id, hotel_tenant_id: user.hotelTenantId, role: user.role })).admin ? user : null;
}

export async function POST() {
  const user = await actor();
  if (!user) return Response.json({ error: "FORBIDDEN" }, { status: 403 });
  try {
    const result = await runHousekeepingAiAllocation(prisma, user.hotelTenantId, user.hotelTenant.timeZone?.trim() || "UTC");
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "ALLOCATION_FAILED";
    return Response.json({ error: message }, { status: 500 });
  }
}
