import { competitorActor } from "../../../lib/competitors/access";
import { prisma } from "../../../lib/prisma";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const actor = await competitorActor();
  if (actor instanceof Response) return actor;
  const params = new URL(request.url).searchParams;
  const page = Number(params.get("page") || "1"), limit = Number(params.get("limit") || "50");
  if (!Number.isSafeInteger(page) || page < 1 || page > 100000 || !Number.isInteger(limit) || limit < 1 || limit > 100) {
    return Response.json({ error: "INVALID_PAGINATION" }, { status: 400 });
  }
  if (!actor.locationKey) return Response.json({ data: [], total: 0, page, limit, locationKey: null });
  const where = { hotelTenantId: actor.hotel_tenant_id, locationKey: actor.locationKey };
  const [total, data] = await prisma.$transaction([
    prisma.competitor.count({ where }),
    prisma.competitor.findMany({ where, orderBy: [{ name: "asc" }, { id: "asc" }], skip: (page - 1) * limit, take: limit }),
  ]);
  return Response.json({ data, total, page, limit, locationKey: actor.locationKey }, { headers: { "Cache-Control": "no-store" } });
}
