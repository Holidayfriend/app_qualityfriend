import { handoversViewer } from "../../../../lib/handovers/access";
import { pickLocalized } from "../../../../lib/recruiting/job-fields";
import { supportedLocales } from "../../../../lib/i18n/dictionaries";
import { prisma } from "../../../../lib/prisma";

export async function GET(request: Request) {
  const user = await handoversViewer();
  if (!user) return Response.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  const locale = new URL(request.url).searchParams.get("locale") ?? "";
  const lang = supportedLocales.includes(locale as (typeof supportedLocales)[number]) ? locale : "en";
  const departments = await prisma.department.findMany({
    where: { hotelTenantId: user.hotel_tenant_id, isDeleted: false, isActive: true },
    orderBy: { nameEn: "asc" },
    select: { id: true, nameEn: true, nameDe: true, nameIt: true },
  });
  return Response.json({
    departments: departments.map((row) => ({ id: row.id, name: pickLocalized(row.nameEn, row.nameDe, row.nameIt, lang) })),
  }, { headers: { "Cache-Control": "no-store" } });
}
