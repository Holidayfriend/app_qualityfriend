"use client";

import { useDeferredValue, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "../../../components/dashboard/app-shell";
import { BrandLoader } from "../../../components/ui/brand-loader";
import { useI18n } from "../../../components/i18n/i18n-provider";
import { formatHotelDateTime, readHotelTimeZone } from "../../../lib/hotel/clock";
import { auditMessages, requestMessages } from "../../../lib/i18n/dictionaries";

type AuditModule = "settings" | "manuals" | "recruiting" | "revenue" | "schedule" | "notes" | "repairs" | "housekeeping" | "tasks" | "handovers";
type Log = {
  id: string;
  module: AuditModule;
  action: string;
  entity_type: string;
  entity_id: string | null;
  changes: unknown;
  description: Partial<Record<"en" | "de" | "it", string>> | null;
  created_at: string;
  actor_name: string;
};
type HotelUser = { id: string; first_name: string; last_name: string };
type HotelName = Partial<Record<"en" | "de" | "it", string>>;

const modules: AuditModule[] = ["settings", "manuals", "recruiting", "revenue", "schedule", "notes", "repairs", "housekeeping", "tasks", "handovers"];

function resultClass(action: string) {
  if (action === "DELETE") return "bg-red-50 text-red-700";
  if (action === "STATUS_CHANGE") return "bg-blue-50 text-blue-700";
  return "bg-emerald-50 text-emerald-700";
}

export default function ActivityLogPage() {
  const { dictionary, locale } = useI18n();
  const router = useRouter();
  const labels = auditMessages[locale];
  const request = requestMessages[locale];
  const [logs, setLogs] = useState<Log[]>([]);
  const [canViewAll, setCanViewAll] = useState(false);
  const [hotel, setHotel] = useState<HotelName>({});
  const [users, setUsers] = useState<HotelUser[]>([]);
  const [selectedModule, setSelectedModule] = useState<AuditModule | "all">("all");
  const [selectedUser, setSelectedUser] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams();
        if (selectedModule !== "all") params.set("module", selectedModule);
        if (selectedUser) params.set("userId", selectedUser);
        if (selectedDate) params.set("date", selectedDate);
        if (deferredSearch.trim()) params.set("search", deferredSearch.trim());

        const query = params.size ? "?" + params.toString() : "";
        const response = await fetch("/api/settings/activity-logs" + query);
        if (response.status === 401) return router.replace("/login");
        if (!response.ok) throw new Error();

        const data = await response.json();
        if (active) {
          setLogs(data.logs);
          setCanViewAll(data.canViewAll);
          setHotel(data.hotel ?? {});
          setUsers(data.users);
        }
      } catch {
        if (active) setError(request.failed);
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [deferredSearch, request.failed, router, selectedDate, selectedModule, selectedUser]);

  const hasFilters = selectedModule !== "all" || selectedUser !== "" || selectedDate !== "" || search !== "";

  function clearFilters() {
    setSelectedModule("all");
    setSelectedUser("");
    setSelectedDate("");
    setSearch("");
  }

  function titleFor(log: Log) {
    const description = log.description?.[locale];
    if (description) {
      const withoutActor = description.startsWith(log.actor_name) ? description.slice(log.actor_name.length).trim() : description;
      return withoutActor.charAt(0).toUpperCase() + withoutActor.slice(1);
    }
    const action = labels.actions[log.action as keyof typeof labels.actions] ?? log.action;
    const entity = labels.entities[log.entity_type as keyof typeof labels.entities] ?? log.entity_type;
    return action + " · " + entity;
  }

  return (
    <AppShell activeItem="settings">
      <main className="p-4 sm:p-5 lg:p-7">
        <button
          type="button"
          onClick={() => router.push("/settings")}
          className="mb-3.5 cursor-pointer text-[12.5px] font-semibold text-[var(--qf-text-muted)] hover:text-[var(--qf-accent)]"
        >
          ← {dictionary.navigation.settings}
        </button>

        <div className="mb-4">
          <h1 className="text-lg font-bold">{dictionary.settings.activityLog}</h1>
          <p className="mt-1 text-xs leading-5 text-[var(--qf-text-muted)]">{labels.description}</p>
          <p className="mt-1 text-[11px] font-semibold text-[var(--qf-text-muted)]">
            {labels.hotel}: {hotel[locale] ?? hotel.en ?? "—"} · {canViewAll ? labels.allUsers : labels.onlyYou}
          </p>
        </div>

        <section aria-label={dictionary.settings.activityLog}>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              aria-pressed={selectedModule === "all"}
              onClick={() => setSelectedModule("all")}
              className={"cursor-pointer rounded-full border px-3.5 py-2 text-xs font-semibold transition " + (selectedModule === "all" ? "border-[var(--qf-accent)] bg-[var(--qf-accent)] text-white" : "border-[var(--qf-border)] bg-white text-[var(--qf-text-muted)] hover:border-[var(--qf-accent)]")}
            >
              {labels.allModules}
            </button>
            {modules.map((module) => (
              <button
                key={module}
                type="button"
                aria-pressed={selectedModule === module}
                onClick={() => setSelectedModule(module)}
                className={"cursor-pointer rounded-full border px-3.5 py-2 text-xs font-semibold transition " + (selectedModule === module ? "border-[var(--qf-accent)] bg-[var(--qf-accent)] text-white" : "border-[var(--qf-border)] bg-white text-[var(--qf-text-muted)] hover:border-[var(--qf-accent)]")}
              >
                {labels.modules[module]}
              </button>
            ))}
          </div>

          <div className="mb-3 flex flex-wrap items-end gap-2">
            <label className="min-w-52 flex-1 text-[11px] font-semibold text-[var(--qf-text-muted)]">
              <span className="sr-only">{labels.search}</span>
              <span className="relative block">
                <span aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2">🔍</span>
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={labels.search}
                  className="h-10 w-full rounded-lg border border-[var(--qf-border)] bg-white pl-9 pr-3 text-xs outline-none focus:border-[var(--qf-accent)]"
                />
              </span>
            </label>
            <label className="text-[11px] font-semibold text-[var(--qf-text-muted)]">
              <span className="mb-1 block">{labels.filterDate}</span>
              <input
                type="date"
                value={selectedDate}
                onChange={(event) => setSelectedDate(event.target.value)}
                className="h-10 cursor-pointer rounded-lg border border-[var(--qf-border)] bg-white px-3 text-xs outline-none focus:border-[var(--qf-accent)]"
              />
            </label>
            {canViewAll ? (
              <label className="text-[11px] font-semibold text-[var(--qf-text-muted)]">
                <span className="mb-1 block">{labels.filterUser}</span>
                <select
                  value={selectedUser}
                  onChange={(event) => setSelectedUser(event.target.value)}
                  className="h-10 min-w-44 cursor-pointer rounded-lg border border-[var(--qf-border)] bg-white px-3 text-xs outline-none focus:border-[var(--qf-accent)]"
                >
                  <option value="">{labels.everyUser}</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>{user.first_name} {user.last_name}</option>
                  ))}
                </select>
              </label>
            ) : null}
            {hasFilters ? (
              <button
                type="button"
                onClick={clearFilters}
                className="h-10 cursor-pointer rounded-lg px-3 text-xs font-semibold text-[var(--qf-text-muted)] hover:bg-white hover:text-[var(--qf-accent)]"
              >
                {labels.clear}
              </button>
            ) : null}
          </div>

          <div className="overflow-hidden rounded-[var(--qf-radius)] border border-[var(--qf-border)] bg-white shadow-[var(--qf-shadow)]">
            {loading ? (
              <BrandLoader label={request.loading} />
            ) : error ? (
              <p role="alert" className="m-5 rounded-md bg-red-50 p-3 text-xs text-red-700">{error}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[820px] border-collapse text-left">
                  <thead className="bg-[var(--qf-bg)] text-[10.5px] uppercase tracking-wide text-[var(--qf-text-muted)]">
                    <tr>
                      <th className="px-4 py-3 font-bold">{labels.columns.dateTime}</th>
                      <th className="px-4 py-3 font-bold">{labels.columns.type}</th>
                      <th className="px-4 py-3 font-bold">{labels.columns.title}</th>
                      <th className="px-4 py-3 font-bold">{labels.columns.performedBy}</th>
                      <th className="px-4 py-3 font-bold">{labels.columns.result}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--qf-border)]">
                    {logs.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-10 text-center text-sm text-[var(--qf-text-muted)]">{labels.empty}</td>
                      </tr>
                    ) : logs.map((log) => (
                      <tr key={log.id} className="transition hover:bg-[var(--qf-bg)]">
                        <td className="whitespace-nowrap px-4 py-3 text-xs">{formatHotelDateTime(new Date(log.created_at), locale, readHotelTimeZone())}</td>
                        <td className="px-4 py-3">
                          <span className="inline-flex rounded-md bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-700">{labels.modules[log.module] ?? log.module}</span>
                        </td>
                        <td className="max-w-xl px-4 py-3 text-[13px] font-medium">{titleFor(log)}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-xs">{log.actor_name}</td>
                        <td className="px-4 py-3">
                          <span className={"inline-flex rounded-md px-2.5 py-1 text-[11px] font-semibold " + resultClass(log.action)}>
                            {labels.actions[log.action as keyof typeof labels.actions] ?? log.action}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      </main>
    </AppShell>
  );
}
