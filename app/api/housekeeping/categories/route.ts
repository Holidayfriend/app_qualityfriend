import { accessibleModules } from "../../../../lib/auth/module-access";
import { getSessionUserId } from "../../../../lib/auth/session";
import { prisma } from "../../../../lib/prisma";

type Locale = "en" | "de" | "it";
type Frequency = "DAILY" | "EVERY_SECOND_DAY" | "WEEKLY" | "ON_REQUEST";
const frequencies = new Set<Frequency>(["DAILY", "EVERY_SECOND_DAY", "WEEKLY", "ON_REQUEST"]);

async function actor() {
  const id = await getSessionUserId();
  if (!id) return null;
  const user = await prisma.user.findFirst({ where: { id, isActive: true, isDeleted: false }, select: { id: true, hotelTenantId: true, role: true } });
  if (!user) return null;
  return (await accessibleModules({ id: user.id, hotel_tenant_id: user.hotelTenantId, role: user.role })).includes("housekeeping") ? user : null;
}

function locale(value: unknown): Locale { return value === "de" || value === "it" ? value : "en"; }
function validMinutes(value: unknown) { return value === null || typeof value === "number" && Number.isInteger(value) && value >= 0; }

export async function GET(request: Request) {
  const user = await actor();
  if (!user) return Response.json({ error: "FORBIDDEN" }, { status: 403 });
  const activeLocale = locale(new URL(request.url).searchParams.get("locale"));
  const categories = await prisma.roomCategory.findMany({ where: { hotelTenantId: user.hotelTenantId, isActive: true, archivedAt: null }, orderBy: { nameEn: "asc" }, select: { id: true, nameEn: true, nameDe: true, nameIt: true, expressMinutes: true, normalMinutes: true, departureMinutes: true, finalMinutes: true } });
  const name = (category: typeof categories[number]) => activeLocale === "de" ? category.nameDe || category.nameEn : activeLocale === "it" ? category.nameIt || category.nameEn : category.nameEn;
  return Response.json({ categories: categories.map((category) => ({ id: category.id, name: name(category), express: category.expressMinutes, normal: category.normalMinutes, departure: category.departureMinutes, final: category.finalMinutes })) }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const user = await actor();
  if (!user) return Response.json({ error: "FORBIDDEN" }, { status: 403 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const activeLocale = locale(body?.locale);
  const expressMinutes = body?.expressMinutes, normalMinutes = body?.normalMinutes, departureMinutes = body?.departureMinutes, finalMinutes = body?.finalMinutes;
  const cleaningFrequency = body?.cleaningFrequency, linenFrequency = body?.linenFrequency;
  if (!name || name.length > 180 || ![expressMinutes, normalMinutes, departureMinutes, finalMinutes].every(validMinutes) || !frequencies.has(cleaningFrequency as Frequency) || !frequencies.has(linenFrequency as Frequency)) return Response.json({ error: "INVALID_FIELDS" }, { status: 400 });
  const category = await prisma.roomCategory.create({ data: { hotelTenantId: user.hotelTenantId, nameEn: name, nameDe: activeLocale === "de" ? name : null, nameIt: activeLocale === "it" ? name : null, expressMinutes: expressMinutes as number | null, normalMinutes: normalMinutes as number | null, departureMinutes: departureMinutes as number | null, finalMinutes: finalMinutes as number | null, cleaningFrequency: cleaningFrequency as Frequency, linenFrequency: linenFrequency as Frequency } });
  return Response.json({ id: category.id }, { status: 201 });
}
