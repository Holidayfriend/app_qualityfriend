"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { AppShell } from "../../../components/dashboard/app-shell";
import { useI18n } from "../../../components/i18n/i18n-provider";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { BrandLoader } from "../../../components/ui/brand-loader";
import { requestMessages } from "../../../lib/i18n/dictionaries";

type Locale = "en" | "de" | "it";
type Entity = { id: string; names: Record<Locale, string>; count: number };
type EntityType = "department" | "team";
const endpoints = { department: "/api/settings/departments", team: "/api/settings/teams" } as const;

export default function DepartmentsPage() {
  const { dictionary, locale } = useI18n();
  const router = useRouter();
  const { common: c, settings: s } = dictionary;
  const messages = requestMessages[locale];
  const [departments, setDepartments] = useState<Entity[]>([]);
  const [teams, setTeams] = useState<Entity[]>([]);
  const [loading, setLoading] = useState(true);
  const [requestError, setRequestError] = useState("");
  const [saving, setSaving] = useState(false);
  const [modal, setModal] = useState<{ type: EntityType; index: number | null } | null>(null);
  const [names, setNames] = useState<Record<Locale, string>>({ en: "", de: "", it: "" });
  const [errors, setErrors] = useState<Partial<Record<Locale, string>>>({});

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const [departmentsResponse, teamsResponse] = await Promise.all([fetch(endpoints.department), fetch(endpoints.team)]);
        if (departmentsResponse.status === 401 || teamsResponse.status === 401) return router.replace("/login");
        if (!departmentsResponse.ok || !teamsResponse.ok) throw new Error();
        const [departmentData, teamData] = await Promise.all([
          departmentsResponse.json() as Promise<Entity[]>, teamsResponse.json() as Promise<Entity[]>,
        ]);
        if (active) { setDepartments(departmentData); setTeams(teamData); }
      } catch { if (active) setRequestError(messages.failed); }
      finally { if (active) setLoading(false); }
    }
    void load();
    return () => { active = false; };
  }, [messages.failed, router]);

  function openModal(type: EntityType, index: number | null) {
    const entity = index === null ? null : (type === "department" ? departments : teams)[index];
    setNames(entity?.names ?? { en: "", de: "", it: "" });
    setErrors({}); setRequestError(""); setModal({ type, index });
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!modal || saving) return;
    const nextErrors: Partial<Record<Locale, string>> = {};
    for (const language of ["en", "de", "it"] as const) if (!names[language].trim()) nextErrors[language] = c.required;
    if (Object.keys(nextErrors).length) return setErrors(nextErrors);
    const items = modal.type === "department" ? departments : teams;
    const edited = modal.index === null ? null : items[modal.index];
    setSaving(true); setRequestError("");
    try {
      const response = await fetch(edited ? `${endpoints[modal.type]}/${edited.id}` : endpoints[modal.type], {
        method: edited ? "PATCH" : "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nameEn: names.en, nameDe: names.de, nameIt: names.it }),
      });
      if (response.status === 401) return router.replace("/login");
      const data = await response.json();
      if (!response.ok) { setRequestError(data.error === "NAME_EXISTS" ? messages.nameExists : messages.failed); return; }
      const update = (current: Entity[]) => edited ? current.map((item) => item.id === edited.id ? data : item) : [...current, data];
      if (modal.type === "department") setDepartments(update); else setTeams(update);
      setModal(null);
    } catch { setRequestError(messages.failed); }
    finally { setSaving(false); }
  }

  async function remove(type: EntityType, index: number) {
    const entity = (type === "department" ? departments : teams)[index];
    if (!entity) return;
    setRequestError(""); setSaving(true);
    try {
      const response = await fetch(`${endpoints[type]}/${entity.id}`, { method: "DELETE" });
      if (response.status === 401) return router.replace("/login");
      if (!response.ok) throw new Error();
      const update = (items: Entity[]) => items.filter((item) => item.id !== entity.id);
      if (type === "department") setDepartments(update); else setTeams(update);
    } catch { setRequestError(messages.failed); }
    finally { setSaving(false); }
  }

  return <AppShell activeItem="settings">
    <main className="p-4 sm:p-5 lg:p-7">
      <button type="button" onClick={() => router.push("/settings")} className="mb-3.5 cursor-pointer text-[12.5px] font-semibold text-[var(--qf-text-muted)] hover:text-[var(--qf-accent)]">← {s.manageDepartments}</button>
      {requestError && !modal ? <p role="alert" className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{requestError}</p> : null}
      {loading ? <BrandLoader label={messages.loading} /> : <div className="space-y-8">
        <EntitySection title={s.departments} addLabel={s.addDepartment} singular={s.employee} plural={s.employees} items={departments} locale={locale} editLabel={s.edit} deleteLabel={s.delete} onAdd={() => openModal("department", null)} onEdit={(index) => openModal("department", index)} onDelete={(index) => void remove("department", index)} />
        <EntitySection title={s.teams} addLabel={s.addTeam} singular={s.member} plural={s.members} items={teams} locale={locale} editLabel={s.edit} deleteLabel={s.delete} onAdd={() => openModal("team", null)} onEdit={(index) => openModal("team", index)} onDelete={(index) => void remove("team", index)} />
      </div>}
    </main>
    {modal ? <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 p-4" onMouseDown={(event) => event.target === event.currentTarget && setModal(null)}><div role="dialog" aria-modal="true" className="w-full max-w-[440px] overflow-hidden rounded-xl bg-white shadow-2xl"><header className="flex items-center justify-between border-b border-[var(--qf-border)] px-5 py-4"><h2 className="text-[15px] font-bold">{modal.index === null ? c.add : c.edit} {modal.type === "department" ? s.departments : s.teams}</h2><button type="button" onClick={() => setModal(null)} className="h-7 w-7 cursor-pointer rounded-md hover:bg-[var(--qf-background)]">×</button></header><form onSubmit={save} noValidate><div className="space-y-4 px-5 py-5">{requestError ? <p role="alert" className="text-xs text-red-600">{requestError}</p> : null}<Input id="name-en" label={c.nameEnglish} value={names.en} error={errors.en} onChange={(event) => setNames({ ...names, en: event.target.value })} autoFocus /><Input id="name-de" label={c.nameGerman} value={names.de} error={errors.de} onChange={(event) => setNames({ ...names, de: event.target.value })} /><Input id="name-it" label={c.nameItalian} value={names.it} error={errors.it} onChange={(event) => setNames({ ...names, it: event.target.value })} /></div><footer className="flex justify-end gap-2.5 border-t border-[var(--qf-border)] px-5 py-4"><Button type="button" variant="secondary" onClick={() => setModal(null)}>{c.cancel}</Button><Button type="submit" disabled={saving}>{c.save}</Button></footer></form></div></div> : null}
    {saving ? <BrandLoader label={messages.loading} overlay /> : null}
  </AppShell>;
}

function EntitySection({ title, addLabel, singular, plural, items, locale, editLabel, deleteLabel, onAdd, onEdit, onDelete }: { title: string; addLabel: string; singular: string; plural: string; items: Entity[]; locale: Locale; editLabel: string; deleteLabel: string; onAdd: () => void; onEdit: (index: number) => void; onDelete: (index: number) => void }) {
  return <section><h1 className="mb-3 text-[11px] font-bold uppercase tracking-[.6px] text-[var(--qf-text-light)]">{title}</h1><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{items.map((item, index) => <article key={item.id} className="flex items-center justify-between rounded-lg border border-[var(--qf-border)] bg-white px-4 py-3.5"><div><h2 className="text-[13.5px] font-semibold">{item.names[locale]}</h2><p className="mt-0.5 text-[11.5px] text-[var(--qf-text-light)]">{item.count} {item.count === 1 ? singular : plural}</p></div><div className="flex gap-1.5"><button type="button" onClick={() => onEdit(index)} aria-label={`${editLabel}: ${item.names[locale]}`} className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md border border-[var(--qf-border)] hover:border-[var(--qf-accent)]">✏️</button><button type="button" onClick={() => onDelete(index)} aria-label={`${deleteLabel}: ${item.names[locale]}`} className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md border border-[var(--qf-border)] hover:border-[var(--qf-danger)]">🗑️</button></div></article>)}<button type="button" onClick={onAdd} className="flex min-h-[74px] cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-[var(--qf-border)] text-[13px] font-semibold text-[var(--qf-text-light)] hover:border-[var(--qf-accent)] hover:text-[var(--qf-accent)]">+ {addLabel}</button></div></section>;
}
