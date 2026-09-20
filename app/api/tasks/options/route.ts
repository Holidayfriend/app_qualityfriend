import { tasksViewer } from "../../../../lib/tasks/access";
import { pickLocalized } from "../../../../lib/recruiting/job-fields";
import { supportedLocales } from "../../../../lib/i18n/dictionaries";
import { prisma } from "../../../../lib/prisma";

export async function GET(request: Request) {
  const user = await tasksViewer();
  if (!user) return Response.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  const locale = new URL(request.url).searchParams.get("locale") ?? "";
  const lang = supportedLocales.includes(locale as (typeof supportedLocales)[number]) ? locale : "en";
  const [departments, users] = await Promise.all([
    prisma.department.findMany({
      where: { hotelTenantId: user.hotel_tenant_id, isDeleted: false, isActive: true },
      orderBy: { nameEn: "asc" },
      select: { id: true, nameEn: true, nameDe: true, nameIt: true },
    }),
    prisma.user.findMany({
      where: { hotelTenantId: user.hotel_tenant_id, isDeleted: false, isActive: true },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
      select: { id: true, firstName: true, lastName: true },
    }),
  ]);
  return Response.json({
    departments: departments.map((row) => ({ id: row.id, name: pickLocalized(row.nameEn, row.nameDe, row.nameIt, lang) })),
    users: users.map((row) => ({ id: row.id, name: `${row.firstName} ${row.lastName}`.trim() })),
  }, { headers: { "Cache-Control": "no-store" } });
}
