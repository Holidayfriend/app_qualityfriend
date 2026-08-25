"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "../../../components/dashboard/app-shell";
import { BrandLoader } from "../../../components/ui/brand-loader";
import { useI18n } from "../../../components/i18n/i18n-provider";
import { auditMessages, requestMessages } from "../../../lib/i18n/dictionaries";

type Log = { id: string; action: string; entity_type: string; entity_id: string | null; changes: unknown; description: Partial<Record<"en" | "de" | "it", string>> | null; created_at: string; actor_name: string };
type HotelUser = { id: string; first_name: string; last_name: string };

export default function ActivityLogPage() {
  const { dictionary, locale } = useI18n();
  const router = useRouter();
  const labels = auditMessages[locale];
  const request = requestMessages[locale];
  const [logs, setLogs] = useState<Log[]>([]);
  const [canViewAll, setCanViewAll] = useState(false);
  const [users, setUsers] = useState<HotelUser[]>([]);
  const [selectedUser, setSelectedUser] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams();
        if (selectedUser) params.set("userId", selectedUser);
        if (selectedDate) params.set("date", selectedDate);
        const response = await fetch(`/api/settings/activity-logs${params.size ? `?${params}` : ""}`);
        if (response.status === 401) return router.replace("/login");
        if (!response.ok) throw new Error();
        const data = await response.json();
        if (active) { setLogs(data.logs); setCanViewAll(data.canViewAll); setUsers(data.users); }
      } catch { if (active) setError(request.failed); }
      finally { if (active) setLoading(false); }
    }
    void load();
    return () => { active = false; };
  }, [request.failed, router, selectedDate, selectedUser]);

  return <AppShell activeItem="settings"><main className="p-4 sm:p-5 lg:p-7">
    <button type="button" onClick={() => router.push("/settings")} className="mb-3.5 cursor-pointer text-[12.5px] font-semibold text-[var(--qf-text-muted)] hover:text-[var(--qf-accent)]">← {dictionary.settings.activityLog}</button>
    <section className="overflow-hidden rounded-[var(--qf-radius)] border border-[var(--qf-border)] bg-white shadow-[var(--qf-shadow)]">
      <header className="border-b border-[var(--qf-border)] px-5 py-4"><div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><h1 className="text-sm font-bold">{dictionary.settings.activityLog}</h1><p className="mt-1 text-xs text-[var(--qf-text-muted)]">{canViewAll ? labels.allUsers : labels.onlyYou}</p></div>{canViewAll ? <div className="flex flex-col gap-2 sm:flex-row"><label className="text-[11px] font-semibold text-[var(--qf-text-muted)]"><span className="mb-1 block">{labels.filterDate}</span><input type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} className="h-9 cursor-pointer rounded-md border border-[var(--qf-border)] bg-white px-3 text-xs outline-none focus:border-[var(--qf-accent)]" /></label><label className="text-[11px] font-semibold text-[var(--qf-text-muted)]"><span className="mb-1 block">{labels.filterUser}</span><select value={selectedUser} onChange={(event) => setSelectedUser(event.target.value)} className="h-9 min-w-44 cursor-pointer rounded-md border border-[var(--qf-border)] bg-white px-3 text-xs outline-none focus:border-[var(--qf-accent)]"><option value="">{labels.everyUser}</option>{users.map((user) => <option key={user.id} value={user.id}>{user.first_name} {user.last_name}</option>)}</select></label></div> : null}</div></header>
      {loading ? <BrandLoader label={request.loading} /> : error ? <p role="alert" className="m-5 rounded-md bg-red-50 p-3 text-xs text-red-700">{error}</p> : logs.length === 0 ? <p className="p-8 text-center text-sm text-[var(--qf-text-muted)]">{labels.empty}</p> : <div className="divide-y divide-[var(--qf-border)]">{logs.map((log) => <article key={log.id} className="flex flex-col gap-1 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between"><p className="text-[13px] font-semibold">{log.description?.[locale] ?? `${log.actor_name} · ${labels.actions[log.action as keyof typeof labels.actions] ?? log.action} · ${labels.entities[log.entity_type as keyof typeof labels.entities] ?? log.entity_type}`}</p><time className="text-[11px] text-[var(--qf-text-muted)]" dateTime={log.created_at}>{new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(log.created_at))}</time></article>)}</div>}
    </section>
  </main></AppShell>;
}
