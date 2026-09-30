import assert from "node:assert/strict";
import { test } from "node:test";
import { editableModuleKeys, hotelRoleName, moduleKeys, resolveRoleModules, systemRoles } from "../lib/auth/role-policy";

test("existing four roles retain their module defaults", () => {
  const expected = {
    EMPLOYEE: ["dashboard", "aiAssistant", "chat", "handovers", "tasks", "housekeeper", "repairs", "notes", "manuals", "activityLog", "recycleBin", "settings"],
    TEAM_LEAD: ["dashboard", "aiAssistant", "chat", "handovers", "tasks", "housekeeping", "repairs", "notes", "schedule", "manuals", "activityLog", "recycleBin", "settings"],
    MANAGEMENT: ["dashboard", "aiAssistant", "chat", "handovers", "tasks", "housekeeping", "repairs", "notes", "schedule", "manuals", "revenue", "activityLog", "recycleBin", "settings", "budget", "competitors"],
    ADMIN: [...moduleKeys, "settings"],
  };
  for (const [role, modules] of Object.entries(expected)) assert.deepEqual(new Set(resolveRoleModules(role, [])), new Set(modules));
});

test("administrator remains unrestricted and legacy overrides still work", () => {
  const denied = moduleKeys.map((moduleKey) => ({ moduleKey, canView: false }));
  assert.deepEqual(new Set(resolveRoleModules("ADMIN", denied)), new Set([...moduleKeys, "settings"]));
  const employee = resolveRoleModules("EMPLOYEE", [{ moduleKey: "tasks", canView: false }, { moduleKey: "schedule", canView: true }]);
  assert.ok(!employee.includes("tasks"));
  assert.ok(employee.includes("schedule"));
});

test("a custom role copies Employee permissions once and changes independently", () => {
  const initial = new Set(resolveRoleModules("EMPLOYEE", [{ moduleKey: "housekeeper", canView: false }, { moduleKey: "schedule", canView: true }]));
  const snapshot = editableModuleKeys.map((moduleKey) => ({ moduleKey, canView: initial.has(moduleKey) }));
  assert.deepEqual(new Set(resolveRoleModules("custom-reception", snapshot)), initial);
  const changed = snapshot.map((item) => item.moduleKey === "schedule" ? { ...item, canView: false } : item);
  assert.ok(!resolveRoleModules("custom-reception", changed).includes("schedule"));
  assert.ok(resolveRoleModules("custom-other", snapshot).includes("schedule"));
});

test("custom roles gain only explicit access and keep forecast grouping", () => {
  assert.deepEqual(resolveRoleModules("custom", []), ["activityLog", "recycleBin", "settings"]);
  const modules = resolveRoleModules("custom", [{ moduleKey: "revenue", canView: true }]);
  for (const key of ["revenue", "budget", "competitors"]) assert.ok(modules.includes(key));
  for (const key of ["users", "roles", "recruiting", "mcp", "housekeeping"]) assert.ok(!modules.includes(key));
});

test("role names are translated labels, never permission identifiers", () => {
  const role = { key: "custom", nameEn: "Administrator", nameDe: "Administrator", nameIt: "Amministratore", isSystem: false };
  assert.equal(hotelRoleName(role, "it"), "Amministratore");
  assert.ok(!resolveRoleModules(role.key, []).includes("users"));
  assert.equal(systemRoles.length, 4);
});
