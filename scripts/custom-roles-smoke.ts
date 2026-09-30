import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../app/generated/prisma/client";
import { systemRoles } from "../lib/auth/role-policy";

// Run explicitly against the local development app; all fixture data is removed.
const origin = process.env.ROLE_SMOKE_URL || "http://localhost:3000";
assert.ok(["localhost", "127.0.0.1"].includes(new URL(origin).hostname), "Local app only");
assert.ok(process.env.AUTH_SECRET && process.env.DATABASE_URL);
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
const fixtureIds: string[] = [];
function cookie(userId: string) {
  const payload = Buffer.from(JSON.stringify({ userId, expiresAt: Date.now() + 600_000 })).toString("base64url");
  return `qualityfriend_session=${payload}.${createHmac("sha256", process.env.AUTH_SECRET!).update(payload).digest("base64url")}`;
}
async function api(path: string, userId: string, method = "GET", body?: unknown, expected = 200) {
  const response = await fetch(`${origin}${path}`, { method, headers: { Cookie: cookie(userId), "Content-Type": "application/json", Origin: origin }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(120_000) });
  assert.equal(response.status, expected, `${method} ${path}: ${response.status}`);
  return response.json();
}
async function fixture() {
  return prisma.$transaction(async (tx) => {
    const id = randomUUID();
    const hotel = await tx.hotelTenant.create({ data: { id, hotelNameEn: "Role smoke", hotelNameDe: "Role smoke", hotelNameIt: "Role smoke", email: `${id}@example.invalid`, companyName: "Role test", streetAddress: "Test", postalCode: "00000", city: "Test", country: "Italy", contactPerson: "Test", timeZone: "Europe/Rome", subscriptionStatus: "COMPED" } });
    await tx.hotelRole.createMany({ data: systemRoles.map((role) => ({ ...role, hotelTenantId: id })) });
    const department = await tx.department.create({ data: { hotelTenantId: id, nameEn: "Test", nameDe: "Test", nameIt: "Test" } });
    const admin = await tx.user.create({ data: { hotelTenantId: id, role: "ADMIN", firstName: "Role", lastName: "Admin", email: `admin-${id}@example.invalid`, passwordHash: "unused", departmentId: department.id } });
    const employee = await tx.user.create({ data: { hotelTenantId: id, role: "EMPLOYEE", firstName: "Role", lastName: "Employee", email: `employee-${id}@example.invalid`, passwordHash: "unused", departmentId: department.id } });
    fixtureIds.push(id);
    return { hotel, department, admin, employee };
  });
}
async function main() {
  const a = await fixture(), b = await fixture();
  const initial = await api("/api/settings/roles", a.admin.id);
  assert.deepEqual(initial.map((role: { key: string }) => role.key), systemRoles.map((role) => role.key));
  await api("/api/settings/roles", a.employee.id, "GET", undefined, 403);
  await api("/api/settings/roles", a.admin.id, "POST", { nameEn: "" }, 400);
  const translated = await api("/api/settings/roles/translate", a.admin.id, "POST", { name: "Reception", locale: "en" });
  assert.deepEqual(Object.keys(translated).sort(), ["de", "en", "it"]);
  assert.equal(translated.en, "Reception");
  const custom = await api("/api/settings/roles", a.admin.id, "POST", { nameEn: "Reception", nameDe: "Rezeption", nameIt: "Ricevimento", key: "ADMIN", isSystem: true }, 201);
  assert.notEqual(custom.key, "ADMIN");
  assert.equal(custom.isSystem, false);
  const second = await api("/api/settings/roles", a.admin.id, "POST", { nameEn: "Night shift", nameDe: "Nachtschicht", nameIt: "Turno notturno" }, 201);
  assert.equal((await api("/api/settings/roles", a.admin.id)).length, 6);
  assert.equal((await api("/api/settings/roles", b.admin.id)).length, 4);
  const users = await api("/api/settings/users", a.admin.id);
  assert.ok(users.roles.some((role: { key: string }) => role.key === custom.key));
  const userBody = { firstName: "Role", lastName: "Employee", email: a.employee.email, phone: "", password: "", role: custom.key, departmentIds: [a.department.id], teamIds: [], isActive: true };
  await api(`/api/settings/users/${a.employee.id}`, a.admin.id, "PATCH", userBody);
  let me = await api("/api/me", a.employee.id);
  assert.equal(me.role, custom.key);
  assert.deepEqual(me.role_names, { en: "Reception", de: "Rezeption", it: "Ricevimento" });
  assert.ok(me.allowed_modules.includes("tasks"));
  const renamePath = `/api/settings/roles/${custom.key}`;
  const beforeRename = await prisma.roleModulePermission.findMany({ where: { hotelTenantId: a.hotel.id, role: custom.key }, orderBy: { id: "asc" } });
  await api(renamePath, a.employee.id, "PATCH", { name: "Denied", locale: "en" }, 403);
  await api(renamePath, b.admin.id, "PATCH", { name: "Denied", locale: "en" }, 404);
  for (const role of systemRoles) await api(`/api/settings/roles/${role.key}`, a.admin.id, "PATCH", { name: "Denied", locale: "en" }, 403);
  await api(renamePath, a.admin.id, "PATCH", { name: "   ", locale: "en" }, 400);
  await api(renamePath, a.admin.id, "PATCH", { name: "Reception", locale: "fr" }, 400);
  const renamed = await api(renamePath, a.admin.id, "PATCH", { name: "Neue Rezeption", locale: "de", key: "ADMIN", isSystem: true });
  assert.equal(renamed.key, custom.key);
  assert.equal(renamed.isSystem, false);
  assert.equal(renamed.nameDe, "Neue Rezeption");
  assert.deepEqual(await prisma.roleModulePermission.findMany({ where: { hotelTenantId: a.hotel.id, role: custom.key }, orderBy: { id: "asc" } }), beforeRename);
  assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: a.employee.id } })).role, custom.key);
  assert.equal((await api("/api/me", a.employee.id)).role_names.de, "Neue Rezeption");

  await api("/api/settings/roles", a.employee.id, "POST", { nameEn: "Bad", nameDe: "Bad", nameIt: "Bad" }, 403);
  await api("/api/settings/role-permissions", a.employee.id, "PATCH", { role: custom.key, moduleKey: "tasks", canView: true }, 403);
  await api("/api/settings/role-permissions", a.admin.id, "PATCH", { role: custom.key, moduleKey: "tasks", canView: false });
  me = await api("/api/me", a.employee.id);
  assert.ok(!me.allowed_modules.includes("tasks"));
  assert.equal((await api("/api/tasks", a.employee.id)).canManage, false);
  await api("/api/tasks", a.employee.id, "POST", {}, 403);
  await api("/api/settings/role-permissions", a.admin.id, "PATCH", { role: custom.key, moduleKey: "tasks", canView: true });
  assert.equal((await api("/api/tasks", a.employee.id)).canManage, true);
  await api("/api/settings/role-permissions", a.admin.id, "PATCH", { role: custom.key, moduleKey: "revenue", canView: true });
  me = await api("/api/me", a.employee.id);
  for (const key of ["budget", "revenue", "competitors"]) assert.ok(me.allowed_modules.includes(key));
  await api("/api/settings/role-permissions", a.admin.id, "PATCH", { role: custom.key, moduleKey: "revenue", canView: false });
  me = await api("/api/me", a.employee.id);
  for (const key of ["budget", "revenue", "competitors"]) assert.ok(!me.allowed_modules.includes(key));
  await api("/api/settings/role-permissions", a.admin.id, "PATCH", { role: custom.key, moduleKey: "mcp", canView: true });
  assert.ok((await api("/api/me", a.employee.id)).allowed_modules.includes("mcp"));
  await api("/api/settings/role-permissions", b.admin.id, "PATCH", { role: custom.key, moduleKey: "tasks", canView: true }, 400);
  await api(`/api/settings/users/${b.employee.id}`, b.admin.id, "PATCH", { ...userBody, email: b.employee.email, departmentIds: [b.department.id] }, 400);
  await assert.rejects(prisma.user.update({ where: { id: b.employee.id }, data: { role: custom.key } }), (error: unknown) => Boolean(error && typeof error === "object" && "code" in error && error.code === "P2003"));
  await api("/api/settings/role-permissions", a.admin.id, "PATCH", { role: "ADMIN", moduleKey: "tasks", canView: false }, 400);
  await api(`/api/settings/users/${a.admin.id}`, a.admin.id, "PATCH", { ...userBody, email: a.admin.email }, 400);
  const permission = await prisma.roleModulePermission.findUniqueOrThrow({ where: { hotelTenantId_role_moduleKey: { hotelTenantId: a.hotel.id, role: second.key, moduleKey: "tasks" } } });
  assert.equal(permission.canView, true);
  for (const path of ["/settings/roles", "/settings/roles/new", `/settings/roles/${custom.key}/edit`, "/settings/users"]) {
    const response = await fetch(`${origin}${path}`, { headers: { Cookie: cookie(a.admin.id) }, signal: AbortSignal.timeout(120_000) });
    assert.equal(response.status, 200, path);
  }
  console.log("PASS: four defaults, six-role table data, translation fallback, custom-role assignment, live access changes, module API enforcement, independent permissions, safe renaming with unchanged assignments/permissions, tenant isolation, admin protection, and role pages.");
}
main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(async () => {
  try {
    for (const hotelTenantId of fixtureIds) {
      await prisma.user.deleteMany({ where: { hotelTenantId } });
      await prisma.hotelTenant.delete({ where: { id: hotelTenantId } });
    }
    console.log("Removed all role smoke-test fixtures.");
  } finally { await prisma.$disconnect(); }
});
