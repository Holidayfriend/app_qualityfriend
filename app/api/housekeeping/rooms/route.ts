import { accessibleModules } from "../../../../lib/auth/module-access";
import { getSessionUserId } from "../../../../lib/auth/session";
import { prisma } from "../../../../lib/prisma";

type Locale = "en" | "de" | "it";
function locale(value: string | null): Locale { return value === "de" || value === "it" ? value : "en"; }
function translatedName(item: { nameEn: string | null; nameDe: string | null; nameIt: string | null }, activeLocale: Locale) {
  return activeLocale === "de" ? item.nameDe || item.nameEn : activeLocale === "it" ? item.nameIt || item.nameEn : item.nameEn;
}

export async function GET(request: Request) {
  const id = await getSessionUserId();
  if (!id) return Response.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  const user = await prisma.user.findFirst({ where: { id, isActive: true, isDeleted: false }, select: { id: true, hotelTenantId: true, role: true } });
  if (!user) return Response.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  if (!(await accessibleModules({ id: user.id, hotel_tenant_id: user.hotelTenantId, role: user.role })).includes("housekeeping")) return Response.json({ error: "FORBIDDEN" }, { status: 403 });

  const activeLocale = locale(new URL(request.url).searchParams.get("locale"));
  const rooms = await prisma.room.findMany({
    where: { hotelTenantId: user.hotelTenantId, isActive: true, archivedAt: null },
    orderBy: { number: "asc" },
    select: {
      id: true,
      number: true,
      nameEn: true,
      nameDe: true,
      nameIt: true,
      category: { select: { nameEn: true, nameDe: true, nameIt: true } },
      floor: { select: { code: true, nameEn: true, nameDe: true, nameIt: true } },
    },
  });

  return Response.json({
    rooms: rooms.map((room) => ({
      id: room.id,
      number: room.number,
      name: translatedName(room, activeLocale),
      category: room.category ? translatedName(room.category, activeLocale) : null,
      floor: room.floor ? translatedName(room.floor, activeLocale) || room.floor.code : null,
    })),
  }, { headers: { "Cache-Control": "no-store" } });
}
