"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { AppShell } from "../dashboard/app-shell";
import { useI18n } from "../i18n/i18n-provider";
import { housekeepingMessages, requestMessages } from "../../lib/i18n/dictionaries";

import { BrandLoader } from "../ui/brand-loader";

type Frequency = "DAILY" | "EVERY_SECOND_DAY" | "WEEKLY" | "ON_REQUEST";
type Values = { name: string; expressMinutes: string; normalMinutes: string; departureMinutes: string; finalMinutes: string; cleaningFrequency: Frequency; cleaningWeekdays: number[]; linenFrequency: Frequency; linenWeekdays: number[] };
const empty: Values = { name: "", expressMinutes: "", normalMinutes: "", departureMinutes: "", finalMinutes: "", cleaningFrequency: "DAILY", cleaningWeekdays: [], linenFrequency: "DAILY", linenWeekdays: [] };

export function CategoryEditor() {
  const { locale } = useI18n();
  const t = housekeepingMessages[locale];
  const router = useRouter();
  const id = useSearchParams().get("edit");
  const [values, setValues] = useState<Values>(empty);
  const [loading, setLoading] = useState(Boolean(id));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;
    let active = true;
    fetch(`/api/housekeeping/categories/${id}?locale=${locale}`, { cache: "no-store" }).then(async (response) => {
      if (!response.ok) throw new Error("Category not found.");
      return response.json() as Promise<{ category: { name: string; expressMinutes: number | null; normalMinutes: number | null; departureMinutes: number | null; finalMinutes: number | null; cleaningFrequency: Frequency | null; cleaningWeekdays: number[]; linenFrequency: Frequency | null; linenWeekdays: number[] } }>;
    }).then(({ category }) => { if (active) setValues({ name: category.name, expressMinutes: category.expressMinutes?.toString() ?? "", normalMinutes: category.normalMinutes?.toString() ?? "", departureMinutes: category.departureMinutes?.toString() ?? "", finalMinutes: category.finalMinutes?.toString() ?? "", cleaningFrequency: category.cleaningFrequency ?? "DAILY", cleaningWeekdays: category.cleaningWeekdays ?? [], linenFrequency: category.linenFrequency ?? "DAILY", linenWeekdays: category.linenWeekdays ?? [] }); }).catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : "Unable to load category."); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id, locale]);

  function change<Key extends keyof Values>(key: Key, value: Values[Key]) { setValues((current) => ({ ...current, [key]: value })); }
  function toggleWeekday(key: "cleaningWeekdays" | "linenWeekdays", day: number) {
    const current = values[key];
    change(key, current.includes(day) ? current.filter((value) => value !== day) : [...current, day].sort((a, b) => a - b));
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (saving) return; setSaving(true); setError("");
    const payload = { ...values, locale, expressMinutes: values.expressMinutes === "" ? null : Number(values.expressMinutes), normalMinutes: values.normalMinutes === "" ? null : Number(values.normalMinutes), departureMinutes: values.departureMinutes === "" ? null : Number(values.departureMinutes), finalMinutes: values.finalMinutes === "" ? null : Number(values.finalMinutes) };
    try { const response = await fetch(id ? `/api/housekeeping/categories/${id}` : "/api/housekeeping/categories", { method: id ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }); if (!response.ok) throw new Error("Unable to save room category."); router.push("/housekeeping/settings/categories"); router.refresh(); } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to save room category."); setSaving(false); }
  }

  const frequencyOptions: [Frequency, string][] = [["DAILY", t.daily], ["EVERY_SECOND_DAY", t.everySecondDay], ["WEEKLY", t.weekly], ["ON_REQUEST", t.onRequest]];
  const weekdayOptions: [number, string][] = [[1, t.monday], [2, t.tuesday], [3, t.wednesday], [4, t.thursday], [5, t.friday], [6, t.saturday], [7, t.sunday]];
  const minutes = (key: "expressMinutes" | "normalMinutes" | "departureMinutes" | "finalMinutes", label: string) => <label className="block text-[12px] font-semibold text-[var(--qf-text-muted)]"><span className="mb-1.5 block">{label}</span><input className="qf-field" type="number" min={0} step={1} value={values[key]} onChange={(event) => change(key, event.target.value)} /></label>;
  const frequency = (key: "cleaningFrequency" | "linenFrequency", label: string) => <label className="block text-[12px] font-semibold text-[var(--qf-text-muted)]"><span className="mb-1.5 block">{label}</span><select className="qf-field" value={values[key]} onChange={(event) => change(key, event.target.value as Frequency)}>{frequencyOptions.map(([value, optionLabel]) => <option key={value} value={value}>{optionLabel}</option>)}</select></label>;
  const weekdayFieldset = (key: "cleaningWeekdays" | "linenWeekdays", title: string, help: string) => <fieldset className="rounded-[8px] border border-[var(--qf-border)] p-4"><legend className="px-1 text-[12px] font-semibold text-[var(--qf-text-muted)]">{title}</legend><div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{weekdayOptions.map(([day, label]) => <label key={day} className="flex cursor-pointer items-center gap-2 text-[12px]"><input type="checkbox" checked={values[key].includes(day)} onChange={() => toggleWeekday(key, day)} />{label}</label>)}</div><p className="mt-3 text-[11px] text-[var(--qf-text-light)]">{help}</p></fieldset>;
  return <AppShell activeItem="housekeeping" pageTitle={t.housekeeping}><main className="p-4 sm:p-5 lg:p-7"><Link href="/housekeeping/settings/categories" className="mb-4 inline-flex text-[12.5px] font-semibold text-[var(--qf-text-muted)]">← {t.back}</Link><section className="max-w-2xl rounded-[10px] border border-[var(--qf-border)] bg-white shadow-[var(--qf-shadow)]"><header className="border-b border-[var(--qf-border)] px-5 py-[14px] text-[14px] font-bold">{id ? t.edit : t.addCategory}</header>{loading ? <BrandLoader label={requestMessages[locale].loading} /> : <form className="space-y-4 p-5" onSubmit={save}><label className="block text-[12px] font-semibold text-[var(--qf-text-muted)]"><span className="mb-1.5 block">{t.name}</span><input className="qf-field" value={values.name} onChange={(event) => change("name", event.target.value)} required /></label><div className="grid gap-4 sm:grid-cols-2">{minutes("expressMinutes", t.expressCleaning)}{minutes("normalMinutes", t.normalCleaning)}{minutes("departureMinutes", t.departureCleaning)}{minutes("finalMinutes", t.finalCleaning)}{frequency("cleaningFrequency", t.cleaningFrequency)}{frequency("linenFrequency", t.linenFrequency)}</div>{values.cleaningFrequency === "ON_REQUEST" ? weekdayFieldset("cleaningWeekdays", t.regularCleaningDays, t.regularCleaningDaysHelp) : null}{values.linenFrequency === "ON_REQUEST" ? weekdayFieldset("linenWeekdays", t.linenChangeDays, t.linenChangeDaysHelp) : null}{error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}<div className="flex gap-2 border-t border-[var(--qf-border)] pt-4"><button disabled={saving} className="min-h-[34px] rounded-[7px] bg-[var(--qf-accent)] px-[14px] text-[13px] font-semibold text-white disabled:opacity-60">{t.save}</button><Link href="/housekeeping/settings/categories" className="inline-flex min-h-[34px] items-center rounded-[7px] border border-[var(--qf-border)] px-[14px] text-[13px] font-semibold">{t.cancel}</Link></div></form>}</section></main>{saving ? <BrandLoader label={requestMessages[locale].loading} overlay /> : null}</AppShell>;
}
