import { scheduleViewer } from "../../../../lib/schedule/access";
import { pickLocalized } from "../../../../lib/recruiting/job-fields";
import { supportedLocales } from "../../../../lib/i18n/dictionaries";
import { prisma } from "../../../../lib/prisma";

export async function GET(request: Request) {
  const actor = await scheduleViewer();
  if (!actor) return Response.json({ error: "FORBIDDEN" }, { status: 403 });
  const locale = new URL(request.url).searchParams.get("locale") ?? "";
  const lang = supportedLocales.includes(locale as (typeof supportedLocales)[number]) ? locale : "en";

  const [departments, users] = await Promise.all([
    prisma.department.findMany({
      where: { hotelTenantId: actor.hotel_tenant_id, isDeleted: false, isActive: true },
      orderBy: { nameEn: "asc" },
      select: { id: true, nameEn: true, nameDe: true, nameIt: true },
    }),
    prisma.user.findMany({
      where: { hotelTenantId: actor.hotel_tenant_id, isDeleted: false, isActive: true },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      select: {
        id: true,
        firstName: true,
        lastName: true,
        departmentId: true,
        department: { select: { nameEn: true, nameDe: true, nameIt: true, isDeleted: true } },
      },
    }),
  ]);

  return Response.json({
    currentUserId: actor.id,
    departments: departments.map((row) => ({
      id: row.id,
      name: pickLocalized(row.nameEn, row.nameDe, row.nameIt, lang),
    })),
    employees: users.map((row) => ({
      id: row.id,
      name: `${row.firstName} ${row.lastName}`.trim(),
      departmentId: row.department && !row.department.isDeleted ? row.departmentId : null,
      departmentName: row.department && !row.department.isDeleted
        ? pickLocalized(row.department.nameEn, row.department.nameDe, row.department.nameIt, lang)
        : "",
    })),
  }, { headers: { "Cache-Control": "no-store" } });
}
