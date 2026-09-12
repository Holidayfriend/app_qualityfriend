import "server-only";
import { getSessionUserId } from "../auth/session";
import { accessibleModules } from "../auth/module-access";
import { prisma } from "../prisma";

export async function competitorActor() {
  const id = await getSessionUserId();
  if (!id) return Response.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  const user = await prisma.user.findFirst({
    where: { id, isActive: true, isDeleted: false, hotelTenant: { isActive: true } },
    select: { id: true, hotelTenantId: true, role: true, hotelTenant: { select: { tripadvisorId: true, subscriptionStatus: true } } },
  });
  if (!user) return Response.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  const actor = { id: user.id, hotel_tenant_id: user.hotelTenantId, role: user.role };
  if (!["ACTIVE", "COMPED"].includes(user.hotelTenant.subscriptionStatus) || !(await accessibleModules(actor)).includes("competitors")) {
    return Response.json({ error: "FORBIDDEN" }, { status: 403 });
  }
  return { ...actor, locationKey: user.hotelTenant.tripadvisorId?.trim() || null };
}
