import { accessibleModules } from "../../../../lib/auth/module-access";
import { getSessionUserId } from "../../../../lib/auth/session";
import { listHotelBudget } from "../../../../lib/budget/summaries";
import { prisma } from "../../../../lib/prisma";

export const runtime = "nodejs";

export async function GET() {
  const json = (body: object, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
  const id = await getSessionUserId();
  if (!id) return json({ error: "UNAUTHENTICATED" }, 401);
  const user = await prisma.user.findFirst({
    where: { id, isActive: true, isDeleted: false, hotelTenant: { isActive: true, subscriptionStatus: { in: ["ACTIVE", "COMPED"] } } },
    select: { id: true, hotelTenantId: true, role: true },
  });
  if (!user) return json({ error: "UNAUTHENTICATED" }, 401);
  const modules = await accessibleModules({ id: user.id, hotel_tenant_id: user.hotelTenantId, role: user.role });
  if (!modules.includes("budget")) return json({ error: "FORBIDDEN" }, 403);
  return json(await listHotelBudget(prisma, user.hotelTenantId));
}
