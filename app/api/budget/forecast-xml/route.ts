import { accessibleModules } from "../../../../lib/auth/module-access";
import { getSessionUserId } from "../../../../lib/auth/session";
import { checkAsaFile } from "../../../../lib/housekeeping/asa-file";
import { dispatchForecastImport } from "../../../../lib/forecast/dispatch";
import { prisma } from "../../../../lib/prisma";
import { hasTrustedOrigin } from "../../../../lib/security/request-origin";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const json = (body: object, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
  try {
    if (!hasTrustedOrigin(request)) return json({ error: "FORBIDDEN_ORIGIN" }, 403);
    const id = await getSessionUserId();
    if (!id) return json({ error: "UNAUTHENTICATED" }, 401);
    const user = await prisma.user.findFirst({
      where: { id, isActive: true, isDeleted: false, hotelTenant: { isActive: true } },
      select: { id: true, hotelTenantId: true, role: true, hotelTenant: { select: { forecastXmlName: true, subscriptionStatus: true } } },
    });
    if (!user) return json({ error: "UNAUTHENTICATED" }, 401);
    const modules = await accessibleModules({ id: user.id, hotel_tenant_id: user.hotelTenantId, role: user.role });
    if (!["ACTIVE", "COMPED"].includes(user.hotelTenant.subscriptionStatus) || !modules.includes("budget")) return json({ error: "FORBIDDEN" }, 403);
    const result = await checkAsaFile(user.hotelTenant.forecastXmlName);
    if (result !== "READY") return json({ error: result }, result === "ASA_XML_NOT_FOUND" ? 404 : 400);
    const jobId = await dispatchForecastImport(user.hotelTenantId, user.hotelTenant.forecastXmlName!.trim(), user.id);
    if (!jobId) return json({ error: "REFRESH_ALREADY_PENDING" }, 409);
    return json({ status: "queued", dispatched: true, jobId }, 202);
  } catch {
    return json({ error: "REFRESH_CHECK_FAILED" }, 500);
  }
}
