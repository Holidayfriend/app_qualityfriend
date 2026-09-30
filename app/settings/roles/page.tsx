"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { hotelRoleName, resolveRoleModules, type HotelRoleOption } from "../../../lib/auth/role-policy";
import { useRouter } from "next/navigation";
import { AppShell } from "../../../components/dashboard/app-shell";
import { useI18n } from "../../../components/i18n/i18n-provider";
import { BrandLoader } from "../../../components/ui/brand-loader";
import { additionalModuleMessages, clientRoleMessages, customRoleMessages, requestMessages } from "../../../lib/i18n/dictionaries";

type Level = string;
type ModuleId = "dashboard" | "aiAssistant" | "chat" | "mcp" | "handovers" | "tasks" | "housekeeping" | "housekeeper" | "repairs" | "notes" | "schedule" | "recruiting" | "manuals" | "budget" | "revenue" | "competitors" | "users" | "departmentTeams" | "roles";
type Row = { id: ModuleId; icon: string; levels: Level[] };

const all: Level[] = ["employee", "teamLead", "management", "administrator"];
const rows: Row[] = [
  { id: "dashboard", icon: "🏠", levels: all },
  { id: "aiAssistant", icon: "✨", levels: all },
  { id: "chat", icon: "💬", levels: all },
  { id: "mcp", icon: "🔌", levels: ["administrator"] },
  { id: "handovers", icon: "🤝", levels: all },
  { id: "tasks", icon: "✅", levels: all },
  { id: "housekeeping", icon: "🧹", levels: ["teamLead", "management", "administrator"] },
  { id: "housekeeper", icon: "🧽", levels: ["employee", "administrator"] },
  { id: "repairs", icon: "🔧", levels: all },
  { id: "notes", icon: "📝", levels: all },
  { id: "schedule", icon: "📅", levels: ["teamLead", "management", "administrator"] },
  { id: "recruiting", icon: "🔍", levels: ["administrator"] },
  { id: "manuals", icon: "📖", levels: all },
  { id: "revenue", icon: "🎯", levels: ["management", "administrator"] },
  { id: "users", icon: "👤", levels: ["administrator"] },
  { id: "departmentTeams", icon: "🏢", levels: ["administrator"] },
  { id: "roles", icon: "🔑", levels: ["administrator"] },
];

const databaseRoles: Record<Exclude<Level, "administrator">, string> = { employee: "EMPLOYEE", teamLead: "TEAM_LEAD", management: "MANAGEMENT" };
const mobileGroups: Array<{ title: Record<"en" | "de" | "it", string>; ids: ModuleId[] }> = [
  { title: { en: "Basics", de: "Grundlagen", it: "Base" }, ids: ["dashboard", "aiAssistant", "chat", "tasks", "manuals"] },
  { title: { en: "Operations", de: "Betrieb", it: "Operazioni" }, ids: ["handovers", "housekeeping", "housekeeper", "repairs", "notes", "schedule"] },
  { title: { en: "Strategy", de: "Strategie", it: "Strategia" }, ids: ["revenue"] },
  { title: { en: "Administration", de: "Administration", it: "Amministrazione" }, ids: ["recruiting", "users", "departmentTeams", "roles", "mcp"] },
];
const mobileCopy = {
  en: { modules: "modules", admin: "Administrator access is always enabled and cannot be restricted." },
  de: { modules: "Module", admin: "Administrator-Zugriff ist immer aktiviert und kann nicht eingeschränkt werden." },
  it: { modules: "moduli", admin: "L’accesso amministratore è sempre attivo e non può essere limitato." },
};

export default function RolesPage() {
  const { locale } = useI18n();
  const router = useRouter();
  const labels = clientRoleMessages[locale];
  const request = requestMessages[locale];
  const [roleOptions, setRoleOptions] = useState<HotelRoleOption[]>([]);
  const all = roleOptions.map((role) => Object.entries(databaseRoles).find(([, key]) => key === role.key)?.[0] ?? (role.key === "ADMIN" ? "administrator" : role.key));
  const roleName = (level: string) => {
    const role = roleOptions.find((role) => role.key === (databaseRoles[level] ?? (level === "administrator" ? "ADMIN" : level)));
    return role ? hotelRoleName(role, locale) : level;
  };
  const canRename = (level: string) => roleOptions.some((role) => role.key === level && !role.isSystem);
  const editHref = (level: string) => `/settings/roles/${encodeURIComponent(level)}/edit`;
  const moduleLabels = { ...labels.modules, ...additionalModuleMessages[locale] };
  const [access, setAccess] = useState<Record<ModuleId, Level[]>>(() => Object.fromEntries(rows.map((row) => [row.id, row.levels])) as Record<ModuleId, Level[]>);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState("");
  const [mobileLevel, setMobileLevel] = useState<Level>("employee");

  useEffect(() => {
    let active = true;
    Promise.all([fetch("/api/settings/role-permissions"), fetch("/api/settings/roles")]).then(async ([permissionResponse, roleResponse]) => {
      if (permissionResponse.status === 401) return router.replace("/login");
      if (!permissionResponse.ok || !roleResponse.ok) throw new Error();
      const saved = await permissionResponse.json() as Array<{ role: string; module_key: ModuleId; can_view: boolean }>;
      const roles = await roleResponse.json() as HotelRoleOption[];
      if (!active) return;
      setRoleOptions(roles);
      const next = Object.fromEntries(rows.map((row) => [row.id, []])) as unknown as Record<ModuleId, Level[]>;
      for (const role of roles) {
        const level = Object.entries(databaseRoles).find(([, key]) => key === role.key)?.[0] ?? (role.key === "ADMIN" ? "administrator" : role.key);
        const modules = resolveRoleModules(role.key, saved.filter((item) => item.role === role.key).map((item) => ({ moduleKey: item.module_key, canView: item.can_view })));
        for (const row of rows) if (modules.includes(row.id)) next[row.id].push(level);
      }
      setAccess(next);
    }).catch(() => { if (active) setError(request.failed); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [request.failed, router]);

  async function toggle(moduleId: ModuleId, level: Level, checked: boolean) {
    if (level === "administrator") return;
    const previous = access[moduleId];
    setAccess((current) => ({ ...current, [moduleId]: checked ? [...current[moduleId], level] : current[moduleId].filter((item) => item !== level) }));
    setUpdating(true); setError("");
    try {
      const response = await fetch("/api/settings/role-permissions", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ role: databaseRoles[level] ?? level, moduleKey: moduleId, canView: checked }) });
      if (!response.ok) throw new Error();
    } catch {
      setAccess((current) => ({ ...current, [moduleId]: previous }));
      setError(request.failed);
    } finally { setUpdating(false); }
  }

  return <AppShell activeItem="settings"><main className="p-4 sm:p-5 lg:p-7">
    <button type="button" onClick={() => router.push("/settings")} className="mb-3.5 cursor-pointer text-[12.5px] font-semibold text-[var(--qf-text-muted)] hover:text-[var(--qf-accent)]">← {labels.settings}</button>
    {error ? <p role="alert" className="mb-4 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p> : null}
    {loading ? <BrandLoader label={request.loading} /> : <section>
      <div className="mb-4 flex justify-end"><Link href="/settings/roles/new" className="rounded-lg bg-[var(--qf-accent)] px-4 py-2.5 text-sm font-semibold text-white">+ {customRoleMessages[locale].create}</Link></div><header className="mb-4"><div className="flex items-start justify-between gap-3"><div><h1 className="text-lg font-bold sm:text-xl">{labels.title}</h1><p className="mt-1 max-w-2xl text-xs leading-5 text-[var(--qf-text-muted)] sm:text-[13px]">{labels.description}</p></div>{updating ? <span className="shrink-0 rounded-full bg-[var(--qf-accent-soft)] px-2.5 py-1 text-[10px] font-bold text-[var(--qf-accent)]">{request.loading}</span> : null}</div></header>

      <div className="md:hidden">
        <div className="mb-4 grid grid-cols-2 gap-2" role="tablist" aria-label={labels.title}>{all.map((level) => <button key={level} type="button" role="tab" aria-selected={mobileLevel === level} onClick={() => setMobileLevel(level)} className={`min-h-11 rounded-[9px] border px-3 py-2 text-left transition ${mobileLevel === level ? "border-[var(--qf-accent)] bg-[var(--qf-accent-soft)] text-[var(--qf-text)]" : "border-[var(--qf-border)] bg-white text-[var(--qf-text-muted)]"}`}><span className="block text-[12px] font-bold leading-4">{roleName(level)}</span><span className="mt-0.5 block text-[10px] opacity-70">{rows.filter((row) => access[row.id].includes(level)).length} / {rows.length} {mobileCopy[locale].modules}</span></button>)}</div>
        {canRename(mobileLevel) ? <Link href={editHref(mobileLevel)} className="mb-4 inline-block text-sm font-semibold text-[var(--qf-accent)]">{customRoleMessages[locale].edit}: {roleName(mobileLevel)}</Link> : null}
        {mobileLevel === "administrator" ? <div className="mb-4 flex items-start gap-3 rounded-[10px] border border-[var(--qf-border)] bg-white p-3.5 text-xs text-[var(--qf-text-muted)]"><span className="text-lg">🔒</span><p><strong className="block text-[var(--qf-text)]">{labels.levels.administrator}</strong>{mobileCopy[locale].admin}</p></div> : null}
        <div className="space-y-5">{mobileGroups.map((group) => <section key={group.title.en}><h2 className="mb-2 px-0.5 text-[10px] font-bold uppercase tracking-[.7px] text-[var(--qf-text-muted)]">{group.title[locale]}</h2><div className="overflow-hidden rounded-[11px] border border-[var(--qf-border)] bg-white shadow-[var(--qf-shadow)]">{group.ids.map((id) => { const row = rows.find((item) => item.id === id); if (!row) return null; const checked = access[id].includes(mobileLevel); return <label key={id} className={`flex min-h-[62px] items-center gap-3 border-b border-[var(--qf-border)] px-3.5 py-2.5 last:border-b-0 ${mobileLevel === "administrator" ? "cursor-default" : "cursor-pointer active:bg-[#fafaf8]"}`}><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[9px] bg-[var(--qf-background)] text-lg">{row.icon}</span><span className="min-w-0 flex-1"><strong className="block truncate text-[13px]">{moduleLabels[id]}</strong></span><input type="checkbox" className="peer sr-only" checked={checked} disabled={mobileLevel === "administrator" || updating} onChange={(event) => void toggle(id, mobileLevel, event.target.checked)} aria-label={`${moduleLabels[id]}: ${roleName(mobileLevel)}`} /><span aria-hidden className="relative h-7 w-12 shrink-0 rounded-full bg-gray-200 transition peer-checked:bg-[var(--qf-accent)] peer-disabled:opacity-60 after:absolute after:left-1 after:top-1 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:after:translate-x-5" /></label>; })}</div></section>)}</div>
      </div>

      <div className="hidden overflow-hidden rounded-[var(--qf-radius)] border border-[var(--qf-border)] bg-white shadow-[var(--qf-shadow)] md:block"><div className="overflow-x-auto p-5"><table className="w-full min-w-[820px] border-collapse text-[12.5px]" style={{ minWidth: Math.max(820, 220 + all.length * 155) }}>
        <thead><tr><th className="border-b-2 border-[var(--qf-border)] bg-[#f9f8f6] px-2.5 py-2.5 text-left text-[11px] font-bold text-[var(--qf-text-muted)]">{labels.module}</th>{all.map((level) => <th key={level} className="border-b-2 border-[var(--qf-border)] bg-[#f9f8f6] px-2.5 py-2.5 text-center text-[11px] font-bold text-[var(--qf-text-muted)]"><span className="block">{roleName(level)}</span>{canRename(level) ? <Link href={editHref(level)} aria-label={`${customRoleMessages[locale].edit}: ${roleName(level)}`} className="mt-1 inline-block font-medium text-[var(--qf-accent)] hover:underline">{customRoleMessages[locale].edit}</Link> : null}</th>)}</tr></thead>
        <tbody>{rows.map((row) => <tr key={row.id} className="group"><td className="border-b border-[var(--qf-border)] px-2.5 py-2.5 font-semibold group-hover:bg-[#fafaf8]">{row.icon} {moduleLabels[row.id]}</td>{all.map((level) => <td key={level} className="border-b border-[var(--qf-border)] px-2.5 py-2.5 text-center group-hover:bg-[#fafaf8]"><input type="checkbox" checked={access[row.id].includes(level)} disabled={level === "administrator" || updating} onChange={(event) => toggle(row.id, level, event.target.checked)} aria-label={`${moduleLabels[row.id]}: ${roleName(level)}`} className="h-4 w-4 cursor-pointer accent-[var(--qf-accent)] disabled:cursor-not-allowed disabled:opacity-50" /></td>)}</tr>)}</tbody>
      </table></div></div>
    </section>}
  </main></AppShell>;
}
