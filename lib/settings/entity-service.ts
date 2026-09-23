import "server-only";
import { NextResponse } from "next/server";
import { recordAuditLog } from "../audit/audit-service";
import { getSessionUserId } from "../auth/session";
import { createSyncedMcpDepartment, updateMcpDepartment } from "../mcp/client";
import { getMcpDepartmentContext } from "../mcp/department-sync";
import { prisma } from "../prisma";
import { translateEntityName } from "./translate";

export type EntityType = "department" | "team";
type Row = { id: string; nameEn: string; nameDe: string; nameIt: string; _count?: { members: number } };
async function actor() { const id = await getSessionUserId(); if (!id) return null; return prisma.user.findFirst({ where: { id, isActive: true, isDeleted: false }, select: { id: true, hotelTenantId: true } }); }
function parseName(body: unknown) {
  if (!body || typeof body !== "object") return null;
  const data = body as Record<string, unknown>;
  const locale = data.locale === "de" || data.locale === "it" || data.locale === "en" ? data.locale : "en";
  const name = typeof data.name === "string" ? data.name.trim().slice(0, 180) : "";
  return name ? { name, locale } : null;
}
async function localizedNames(hotelTenantId: string, body: unknown) {
  const input = parseName(body);
  if (!input) return null;
  const pack = await translateEntityName(hotelTenantId, input.locale, input.name);
  return { nameEn: pack.en, nameDe: pack.de, nameIt: pack.it };
}
function output(row: Row) { return { id: row.id, names: { en: row.nameEn, de: row.nameDe, it: row.nameIt }, count: row._count?.members ?? 0 }; }
function conflict(error: unknown) { return Boolean(error && typeof error === "object" && "code" in error && error.code === "P2002"); }
function syncFailure(error: unknown) { console.error("MCP department synchronization failed", error); return NextResponse.json({ error: "MCP_SYNC_FAILED", message: error instanceof Error ? error.message : "MCP department synchronization failed." }, { status: 502 }); }

export async function listEntities(type: EntityType) {
  const current = await actor(); if (!current) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  const rows = type === "department" ? await prisma.department.findMany({ where: { hotelTenantId: current.hotelTenantId, isDeleted: false }, orderBy: { nameEn: "asc" }, select: { id: true, nameEn: true, nameDe: true, nameIt: true, _count: { select: { members: { where: { isActive: true, isDeleted: false } } } } } }) : await prisma.team.findMany({ where: { hotelTenantId: current.hotelTenantId, isDeleted: false }, orderBy: { nameEn: "asc" }, select: { id: true, nameEn: true, nameDe: true, nameIt: true } });
  return NextResponse.json(rows.map(output));
}

export async function createEntity(request: Request, type: EntityType) {
  const current = await actor(); if (!current) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  const values = await localizedNames(current.hotelTenantId, await request.json().catch(() => null)); if (!values) return NextResponse.json({ error: "INVALID_FIELDS" }, { status: 400 });
  try {
    const mcp = type === "department" ? await getMcpDepartmentContext(current.hotelTenantId) : null;
    const entity = await prisma.$transaction(async (tx) => {
      const data = { hotelTenantId: current.hotelTenantId, ...values, createdById: current.id, updatedById: current.id };
      let created: Row;
      if (type === "department") {
        const department = await tx.department.create({ data, select: { id: true, nameEn: true, nameDe: true, nameIt: true } });
        if (mcp) { const mcpDepartmentId = await createSyncedMcpDepartment(mcp.token, mcp.hotelId, values.nameEn); await tx.department.update({ where: { id: department.id }, data: { mcpDepartmentId } }); }
        created = department;
      } else created = await tx.team.create({ data, select: { id: true, nameEn: true, nameDe: true, nameIt: true } });
      await recordAuditLog(tx, { hotelTenantId: current.hotelTenantId, actorId: current.id, action: "CREATE", entityType: type.toUpperCase(), entityId: created.id, changes: { after: output(created).names } });
      return created;
    }, { timeout: 20_000 });
    return NextResponse.json(output(entity), { status: 201 });
  } catch (error) { if (conflict(error)) return NextResponse.json({ error: "NAME_EXISTS" }, { status: 409 }); if (type === "department") return syncFailure(error); throw error; }
}

export async function updateEntity(request: Request, type: EntityType, id: string) {
  const current = await actor(); if (!current) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  const values = await localizedNames(current.hotelTenantId, await request.json().catch(() => null)); if (!values) return NextResponse.json({ error: "INVALID_FIELDS" }, { status: 400 });
  try {
    const mcp = type === "department" ? await getMcpDepartmentContext(current.hotelTenantId) : null;
    const entity = await prisma.$transaction(async (tx) => {
      if (type === "department") {
        const previous = await tx.department.findFirst({ where: { id, hotelTenantId: current.hotelTenantId, isDeleted: false }, select: { id: true, nameEn: true, nameDe: true, nameIt: true, mcpDepartmentId: true } }); if (!previous) return null;
        let mcpDepartmentId = previous.mcpDepartmentId;
        if (mcp) { if (mcpDepartmentId) await updateMcpDepartment(mcp.token, mcpDepartmentId, mcp.hotelId, values.nameEn, true); else mcpDepartmentId = await createSyncedMcpDepartment(mcp.token, mcp.hotelId, values.nameEn); }
        const updated = await tx.department.update({ where: { id }, data: { ...values, updatedById: current.id, mcpDepartmentId }, select: { id: true, nameEn: true, nameDe: true, nameIt: true, _count: { select: { members: { where: { isActive: true, isDeleted: false } } } } } });
        await recordAuditLog(tx, { hotelTenantId: current.hotelTenantId, actorId: current.id, action: "UPDATE", entityType: "DEPARTMENT", entityId: id, changes: { before: output(previous).names, after: output(updated).names } }); return updated;
      }
      const previous = await tx.team.findFirst({ where: { id, hotelTenantId: current.hotelTenantId, isDeleted: false }, select: { id: true, nameEn: true, nameDe: true, nameIt: true } }); if (!previous) return null;
      const updated = await tx.team.update({ where: { id }, data: { ...values, updatedById: current.id }, select: { id: true, nameEn: true, nameDe: true, nameIt: true } });
      await recordAuditLog(tx, { hotelTenantId: current.hotelTenantId, actorId: current.id, action: "UPDATE", entityType: "TEAM", entityId: id, changes: { before: output(previous).names, after: output(updated).names } }); return updated;
    }, { timeout: 20_000 });
    return entity ? NextResponse.json(output(entity)) : NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  } catch (error) { if (conflict(error)) return NextResponse.json({ error: "NAME_EXISTS" }, { status: 409 }); if (type === "department") return syncFailure(error); throw error; }
}

export async function deleteEntity(type: EntityType, id: string) {
  const current = await actor(); if (!current) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  try {
    const mcp = type === "department" ? await getMcpDepartmentContext(current.hotelTenantId) : null;
    const entity = await prisma.$transaction(async (tx) => {
      if (type === "department") {
        const previous = await tx.department.findFirst({ where: { id, hotelTenantId: current.hotelTenantId, isDeleted: false }, select: { id: true, nameEn: true, nameDe: true, nameIt: true, mcpDepartmentId: true } }); if (!previous) return null;
        if (mcp && previous.mcpDepartmentId) await updateMcpDepartment(mcp.token, previous.mcpDepartmentId, mcp.hotelId, previous.nameEn, false);
        await tx.department.update({ where: { id }, data: { isDeleted: true, isActive: false, deletedAt: new Date(), updatedById: current.id } });
        await recordAuditLog(tx, { hotelTenantId: current.hotelTenantId, actorId: current.id, action: "DELETE", entityType: "DEPARTMENT", entityId: id, changes: { before: output(previous).names, after: { isDeleted: true, isActive: false } } }); return previous;
      }
      const previous = await tx.team.findFirst({ where: { id, hotelTenantId: current.hotelTenantId, isDeleted: false }, select: { id: true, nameEn: true, nameDe: true, nameIt: true } }); if (!previous) return null;
      await tx.team.update({ where: { id }, data: { isDeleted: true, isActive: false, deletedAt: new Date(), updatedById: current.id } });
      await recordAuditLog(tx, { hotelTenantId: current.hotelTenantId, actorId: current.id, action: "DELETE", entityType: "TEAM", entityId: id, changes: { before: output(previous).names, after: { isDeleted: true, isActive: false } } }); return previous;
    }, { timeout: 20_000 });
    return entity ? NextResponse.json({ success: true }) : NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  } catch (error) { if (type === "department") return syncFailure(error); throw error; }
}
