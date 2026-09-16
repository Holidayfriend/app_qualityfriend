import { housekeepingAccess } from "../../../../lib/housekeeping/access";
import { getSessionUserId } from "../../../../lib/auth/session";
import { prisma } from "../../../../lib/prisma";

export async function GET() {
  const id = await getSessionUserId();
  if (!id) return Response.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const user = await prisma.user.findFirst({
    where: { id, isActive: true, isDeleted: false },
    select: { id: true, hotelTenantId: true, role: true },
  });
  if (!user) return Response.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const actor = { id: user.id, hotel_tenant_id: user.hotelTenantId, role: user.role };
  if (!(await housekeepingAccess(actor)).admin) {
    return Response.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const floors = await prisma.floor.findMany({
    where: { hotelTenantId: user.hotelTenantId, isActive: true, archivedAt: null },
    orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
    select: {
      id: true,
      code: true,
      _count: { select: { roomRecords: { where: { isActive: true, archivedAt: null } } } },
    },
  });

  return Response.json({ floors: floors.map(floor => ({ id: floor.id, code: floor.code, roomCount: floor._count.roomRecords })) }, { headers: { "Cache-Control": "no-store" } });
}
