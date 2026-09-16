import { notesActor } from "../../../../lib/notes/access";
import { prisma } from "../../../../lib/prisma";

export async function GET() {
  const actor = await notesActor();
  if (!actor) return Response.json({ error: "FORBIDDEN" }, { status: 403 });
  const rows = await prisma.user.findMany({
    where: { hotelTenantId: actor.hotel_tenant_id, isDeleted: false, isActive: true },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    select: { id: true, firstName: true, lastName: true },
  });
  return Response.json({
    users: rows.map((row) => ({
      id: row.id,
      name: `${row.firstName} ${row.lastName}`.trim(),
    })),
  }, { headers: { "Cache-Control": "no-store" } });
}
