import { accessibleModules } from "../../../../lib/auth/module-access";
import { getSessionUserId } from "../../../../lib/auth/session";
import { prisma } from "../../../../lib/prisma";

const nameFields = { en: "nameEn", de: "nameDe", it: "nameIt" } as const;
type Locale = keyof typeof nameFields;

export async function GET(request: Request) {
  const id = await getSessionUserId();
  if (!id) return Response.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const user = await prisma.user.findFirst({
    where: { id, isActive: true, isDeleted: false },
    select: { id: true, hotelTenantId: true, role: true },
  });
  if (!user) return Response.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const actor = { id: user.id, hotel_tenant_id: user.hotelTenantId, role: user.role };
  if (!(await accessibleModules(actor)).includes("housekeeping")) {
    return Response.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const requestedLocale = new URL(request.url).searchParams.get("locale");
  const locale: Locale = requestedLocale === "de" || requestedLocale === "it" ? requestedLocale : "en";
  const nameField = nameFields[locale];
  const categories = await prisma.roomCategory.findMany({
    where: { hotelTenantId: user.hotelTenantId, isActive: true, archivedAt: null },
    orderBy: { nameEn: "asc" },
    select: { id: true, nameEn: true, nameDe: true, nameIt: true, expressMinutes: true, normalMinutes: true, departureMinutes: true, finalMinutes: true },
  });

  return Response.json({
    categories: categories.map((category) => ({
      id: category.id,
      name: category[nameField] || category.nameEn,
      express: category.expressMinutes,
      normal: category.normalMinutes,
      departure: category.departureMinutes,
      final: category.finalMinutes,
    })),
  }, { headers: { "Cache-Control": "no-store" } });
}
