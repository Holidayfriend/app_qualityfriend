import { notesViewer } from "../../../../lib/notes/access";
import { pickLocalized } from "../../../../lib/recruiting/job-fields";
import { supportedLocales } from "../../../../lib/i18n/dictionaries";
import { prisma } from "../../../../lib/prisma";

export async function GET(request: Request) {
  const actor = await notesViewer();
  if (!actor) return Response.json({ error: "FORBIDDEN" }, { status: 403 });
  const locale = new URL(request.url).searchParams.get("locale") ?? "";
  const lang = supportedLocales.includes(locale as (typeof supportedLocales)[number]) ? locale : "en";
  const rows = await prisma.department.findMany({
    where: { hotelTenantId: actor.hotel_tenant_id, isDeleted: false, isActive: true },
    orderBy: { nameEn: "asc" },
    select: { id: true, nameEn: true, nameDe: true, nameIt: true },
  });
  return Response.json({
    departments: rows.map((row) => ({
      id: row.id,
      name: pickLocalized(row.nameEn, row.nameDe, row.nameIt, lang),
    })),
  }, { headers: { "Cache-Control": "no-store" } });
}
