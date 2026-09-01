"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "../../../components/dashboard/app-shell";
import { useI18n } from "../../../components/i18n/i18n-provider";
import { BrandLoader } from "../../../components/ui/brand-loader";
import { additionalModuleMessages, clientRoleMessages, requestMessages } from "../../../lib/i18n/dictionaries";

type Level = "employee" | "teamLead" | "management" | "administrator";
type ModuleId = "dashboard" | "aiAssistant" | "chat" | "mcp" | "handovers" | "tasks" | "housekeeping" | "repairs" | "notes" | "schedule" | "recruiting" | "manuals" | "budget" | "revenue" | "competitors" | "users" | "departmentTeams" | "roles";
type Row = { id: ModuleId; icon: string; levels: Level[]; departments: string[] };

const all: Level[] = ["employee", "teamLead", "management", "administrator"];
const rows: Row[] = [
  { id: "dashboard", icon: "🏠", levels: all, departments: ["all"] },
  { id: "aiAssistant", icon: "✨", levels: all, departments: ["all"] },
  { id: "chat", icon: "💬", levels: all, departments: ["all"] },
  { id: "mcp", icon: "🔌", levels: ["administrator"], departments: ["all"] },
  { id: "handovers", icon: "🤝", levels: all, departments: ["reception", "restaurant"] },
  { id: "tasks", icon: "✅", levels: all, departments: ["all"] },
  { id: "housekeeping", icon: "🧹", levels: all, departments: ["housekeeping"] },
  { id: "repairs", icon: "🔧", levels: all, departments: ["housekeeping", "maintenance"] },
  { id: "notes", icon: "📝", levels: all, departments: ["reception", "restaurant"] },
  { id: "schedule", icon: "📅", levels: ["teamLead", "management", "administrator"], departments: ["all"] },
  { id: "recruiting", icon: "🔍", levels: ["administrator"], departments: ["all"] },
  { id: "manuals", icon: "📖", levels: all, departments: ["all"] },
  { id: "budget", icon: "📊", levels: ["management", "administrator"], departments: ["all"] },
  { id: "revenue", icon: "🎯", levels: ["management", "administrator"], departments: ["all"] },
  { id: "competitors", icon: "🏆", levels: ["management", "administrator"], departments: ["all"] },
  { id: "users", icon: "👤", levels: ["administrator"], departments: ["all"] },
  { id: "departmentTeams", icon: "🏢", levels: ["administrator"], departments: ["all"] },
  { id: "roles", icon: "🔑", levels: ["administrator"], departments: ["all"] },
];

const databaseRoles: Record<Exclude<Level, "administrator">, string> = { employee: "EMPLOYEE", teamLead: "TEAM_LEAD", management: "MANAGEMENT" };
const mobileGroups: Array<{ title: Record<"en" | "de" | "it", string>; ids: ModuleId[] }> = [
  { title: { en: "Basics", de: "Grundlagen", it: "Base" }, ids: ["dashboard", "aiAssistant", "chat", "tasks", "manuals"] },
  { title: { en: "Operations", de: "Betrieb", it: "Operazioni" }, ids: ["handovers", "housekeeping", "repairs", "notes", "schedule"] },
  { title: { en: "Strategy", de: "Strategie", it: "Strategia" }, ids: ["budget", "revenue", "competitors"] },
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
  const moduleLabels = { ...labels.modules, ...additionalModuleMessages[locale] };
  const [access, setAccess] = useState<Record<ModuleId, Level[]>>(() => Object.fromEntries(rows.map((row) => [row.id, row.levels])) as Record<ModuleId, Level[]>);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState("");
  const [mobileLevel, setMobileLevel] = useState<Level>("employee");

  useEffect(() => {
    let active = true;
    fetch("/api/settings/role-permissions").then(async (response) => {
      if (response.status === 401) return router.replace("/login");
      if (!response.ok) throw new Error();
      const saved = await response.json() as Array<{ role: string; module_key: ModuleId; can_view: boolean }>;
      if (!active) return;
      setAccess((current) => {
        const next = { ...current };
        for (const permission of saved) {
          const level = Object.entries(databaseRoles).find(([, role]) => role === permission.role)?.[0] as Exclude<Level, "administrator"> | undefined;
          if (!level || !next[permission.module_key]) continue;
          next[permission.module_key] = permission.can_view ? Array.from(new Set([...next[permission.module_key], level])) : next[permission.module_key].filter((item) => item !== level);
        }
        return next;
      });
    }).catch(() => { if (active) setError(request.failed); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [request.failed, router]);

  async function toggle(moduleId: ModuleId, level: Level, checked: boolean) {
    if (level === "administrator") return;
    const previous = access[moduleId];
    setAccess((current) => ({ ...current, [moduleId]: checked ? [...current[moduleId], level] : current[moduleId].filter((item) => item !== level) }));
    setUpdating(true); setError("");
    try {
      const response = await fetch("/api/settings/role-permissions", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ role: databaseRoles[level], moduleKey: moduleId, canView: checked }) });
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
      <header className="mb-4"><div className="flex items-start justify-between gap-3"><div><h1 className="text-lg font-bold sm:text-xl">{labels.title}</h1><p className="mt-1 max-w-2xl text-xs leading-5 text-[var(--qf-text-muted)] sm:text-[13px]">{labels.description}</p></div>{updating ? <span className="shrink-0 rounded-full bg-[var(--qf-accent-soft)] px-2.5 py-1 text-[10px] font-bold text-[var(--qf-accent)]">{request.loading}</span> : null}</div></header>

      <div className="md:hidden">
        <div className="mb-4 grid grid-cols-2 gap-2" role="tablist" aria-label={labels.title}>{all.map((level) => <button key={level} type="button" role="tab" aria-selected={mobileLevel === level} onClick={() => setMobileLevel(level)} className={`min-h-11 rounded-[9px] border px-3 py-2 text-left transition ${mobileLevel === level ? "border-[var(--qf-accent)] bg-[var(--qf-accent-soft)] text-[var(--qf-text)]" : "border-[var(--qf-border)] bg-white text-[var(--qf-text-muted)]"}`}><span className="block text-[12px] font-bold leading-4">{labels.levels[level]}</span><span className="mt-0.5 block text-[10px] opacity-70">{rows.filter((row) => access[row.id].includes(level)).length} / {rows.length} {mobileCopy[locale].modules}</span></button>)}</div>
        {mobileLevel === "administrator" ? <div className="mb-4 flex items-start gap-3 rounded-[10px] border border-[var(--qf-border)] bg-white p-3.5 text-xs text-[var(--qf-text-muted)]"><span className="text-lg">🔒</span><p><strong className="block text-[var(--qf-text)]">{labels.levels.administrator}</strong>{mobileCopy[locale].admin}</p></div> : null}
        <div className="space-y-5">{mobileGroups.map((group) => <section key={group.title.en}><h2 className="mb-2 px-0.5 text-[10px] font-bold uppercase tracking-[.7px] text-[var(--qf-text-muted)]">{group.title[locale]}</h2><div className="overflow-hidden rounded-[11px] border border-[var(--qf-border)] bg-white shadow-[var(--qf-shadow)]">{group.ids.map((id) => { const row = rows.find((item) => item.id === id); if (!row) return null; const checked = access[id].includes(mobileLevel); const departmentText = row.departments.includes("all") ? labels.allDepartments : row.departments.map((department) => labels.departmentNames[department as keyof typeof labels.departmentNames]).join(", "); return <label key={id} className={`flex min-h-[62px] items-center gap-3 border-b border-[var(--qf-border)] px-3.5 py-2.5 last:border-b-0 ${mobileLevel === "administrator" ? "cursor-default" : "cursor-pointer active:bg-[#fafaf8]"}`}><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[9px] bg-[var(--qf-background)] text-lg">{row.icon}</span><span className="min-w-0 flex-1"><strong className="block truncate text-[13px]">{moduleLabels[id]}</strong><small className="mt-0.5 block truncate text-[10.5px] text-[var(--qf-text-muted)]">{departmentText}</small></span><input type="checkbox" className="peer sr-only" checked={checked} disabled={mobileLevel === "administrator" || updating} onChange={(event) => void toggle(id, mobileLevel, event.target.checked)} aria-label={`${moduleLabels[id]}: ${labels.levels[mobileLevel]}`} /><span aria-hidden className="relative h-7 w-12 shrink-0 rounded-full bg-gray-200 transition peer-checked:bg-[var(--qf-accent)] peer-disabled:opacity-60 after:absolute after:left-1 after:top-1 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:after:translate-x-5" /></label>; })}</div></section>)}</div>
      </div>

      <div className="hidden overflow-hidden rounded-[var(--qf-radius)] border border-[var(--qf-border)] bg-white shadow-[var(--qf-shadow)] md:block"><div className="overflow-x-auto p-5"><table className="w-full min-w-[820px] border-collapse text-[12.5px]">
        <thead><tr>{[labels.module, ...all.map((level) => labels.levels[level]), labels.departments].map((heading, index) => <th key={heading} className={`border-b-2 border-[var(--qf-border)] bg-[#f9f8f6] px-2.5 py-2.5 text-[11px] font-bold text-[var(--qf-text-muted)] ${index === 0 ? "text-left" : "text-center"} ${index === all.length + 1 ? "border-l-2" : ""}`}>{heading}</th>)}</tr></thead>
        <tbody>{rows.map((row) => <tr key={row.id} className="group"><td className="border-b border-[var(--qf-border)] px-2.5 py-2.5 font-semibold group-hover:bg-[#fafaf8]">{row.icon} {moduleLabels[row.id]}</td>{all.map((level) => <td key={level} className="border-b border-[var(--qf-border)] px-2.5 py-2.5 text-center group-hover:bg-[#fafaf8]"><input type="checkbox" checked={access[row.id].includes(level)} disabled={level === "administrator"} onChange={(event) => toggle(row.id, level, event.target.checked)} aria-label={`${moduleLabels[row.id]}: ${labels.levels[level]}`} className="h-4 w-4 cursor-pointer accent-[var(--qf-accent)] disabled:cursor-not-allowed disabled:opacity-50" /></td>)}<td className="border-b border-l-2 border-[var(--qf-border)] px-2.5 py-2.5 text-center text-xs text-[var(--qf-text-muted)] group-hover:bg-[#fafaf8]">{row.departments.includes("all") ? labels.allDepartments : row.departments.map((department) => labels.departmentNames[department as keyof typeof labels.departmentNames]).join(", ")}</td></tr>)}</tbody>
      </table></div></div>
    </section>}
  </main></AppShell>;
}
