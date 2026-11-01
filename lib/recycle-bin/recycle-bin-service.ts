import "server-only";
import { NextResponse } from "next/server";
import { getSessionUserId } from "../auth/session";
import { recordAuditLog } from "../audit/audit-service";
import { createSyncedMcpDepartment, updateMcpDepartment } from "../mcp/client";
import { getMcpDepartmentContext } from "../mcp/department-sync";
import { createRemoteUser, getMcpUserContext } from "../mcp/user-sync";
import { dispatchManualIndex } from "../manuals/dispatch";
import { ensureManualDeletedColumn } from "../manuals/ensure-deleted";
import { prisma } from "../prisma";

export type RecyclableType = "department" | "team" | "user" | "manual";
async function actor() { const id = await getSessionUserId(); if (!id) return null; return prisma.user.findFirst({ where: { id, isActive: true, isDeleted: false }, select: { id: true, hotelTenantId: true } }); }
function item(type: RecyclableType, row: { id: string; deletedAt: Date | null; nameEn: string; nameDe: string; nameIt: string }) { return { id: row.id, type, names: { en: row.nameEn, de: row.nameDe, it: row.nameIt }, deletedAt: row.deletedAt }; }

export async function listDeletedItems() {
  const current = await actor(); if (!current) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  await ensureManualDeletedColumn();
  const [departments, teams, users, manuals] = await Promise.all([
    prisma.department.findMany({ where: { hotelTenantId: current.hotelTenantId, isDeleted: true }, select: { id: true, nameEn: true, nameDe: true, nameIt: true, deletedAt: true } }),
    prisma.team.findMany({ where: { hotelTenantId: current.hotelTenantId, isDeleted: true }, select: { id: true, nameEn: true, nameDe: true, nameIt: true, deletedAt: true } }),
    prisma.user.findMany({ where: { hotelTenantId: current.hotelTenantId, isDeleted: true }, select: { id: true, firstName: true, lastName: true, deletedAt: true } }),
    prisma.manualDocument.findMany({ where: { hotelTenantId: current.hotelTenantId, isDeleted: true }, select: { id: true, title: true, deletedAt: true } }),
  ]);
  const all = [
    ...departments.map((row) => item("department", row)),
    ...teams.map((row) => item("team", row)),
    ...users.map((row) => { const name = `${row.firstName} ${row.lastName}`; return item("user", { ...row, nameEn: name, nameDe: name, nameIt: name }); }),
    ...manuals.map((row) => item("manual", { id: row.id, deletedAt: row.deletedAt, nameEn: row.title, nameDe: row.title, nameIt: row.title })),
  ];
  return NextResponse.json(all.sort((a, b) => (b.deletedAt?.getTime() ?? 0) - (a.deletedAt?.getTime() ?? 0)));
}

export async function restoreDeletedItem(type: RecyclableType, id: string) {
  const current = await actor(); if (!current) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  if (type === "manual") await ensureManualDeletedColumn();
  try {
    const mcp = type === "department" ? await getMcpDepartmentContext(current.hotelTenantId) : null;
    const userMcp = type === "user" ? await getMcpUserContext(current.hotelTenantId) : null;
    const restored = await prisma.$transaction(async (tx) => {
      let names: { en: string; de: string; it: string } | null = null;
      if (type === "department") {
        const row = await tx.department.findFirst({ where: { id, hotelTenantId: current.hotelTenantId, isDeleted: true } });
        if (row) {
          names = { en: row.nameEn, de: row.nameDe, it: row.nameIt };
          let mcpDepartmentId = row.mcpDepartmentId;
          if (mcp) { if (mcpDepartmentId) await updateMcpDepartment(mcp.token, mcpDepartmentId, mcp.hotelId, row.nameEn, true); else mcpDepartmentId = await createSyncedMcpDepartment(mcp.token, mcp.hotelId, row.nameEn); }
          await tx.department.update({ where: { id }, data: { isDeleted: false, isActive: true, deletedAt: null, updatedById: current.id, mcpDepartmentId } });
        }
      } else if (type === "team") {
        const row = await tx.team.findFirst({ where: { id, hotelTenantId: current.hotelTenantId, isDeleted: true } });
        if (row) { names = { en: row.nameEn, de: row.nameDe, it: row.nameIt }; await tx.team.update({ where: { id }, data: { isDeleted: false, isActive: true, deletedAt: null, updatedById: current.id } }); }
      } else if (type === "user") {
        const row = await tx.user.findFirst({ where: { id, hotelTenantId: current.hotelTenantId, isDeleted: true } });
        if (row) { const name = `${row.firstName} ${row.lastName}`; names = { en: name, de: name, it: name }; let remote: { id: string; password: string } | null = null; if (userMcp) remote = await createRemoteUser(userMcp, { id: row.id, email: row.email, role: row.role, isActive: true, departmentId: row.departmentId }); await tx.user.update({ where: { id }, data: { isDeleted: false, isActive: true, deletedAt: null, mcpUserId: remote?.id ?? row.mcpUserId, mcpUserPassword: remote?.password ?? row.mcpUserPassword } }); }
      } else {
        const row = await tx.manualDocument.findFirst({ where: { id, hotelTenantId: current.hotelTenantId, isDeleted: true } });
        if (row) { names = { en: row.title, de: row.title, it: row.title }; await tx.manualDocument.update({ where: { id }, data: { isDeleted: false, deletedAt: null } }); }
      }
      if (!names) return null;
      await recordAuditLog(tx, { module: "settings", hotelTenantId: current.hotelTenantId, actorId: current.id, action: "RESTORE", entityType: type.toUpperCase(), entityId: id, changes: { after: names } });
      return names;
    }, { timeout: 20_000 });
    if (restored && type === "manual") await dispatchManualIndex(current.hotelTenantId, id).catch((error) => console.error("manual reindex after restore failed", error));
    return restored ? NextResponse.json({ success: true, item: { id, type, names: restored, deletedAt: null } }) : NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  } catch (error) {
    if (type === "team") throw error;
    console.error("MCP restore synchronization failed", error);
    return NextResponse.json({ error: "MCP_SYNC_FAILED", message: error instanceof Error ? error.message : "MCP department synchronization failed." }, { status: 502 });
  }
}
