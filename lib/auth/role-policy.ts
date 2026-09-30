// Stable keys preserve the four existing roles and their administrator checks.
export const systemRoles = [
  { key: "EMPLOYEE", nameEn: "Employee", nameDe: "Mitarbeiter", nameIt: "Dipendente", isSystem: true },
  { key: "TEAM_LEAD", nameEn: "Team/Department Lead", nameDe: "Team-/Abteilungsleitung", nameIt: "Responsabile team/reparto", isSystem: true },
  { key: "MANAGEMENT", nameEn: "Management", nameDe: "Management", nameIt: "Direzione", isSystem: true },
  { key: "ADMIN", nameEn: "Administrator", nameDe: "Administrator", nameIt: "Amministratore", isSystem: true },
] as const;

export const moduleKeys = ["dashboard", "aiAssistant", "chat", "mcp", "handovers", "tasks", "housekeeping", "housekeeper", "repairs", "notes", "schedule", "recruiting", "manuals", "budget", "revenue", "competitors", "users", "departmentTeams", "roles", "activityLog", "recycleBin"] as const;
export type ModuleKey = typeof moduleKeys[number] | "settings";
export const editableModuleKeys = moduleKeys.filter((key) => key !== "activityLog" && key !== "recycleBin");

const defaults: Record<string, readonly string[]> = {
  EMPLOYEE: ["dashboard", "aiAssistant", "chat", "handovers", "tasks", "housekeeper", "repairs", "notes", "manuals", "activityLog", "recycleBin", "settings"],
  TEAM_LEAD: ["dashboard", "aiAssistant", "chat", "handovers", "tasks", "housekeeping", "repairs", "notes", "schedule", "manuals", "activityLog", "recycleBin", "settings"],
  MANAGEMENT: ["dashboard", "aiAssistant", "chat", "handovers", "tasks", "housekeeping", "repairs", "notes", "schedule", "manuals", "revenue", "activityLog", "recycleBin", "settings"],
};

export function resolveRoleModules(role: string, permissions: readonly { moduleKey: string; canView: boolean }[]) {
  if (role === "ADMIN") return [...moduleKeys, "settings"];
  // Personal settings/history remain available, just as for existing users.
  const access = new Set(Object.hasOwn(defaults, role) ? defaults[role] : ["activityLog", "recycleBin", "settings"]);
  for (const item of permissions) {
    if (item.canView) access.add(item.moduleKey);
    else access.delete(item.moduleKey);
  }
  const forecast = ["budget", "revenue", "competitors"];
  if (forecast.some((key) => access.has(key))) for (const key of forecast) access.add(key);
  return [...access];
}

export type HotelRoleOption = { key: string; nameEn: string; nameDe: string; nameIt: string; isSystem: boolean };
export function hotelRoleName(role: HotelRoleOption, locale: string) {
  return locale === "de" ? role.nameDe : locale === "it" ? role.nameIt : role.nameEn;
}
