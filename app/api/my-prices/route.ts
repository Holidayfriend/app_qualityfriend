import { accessibleModules } from "../../../lib/auth/module-access";
import { getSessionUserId } from "../../../lib/auth/session";
import { hotelLocalDate } from "../../../lib/housekeeping/daily-plan";
import { prisma } from "../../../lib/prisma";
import { importOwnRates, RATE_PLAN, RatesFileError } from "../../../lib/revenue/own-rates";
import { hasTrustedOrigin } from "../../../lib/security/request-origin";

export const runtime = "nodejs";

const json = (body: object, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

async function actor() {
  const id = await getSessionUserId();
  if (!id) return { error: "UNAUTHENTICATED" as const };
  const user = await prisma.user.findFirst({
    where: { id, isActive: true, isDeleted: false, hotelTenant: { isActive: true, subscriptionStatus: { in: ["ACTIVE", "COMPED"] } } },
    select: { id: true, hotelTenantId: true, role: true, hotelTenant: { select: { timeZone: true } } },
  });
  if (!user) return { error: "UNAUTHENTICATED" as const };
  const modules = await accessibleModules({ id: user.id, hotel_tenant_id: user.hotelTenantId, role: user.role });
  if (!modules.includes("revenue")) return { error: "FORBIDDEN" as const };
  return user;
}

function failure(error: "UNAUTHENTICATED" | "FORBIDDEN") {
  return json({ error }, error === "FORBIDDEN" ? 403 : 401);
}

function amount(value: unknown) {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function GET() {
  try {
    const current = await actor();
    if ("error" in current) return failure(current.error);

    const start = hotelLocalDate(current.hotelTenant.timeZone?.trim() || "Europe/Rome");
    const rows = await prisma.ownRoomRate.findMany({
      where: { hotelTenantId: current.hotelTenantId, rateDate: { gte: new Date(`${start}T00:00:00Z`) } },
      orderBy: [{ rateDate: "asc" }, { category: { nameEn: "asc" } }],
      select: {
        rateDate: true,
        ratePlan: true,
        pricePerPerson1: true,
        pricePerPerson2: true,
        roomPrice2Adults: true,
        fetchedAt: true,
        category: { select: { id: true, nameEn: true } },
      },
    });
    const last = rows.reduce<Date | null>((latest, row) => (!latest || row.fetchedAt > latest ? row.fetchedAt : latest), null);
    return json({
      plan: RATE_PLAN,
      lastImportedAt: last?.toISOString() ?? null,
      rows: rows.map((row) => ({
        date: row.rateDate.toISOString().slice(0, 10),
        categoryId: row.category.id,
        category: row.category.nameEn,
        ratePlan: row.ratePlan,
        pricePerPerson1: amount(row.pricePerPerson1),
        pricePerPerson2: amount(row.pricePerPerson2),
        roomPrice2Adults: amount(row.roomPrice2Adults),
      })),
    });
  } catch {
    return json({ error: "LOAD_FAILED" }, 500);
  }
}

export async function POST(request: Request) {
  try {
    if (!hasTrustedOrigin(request)) return json({ error: "FORBIDDEN_ORIGIN" }, 403);
    const current = await actor();
    if ("error" in current) return failure(current.error);

    const result = await importOwnRates(prisma, current.hotelTenantId);
    return json(result);
  } catch (error) {
    console.error("my-prices import failed", error);
    if (error instanceof RatesFileError) {
      const status = error.code === "RATES_FILE_NOT_FOUND" ? 404 : error.code === "RATES_FILE_INVALID" ? 422 : 502;
      return json({ error: error.code, detail: error.detail }, status);
    }
    const message = error instanceof Error ? error.message : "";
    return json({ error: "IMPORT_FAILED", detail: message }, 500);
  }
}
