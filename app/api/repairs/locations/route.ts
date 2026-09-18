import { currentAccessUser, accessibleModules } from "../../../../lib/auth/module-access";
import { prisma } from "../../../../lib/prisma";

export async function GET() {
  const user = await currentAccessUser();
  if (!user) return Response.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  if (user.role !== "ADMIN" && !(await accessibleModules(user)).includes("repairs")) {
    return Response.json({ error: "FORBIDDEN" }, { status: 403 });
  }
  const rooms = await prisma.room.findMany({
    where: { hotelTenantId: user.hotel_tenant_id, isActive: true, archivedAt: null },
    orderBy: { number: "asc" },
    select: { id: true, number: true },
  });
  return Response.json({ rooms }, { headers: { "Cache-Control": "no-store" } });
}
