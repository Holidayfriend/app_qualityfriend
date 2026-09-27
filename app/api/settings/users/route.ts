import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import type { UserRole } from "../../../../app/generated/prisma/enums";
import { recordAuditLog } from "../../../../lib/audit/audit-service";
import { getSessionUserId } from "../../../../lib/auth/session";
import { getMcpUserContext, createRemoteUser } from "../../../../lib/mcp/user-sync";
import { prisma } from "../../../../lib/prisma";
import { acceptedTeamIds, parseTeamIds, replaceUserTeams } from "../../../../lib/settings/user-teams";
import { dispatchUserWelcomeEmail } from "../../../../lib/users/dispatch-welcome-email";
import { roleLabel } from "../../../../lib/users/welcome-email";
const roles = new Set(["EMPLOYEE", "TEAM_LEAD", "MANAGEMENT", "ADMIN"]);
async function admin() { const id = await getSessionUserId(); if (!id) return null; const user = await prisma.user.findFirst({ where: { id, isActive: true, isDeleted: false }, select: { id: true, hotelTenantId: true, role: true } }); return user?.role === "ADMIN" ? user : null; }
export async function GET() { const current = await admin(); if (!current) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 }); const [users, departments, teams] = await Promise.all([prisma.user.findMany({ where: { hotelTenantId: current.hotelTenantId, isDeleted: false }, orderBy: [{ firstName: "asc" }, { lastName: "asc" }], select: { id: true, firstName: true, lastName: true, email: true, phoneNumber: true, role: true, isActive: true, departmentId: true, department: { select: { nameEn: true, nameDe: true, nameIt: true, isDeleted: true } }, teamMemberships: { where: { team: { isDeleted: false } }, select: { teamId: true, team: { select: { nameEn: true, nameDe: true, nameIt: true } } } } } }), prisma.department.findMany({ where: { hotelTenantId: current.hotelTenantId, isDeleted: false, isActive: true }, orderBy: { nameEn: "asc" }, select: { id: true, nameEn: true, nameDe: true, nameIt: true } }), prisma.team.findMany({ where: { hotelTenantId: current.hotelTenantId, isDeleted: false, isActive: true }, orderBy: { nameEn: "asc" }, select: { id: true, nameEn: true, nameDe: true, nameIt: true } })]); return NextResponse.json({ currentUserId: current.id, users: users.map((u) => ({ id: u.id, first_name: u.firstName, last_name: u.lastName, email: u.email, phone_number: u.phoneNumber, role: u.role, is_active: u.isActive, department_id: u.departmentId, department_en: u.department && !u.department.isDeleted ? u.department.nameEn : null, department_de: u.department && !u.department.isDeleted ? u.department.nameDe : null, department_it: u.department && !u.department.isDeleted ? u.department.nameIt : null, team_ids: u.teamMemberships.map((membership) => membership.teamId), teams: u.teamMemberships.map((membership) => ({ id: membership.teamId, name_en: membership.team.nameEn, name_de: membership.team.nameDe, name_it: membership.team.nameIt })) })), departments: departments.map((d) => ({ id: d.id, name_en: d.nameEn, name_de: d.nameDe, name_it: d.nameIt })), teams: teams.map((d) => ({ id: d.id, name_en: d.nameEn, name_de: d.nameDe, name_it: d.nameIt })) }); }
export async function POST(request: Request) {
  const current = await admin(); if (!current) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null, firstName = typeof body?.firstName === "string" ? body.firstName.trim() : "", lastName = typeof body?.lastName === "string" ? body.lastName.trim() : "", email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "", password = typeof body?.password === "string" ? body.password : "", phone = typeof body?.phone === "string" ? body.phone.trim() || null : null, role = typeof body?.role === "string" ? body.role : "", departmentId = typeof body?.departmentId === "string" && body.departmentId ? body.departmentId : null, isActive = body?.isActive !== false, selectedTeamIds = parseTeamIds(body);
  if (!firstName || !lastName || !/^\S+@\S+\.\S+$/.test(email) || password.length < 8 || !roles.has(role)) return NextResponse.json({ error: "INVALID_FIELDS" }, { status: 400 });
  if (departmentId && !await prisma.department.findFirst({ where: { id: departmentId, hotelTenantId: current.hotelTenantId, isDeleted: false }, select: { id: true } })) return NextResponse.json({ error: "INVALID_DEPARTMENT" }, { status: 400 });
  const teamIds = await acceptedTeamIds(current.hotelTenantId, selectedTeamIds); if (teamIds === null) return NextResponse.json({ error: "INVALID_TEAM" }, { status: 400 });
  try {
    const mcp = await getMcpUserContext(current.hotelTenantId);
    await prisma.$transaction(async (tx) => {
      const hotel = await tx.hotelTenant.findUniqueOrThrow({ where: { id: current.hotelTenantId }, select: { hotelLanguage: true } });
      let remote: { id: string; password: string } | null = null;
      if (mcp) remote = await createRemoteUser(mcp, { email, role: role as UserRole, isActive, departmentId, password });
      const user = await tx.user.create({ data: { hotelTenantId: current.hotelTenantId, firstName, lastName, email, passwordHash: await bcrypt.hash(password, 12), phoneNumber: phone, language: hotel.hotelLanguage, role: role as UserRole, departmentId, teamId: teamIds[0] ?? null, isActive, mcpUserId: remote?.id, mcpUserPassword: remote?.password } });
      await replaceUserTeams(tx, user.id, teamIds);
      await recordAuditLog(tx, { hotelTenantId: current.hotelTenantId, actorId: current.id, action: "CREATE", entityType: "USER", entityId: user.id, changes: { after: { firstName, lastName, email, role } } });
    }, { timeout: 20_000 });
    const hotel = await prisma.hotelTenant.findUnique({ where: { id: current.hotelTenantId }, select: { hotelLanguage: true, hotelNameEn: true, hotelNameDe: true, hotelNameIt: true } });
    const department = departmentId ? await prisma.department.findFirst({ where: { id: departmentId, hotelTenantId: current.hotelTenantId }, select: { nameEn: true, nameDe: true, nameIt: true } }) : null;
    const locale = hotel?.hotelLanguage === "DE" ? "de" : hotel?.hotelLanguage === "IT" ? "it" : "en";
    const pick = (en?: string | null, de?: string | null, it?: string | null) => locale === "de" ? (de || en || it || "") : locale === "it" ? (it || en || de || "") : (en || de || it || "");
    await dispatchUserWelcomeEmail({ to: email, firstName, password, hotelName: pick(hotel?.hotelNameEn, hotel?.hotelNameDe, hotel?.hotelNameIt), departmentName: pick(department?.nameEn, department?.nameDe, department?.nameIt), roleLabel: roleLabel(role, locale), loginUrl: `${(process.env.APP_URL || "").replace(/\/$/, "")}/login`, locale }).catch((error) => console.error("User welcome email was not queued", error));
    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) { if (error && typeof error === "object" && "code" in error && error.code === "P2002") return NextResponse.json({ error: "EMAIL_EXISTS" }, { status: 409 }); console.error("User/MCP creation failed", error); return NextResponse.json({ error: "MCP_SYNC_FAILED" }, { status: 502 }); }
}
