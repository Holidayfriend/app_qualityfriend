import { prisma } from "../../../lib/prisma";
import { getSessionUserId } from "../../../lib/auth/session";
import { accessibleModules } from "../../../lib/auth/module-access";
import { hasTrustedOrigin } from "../../../lib/security/request-origin";
import { ensureManualNotifications } from "../../../lib/manuals/service";

async function context() {
  const id = await getSessionUserId();
  if (!id) return null;
  const user = await prisma.user.findFirst({ where: { id, isActive: true, isDeleted: false, hotelTenant: { isActive: true, subscriptionStatus: { in: ["ACTIVE", "COMPED"] } } }, select: { id: true, hotelTenantId: true, role: true, departmentId: true } });
  if (!user) return null;
  await ensureManualNotifications({ id: user.id, hotelTenantId: user.hotelTenantId, departmentId: user.departmentId }).catch((error) => console.error("manual notification backfill failed", error));
  const modules = await accessibleModules({ id: user.id, hotel_tenant_id: user.hotelTenantId, role: user.role });
  const fullAccess = user.role === "ADMIN" ? modules : (await prisma.roleModulePermission.findMany({ where: {
    hotelTenantId: user.hotelTenantId, role: user.role, canView: true, scope: "ALL",
  }, select: { moduleKey: true } })).map(item => item.moduleKey);
  return { user, where: { hotelTenantId: user.hotelTenantId, recipientId: user.id, OR: [
    { moduleKey: { in: ["notes", "manuals"] } },
    { AND: [
      { moduleKey: { in: modules } },
      { OR: [{ requiredScope: "OWN" as const }, { requiredScope: "ALL" as const, moduleKey: { in: fullAccess } }] },
    ] },
  ] } };
}

export async function GET(request: Request) {
  const current = await context();
  if (!current) return Response.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  const params = new URL(request.url).searchParams;
  const language = params.get("locale");
  const locale = language === "de" || language === "it" ? language : "en";
  const pageSize = params.get("limit") === "5" ? 5 : 20;
  const requestedPage = Number(params.get("page") ?? "1");
  if (!Number.isSafeInteger(requestedPage) || requestedPage < 1) {
    return Response.json({ error: "INVALID_PAGE" }, { status: 400 });
  }
  const [totalCount, unreadCount] = await Promise.all([
    prisma.notification.count({ where: current.where }),
    prisma.notification.count({ where: { ...current.where, readAt: null } }),
  ]);
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const page = Math.min(requestedPage, totalPages);
  const items = await prisma.notification.findMany({ where: current.where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: pageSize, skip: (page - 1) * pageSize });
  return Response.json({ unreadCount, totalCount, totalPages, page, pageSize, notifications: items.map(item => ({ id: item.id, icon: item.icon, destination: item.destination,
    title: locale === "de" ? item.titleDe : locale === "it" ? item.titleIt : item.titleEn,
    detail: locale === "de" ? item.bodyDe : locale === "it" ? item.bodyIt : item.bodyEn,
    read: item.readAt !== null, createdAt: item.createdAt })) }, { headers: { "Cache-Control": "no-store" } });
}

export async function PATCH(request: Request) {
  if (!hasTrustedOrigin(request)) return Response.json({ error: "FORBIDDEN_ORIGIN" }, { status: 403 });
  const current = await context();
  if (!current) return Response.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  const body = await request.json().catch(() => null);
  if (typeof body?.id !== "string" || !/^[0-9a-f-]{36}$/i.test(body.id)) return Response.json({ error: "INVALID_ID" }, { status: 400 });
  const found = await prisma.notification.findFirst({ where: { ...current.where, id: body.id }, select: { id: true } });
  if (!found) return Response.json({ error: "NOT_FOUND" }, { status: 404 });
  await prisma.notification.updateMany({ where: { ...current.where, id: body.id, readAt: null }, data: { readAt: new Date() } });
  return Response.json({ success: true });
}
