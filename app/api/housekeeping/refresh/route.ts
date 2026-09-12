import { getSessionUserId } from "../../../../lib/auth/session";
import { accessibleModules } from "../../../../lib/auth/module-access";
import { prisma } from "../../../../lib/prisma";
import { checkAsaFile } from "../../../../lib/housekeeping/asa-file";

export const runtime = "nodejs";

// Preflight only: no XML parsing, database writes, or queue dispatch.
export async function POST() {
  const json = (body: object, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
  try {
    const id = await getSessionUserId();
    if (!id) return json({ error: "UNAUTHENTICATED" }, 401);
    const user = await prisma.user.findFirst({
      where: { id, isActive: true, isDeleted: false, hotelTenant: { isActive: true } },
      select: { id: true, hotelTenantId: true, role: true, hotelTenant: { select: { asaXmlName: true, subscriptionStatus: true } } },
    });
    if (!user) return json({ error: "UNAUTHENTICATED" }, 401);
    const actor = { id: user.id, hotel_tenant_id: user.hotelTenantId, role: user.role };
    if (!["ACTIVE", "COMPED"].includes(user.hotelTenant.subscriptionStatus) || !(await accessibleModules(actor)).includes("housekeeping")) return json({ error: "FORBIDDEN" }, 403);
    const result = await checkAsaFile(user.hotelTenant.asaXmlName);
    if (result !== "READY") return json({ error: result }, result === "ASA_XML_NOT_FOUND" ? 404 : 400);
    return json({ status: "ready", dispatched: false });
  } catch {
    return json({ error: "REFRESH_CHECK_FAILED" }, 500);
  }
}
