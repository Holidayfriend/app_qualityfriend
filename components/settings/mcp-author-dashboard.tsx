"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { DashboardFeedback, DashboardPrompt, DashboardStats, DashboardTrainingStatus } from "../../lib/mcp/dashboard-data";
import { mcpPortalMessages } from "../../lib/i18n/dictionaries";
import { useI18n } from "../i18n/i18n-provider";
import { BrandLoader } from "../ui/brand-loader";
import { Button } from "../ui/button";
import { ConfirmDialog } from "../ui/confirm-dialog";
import { useToast } from "../ui/toast-provider";

type Category = { id: string; name: string };
type DashboardData = {
  prompts: DashboardPrompt[];
  feedbacks: DashboardFeedback[];
  stats: DashboardStats;
  training: DashboardTrainingStatus;
  categories: Category[];
  canManage: boolean;
};
type Tab = "prompts" | "feedbacks" | "training";
type ScoreRange = "0-20" | "21-40" | "41-60" | "61-80" | "81-100";

const emptyTraining: DashboardTrainingStatus = { available: false, trainingExamples: { total: 0, pending: 0, uploading: 0, uploaded: 0, failed: 0 }, vectorStore: null, latestJob: null, activeModel: "" };
const emptyData: DashboardData = { prompts: [], feedbacks: [], stats: { totalPrompts: 0, uniqueAuthors: 0, totalFeedbackCount: 0, averageFeedbackScore: 0 }, training: emptyTraining, categories: [], canManage: false };

async function fetchDashboard(signal?: AbortSignal) {
  const response = await fetch("/api/settings/mcp-portal/dashboard", { cache: "no-store", signal });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof result.error === "string" ? result.error : "LOAD_FAILED");
  return result as DashboardData;
}

export function McpAuthorDashboard() {
  const { locale } = useI18n();
  const text = mcpPortalMessages[locale];
  const toast = useToast();
  const [data, setData] = useState<DashboardData>(emptyData);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [tab, setTab] = useState<Tab>("prompts");
  const [search, setSearch] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [promptCategories, setPromptCategories] = useState<string[]>([]);
  const [promptDate, setPromptDate] = useState("");
  const [scoreRanges, setScoreRanges] = useState<ScoreRange[]>([]);
  const [feedbackTypes, setFeedbackTypes] = useState<Array<"like" | "dislike" | "none">>([]);
  const [feedbackDate, setFeedbackDate] = useState("");
  const [pendingDelete, setPendingDelete] = useState<DashboardPrompt | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetchDashboard(controller.signal)
      .then(setData)
      .catch((error) => { if (!controller.signal.aborted) setLoadError(error instanceof Error ? error.message : "LOAD_FAILED"); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, []);

  const visiblePrompts = useMemo(() => data.prompts.filter((prompt) => {
    const term = search.trim().toLowerCase();
    const searchMatch = !term || `${prompt.title} ${prompt.categoryName} ${prompt.authorEmail}`.toLowerCase().includes(term);
    const categoryMatch = !promptCategories.length || promptCategories.includes(prompt.categoryId);
    return searchMatch && categoryMatch && afterDate(prompt.createdAt, promptDate);
  }), [data.prompts, promptCategories, promptDate, search]);

  const visibleFeedbacks = useMemo(() => data.feedbacks.filter((feedback) => {
    const term = search.trim().toLowerCase();
    const searchMatch = !term || `${feedback.promptTitle} ${feedback.userEmail} ${feedback.reaction} ${feedback.feedbackScore}`.toLowerCase().includes(term);
    const rangeMatch = !scoreRanges.length || scoreRanges.some((range) => inScoreRange(feedback.feedbackScore, range));
    const typeMatch = !feedbackTypes.length || feedbackTypes.includes(feedback.reaction);
    return searchMatch && rangeMatch && typeMatch && afterDate(feedback.createdAt, feedbackDate);
  }), [data.feedbacks, feedbackDate, feedbackTypes, scoreRanges, search]);

  async function reload() {
    setLoading(true);
    setLoadError("");
    try { setData(await fetchDashboard()); }
    catch (error) { setLoadError(error instanceof Error ? error.message : "LOAD_FAILED"); }
    finally { setLoading(false); }
  }

  function changeTab(next: Tab) {
    setTab(next);
    setSearch("");
    setFiltersOpen(false);
  }

  async function removePrompt() {
    if (!pendingDelete) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/settings/mcp-portal/prompts/${encodeURIComponent(pendingDelete.id)}`, { method: "DELETE" });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof result.message === "string" ? result.message : text.dashboardDeleteFailed);
      setData((current) => ({ ...current, prompts: current.prompts.filter((prompt) => prompt.id !== pendingDelete.id) }));
      setPendingDelete(null);
      toast({ message: text.dashboardPromptDeleted, tone: "success" });
      await reload();
    } catch (error) { toast({ message: error instanceof Error ? error.message : text.dashboardDeleteFailed, tone: "error" }); }
    finally { setBusy(false); }
  }

  async function trainingAction(action: "training-sync" | "training-reset") {
    setBusy(true);
    try {
      const response = await fetch("/api/settings/mcp-portal/dashboard", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof result.message === "string" ? result.message : text.trainingActionFailed);
      setConfirmReset(false);
      toast({ message: action === "training-sync" ? text.trainingSyncSuccess : text.trainingResetSuccess, tone: "success" });
      await reload();
    } catch (error) { toast({ message: error instanceof Error ? error.message : text.trainingActionFailed, tone: "error" }); }
    finally { setBusy(false); }
  }

  async function exportData() {
    setBusy(true);
    try {
      const response = await fetch("/api/settings/mcp-portal/dashboard/export", { cache: "no-store" });
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(typeof result.error === "string" ? result.error : text.dashboardExportFailed);
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `prompts_export_${new Date().toISOString().slice(0, 10)}.jsonl`;
      anchor.click();
      URL.revokeObjectURL(url);
      toast({ message: text.dashboardExported, tone: "success" });
    } catch (error) { toast({ message: error instanceof Error ? error.message : text.dashboardExportFailed, tone: "error" }); }
    finally { setBusy(false); }
  }

  if (loading && !data.prompts.length && !data.feedbacks.length && !loadError) return <BrandLoader label={text.dashboardLoading} />;
  if (loadError) return <section className="rounded-[var(--qf-radius)] border border-red-200 bg-white p-6 shadow-[var(--qf-shadow)]"><p className="text-sm font-semibold text-red-700">{loadError === "MCP_USER_NOT_SYNCED" ? text.mcpNotReady : text.dashboardLoadFailed}</p><Button variant="secondary" className="mt-4" onClick={() => void reload()}>{text.retry}</Button></section>;

  const statCards = [
    [text.totalPromptsAuthored, formatNumber(data.stats.totalPrompts), "📄"],
    [text.dashboardAuthors, formatNumber(data.stats.uniqueAuthors), "👤"],
    [text.totalFeedbacks, formatNumber(data.stats.totalFeedbackCount), "👍"],
    [text.averageFeedbackScore, formatScore(data.stats.averageFeedbackScore), "⭐"],
  ];

  return (
    <>
      {loading || busy ? <BrandLoader label={busy ? text.dashboardWorking : text.dashboardLoading} overlay /> : null}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {statCards.map(([label, value, icon]) => <article key={label} className="flex items-center justify-between rounded-[var(--qf-radius)] border border-[var(--qf-border)] bg-white p-5 shadow-[var(--qf-shadow)]"><div><p className="text-xs font-semibold text-[var(--qf-text-muted)]">{label}</p><p className="mt-2 text-2xl font-bold text-[var(--qf-text)]">{value}</p></div><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--qf-accent-soft)] text-xl" aria-hidden>{icon}</span></article>)}
      </section>

      <section className="mt-5 rounded-[var(--qf-radius)] border border-[var(--qf-border)] bg-white p-4 shadow-[var(--qf-shadow)] sm:p-5">
        <header className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex max-w-full overflow-x-auto rounded-lg border border-[var(--qf-border)]">
            <TabButton active={tab === "prompts"} onClick={() => changeTab("prompts")}>{text.dashboardPrompts}</TabButton>
            <TabButton active={tab === "feedbacks"} onClick={() => changeTab("feedbacks")}>{text.dashboardFeedbacks}</TabButton>
            <TabButton active={tab === "training"} onClick={() => changeTab("training")}>{text.dashboardTraining}</TabButton>
            {data.canManage ? <TabButton active={false} onClick={() => void exportData()}>{text.exportTrainingData}</TabButton> : null}
          </div>
          <div className="flex min-w-0 gap-2">
            {tab !== "training" ? <Button variant="secondary" aria-expanded={filtersOpen} onClick={() => setFiltersOpen((open) => !open)}>⚙ {text.filter}</Button> : null}
            <input value={search} disabled={tab === "training"} onChange={(event) => setSearch(event.target.value)} placeholder={text.dashboardSearch} className="h-11 min-w-0 flex-1 rounded-lg border border-[var(--qf-border)] px-4 text-sm outline-none focus:border-[var(--qf-accent)] xl:w-64" />
          </div>
        </header>

        {filtersOpen && tab === "prompts" ? <PromptFilters categories={data.categories} selected={promptCategories} date={promptDate} text={text} toggle={(id) => setPromptCategories((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id])} setDate={setPromptDate} clear={() => { setPromptCategories([]); setPromptDate(""); }} /> : null}
        {filtersOpen && tab === "feedbacks" ? <FeedbackFilters ranges={scoreRanges} types={feedbackTypes} date={feedbackDate} text={text} toggleRange={(range) => setScoreRanges((current) => current.includes(range) ? current.filter((value) => value !== range) : [...current, range])} toggleType={(type) => setFeedbackTypes((current) => current.includes(type) ? current.filter((value) => value !== type) : [...current, type])} setDate={setFeedbackDate} clear={() => { setScoreRanges([]); setFeedbackTypes([]); setFeedbackDate(""); }} /> : null}

        <div className="mt-5">
          {tab === "prompts" ? <PromptsTable prompts={visiblePrompts} canManage={data.canManage} locale={locale} text={text} onDelete={setPendingDelete} /> : null}
          {tab === "feedbacks" ? <FeedbacksTable feedbacks={visibleFeedbacks} locale={locale} text={text} /> : null}
          {tab === "training" ? <TrainingPanel training={data.training} canManage={data.canManage} locale={locale} text={text} onSync={() => void trainingAction("training-sync")} onReset={() => setConfirmReset(true)} /> : null}
        </div>
      </section>

      {pendingDelete ? <ConfirmDialog open title={text.deletePromptTitle} message={text.deletePromptConfirm.replace("{title}", pendingDelete.title)} confirmLabel={text.deletePromptAction} cancelLabel={text.cancel} pending={busy} onConfirm={() => void removePrompt()} onCancel={() => { if (!busy) setPendingDelete(null); }} /> : null}
      {confirmReset ? <ConfirmDialog open title={text.resetTrainingTitle} message={text.resetTrainingConfirm} confirmLabel={text.resetTrainingAction} cancelLabel={text.cancel} pending={busy} onConfirm={() => void trainingAction("training-reset")} onCancel={() => { if (!busy) setConfirmReset(false); }} /> : null}
    </>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" onClick={onClick} className={`min-h-10 shrink-0 cursor-pointer border-r border-[var(--qf-border)] px-4 text-xs font-bold transition last:border-r-0 ${active ? "bg-[var(--qf-accent)] text-white" : "bg-white text-[var(--qf-text)] hover:bg-[var(--qf-background)]"}`}>{children}</button>;
}

function PromptsTable({ prompts, canManage, locale, text, onDelete }: { prompts: DashboardPrompt[]; canManage: boolean; locale: string; text: typeof mcpPortalMessages.en; onDelete: (prompt: DashboardPrompt) => void }) {
  if (!prompts.length) return <Empty message={text.noDashboardPrompts} />;
  return <div className="overflow-x-auto"><table className="w-full min-w-[720px] border-collapse text-left text-sm"><thead className="bg-[var(--qf-accent-soft)]"><tr><Th>{text.promptTitle}</Th><Th>{text.category}</Th><Th>{text.createdOn}</Th><Th>{text.totalFeedback}</Th><Th>{text.dashboardActions}</Th></tr></thead><tbody>{prompts.map((prompt) => <tr key={prompt.id} className="border-b border-[var(--qf-border)] last:border-0 hover:bg-[var(--qf-background)]"><Td><Link href={`/settings/mcp-portal/prompt-library/${encodeURIComponent(prompt.id)}`} className="font-semibold hover:text-[var(--qf-accent)]">{prompt.title}</Link></Td><Td>{prompt.categoryName || text.uncategorized}</Td><Td>{formatDate(prompt.createdAt, locale, text.notAvailable)}</Td><Td>{prompt.feedbackCount}</Td><Td>{canManage ? <div className="flex gap-2"><Link title={text.editPrompt} href={`/settings/mcp-portal/prompt-library?edit=${encodeURIComponent(prompt.id)}`} className="flex h-8 w-8 items-center justify-center rounded-md border border-[var(--qf-border)] hover:border-[var(--qf-accent)] hover:text-[var(--qf-accent)]">✎</Link><button type="button" title={text.deletePromptAction} onClick={() => onDelete(prompt)} className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-md border border-red-200 text-red-600 hover:bg-red-50">🗑</button></div> : text.notAvailable}</Td></tr>)}</tbody></table></div>;
}

function FeedbacksTable({ feedbacks, locale, text }: { feedbacks: DashboardFeedback[]; locale: string; text: typeof mcpPortalMessages.en }) {
  if (!feedbacks.length) return <Empty message={text.noDashboardFeedbacks} />;
  return <div className="overflow-x-auto"><table className="w-full min-w-[700px] border-collapse text-left text-sm"><thead className="bg-[var(--qf-accent-soft)]"><tr><Th>{text.promptTitle}</Th><Th>{text.feedbackType}</Th><Th>{text.dashboardUser}</Th><Th>{text.dashboardDate}</Th><Th>{text.feedbackScore}</Th></tr></thead><tbody>{feedbacks.map((feedback) => <tr key={feedback.id} className="border-b border-[var(--qf-border)] last:border-0 hover:bg-[var(--qf-background)]"><Td>{feedback.promptTitle || text.notAvailable}</Td><Td><span title={feedback.reaction === "like" ? text.positive : feedback.reaction === "dislike" ? text.negative : text.neutral}>{feedback.reaction === "like" ? "👍" : feedback.reaction === "dislike" ? "👎" : "➖"}</span></Td><Td>{feedback.userEmail || text.notAvailable}</Td><Td>{formatDate(feedback.createdAt, locale, text.notAvailable)}</Td><Td>{feedback.feedbackScore}%</Td></tr>)}</tbody></table></div>;
}

function TrainingPanel({ training, canManage, locale, text, onSync, onReset }: { training: DashboardTrainingStatus; canManage: boolean; locale: string; text: typeof mcpPortalMessages.en; onSync: () => void; onReset: () => void }) {
  if (!training.available) return <Empty message={text.trainingStatusUnavailable} />;
  const examples = [[text.total, training.trainingExamples.total], [text.pending, training.trainingExamples.pending], [text.uploading, training.trainingExamples.uploading], [text.uploaded, training.trainingExamples.uploaded], [text.failed, training.trainingExamples.failed]] as const;
  return <div className="space-y-4"><div className="rounded-lg border border-[var(--qf-border)] p-5"><h2 className="font-bold">☷ {text.dashboardTraining}</h2><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">{examples.map(([label, value]) => <div key={label} className="rounded-lg bg-[var(--qf-background)] p-4 text-center"><p className="text-xs text-[var(--qf-text-muted)]">{label}</p><p className="mt-2 text-xl font-bold">{value}</p></div>)}</div></div>{training.vectorStore ? <InfoCard title={`▣ ${text.vectorStore}`} rows={[[text.dashboardName, training.vectorStore.name], [text.departmentName, training.vectorStore.departmentName]]} fallback={text.notAvailable} /> : <Empty message={text.noVectorStore} compact />}{training.latestJob ? <InfoCard title={`✓ ${text.latestJob}`} rows={[[text.provider, training.latestJob.provider], [text.dashboardStatus, training.latestJob.status], [text.datasetFileId, training.latestJob.datasetFileId], [text.openaiJobId, training.latestJob.openaiJobId], [text.resultingModel, training.latestJob.resultingModel], [text.dashboardError, training.latestJob.error], [text.startedAt, formatDateTime(training.latestJob.startedAt, locale, text.notAvailable)], [text.completedAt, formatDateTime(training.latestJob.completedAt, locale, text.notAvailable)], [text.createdAt, formatDateTime(training.latestJob.createdAt, locale, text.notAvailable)], [text.updatedAt, formatDateTime(training.latestJob.updatedAt, locale, text.notAvailable)]]} fallback={text.notAvailable} /> : <Empty message={text.noLatestJob} compact />}{training.activeModel ? <InfoCard title={`✦ ${text.activeModel}`} rows={[[text.modelId, training.activeModel]]} fallback={text.notAvailable} /> : <Empty message={text.noActiveModel} compact />}{canManage ? <div className="flex flex-wrap gap-3 rounded-lg border border-[var(--qf-border)] p-5"><Button onClick={onSync}>{text.trainingSync}</Button><Button variant="danger" onClick={onReset}>{text.resetTrainingState}</Button></div> : null}</div>;
}

function PromptFilters({ categories, selected, date, text, toggle, setDate, clear }: { categories: Category[]; selected: string[]; date: string; text: typeof mcpPortalMessages.en; toggle: (id: string) => void; setDate: (value: string) => void; clear: () => void }) {
  return <div className="mt-4 rounded-lg border border-[var(--qf-border)] bg-[var(--qf-background)] p-4"><div className="flex items-center justify-between"><h2 className="text-sm font-bold">{text.filterPrompts}</h2><button type="button" onClick={clear} className="cursor-pointer text-xs font-semibold text-[var(--qf-accent)]">{text.clearFilters}</button></div><div className="mt-3 grid gap-4 md:grid-cols-[1fr_220px]"><div><p className="mb-2 text-xs font-semibold">{text.categories}</p><div className="flex flex-wrap gap-2">{categories.map((category) => <CheckPill key={category.id} checked={selected.includes(category.id)} onChange={() => toggle(category.id)} label={category.name} />)}{!categories.length ? <span className="text-xs text-[var(--qf-text-muted)]">{text.noCategories}</span> : null}</div></div><DateFilter label={text.dateCreated} value={date} onChange={setDate} /></div></div>;
}

function FeedbackFilters({ ranges, types, date, text, toggleRange, toggleType, setDate, clear }: { ranges: ScoreRange[]; types: Array<"like" | "dislike" | "none">; date: string; text: typeof mcpPortalMessages.en; toggleRange: (range: ScoreRange) => void; toggleType: (type: "like" | "dislike" | "none") => void; setDate: (value: string) => void; clear: () => void }) {
  const allRanges: ScoreRange[] = ["0-20", "21-40", "41-60", "61-80", "81-100"];
  return <div className="mt-4 rounded-lg border border-[var(--qf-border)] bg-[var(--qf-background)] p-4"><div className="flex items-center justify-between"><h2 className="text-sm font-bold">{text.filterFeedbacks}</h2><button type="button" onClick={clear} className="cursor-pointer text-xs font-semibold text-[var(--qf-accent)]">{text.clearFilters}</button></div><div className="mt-3 grid gap-4 lg:grid-cols-[1fr_1fr_220px]"><div><p className="mb-2 text-xs font-semibold">{text.scorePercentage}</p><div className="flex flex-wrap gap-2">{allRanges.map((range) => <CheckPill key={range} checked={ranges.includes(range)} onChange={() => toggleRange(range)} label={`${range}%`} />)}</div></div><div><p className="mb-2 text-xs font-semibold">{text.feedbackType}</p><div className="flex flex-wrap gap-2"><CheckPill checked={types.includes("like")} onChange={() => toggleType("like")} label={`👍 ${text.positive}`} /><CheckPill checked={types.includes("dislike")} onChange={() => toggleType("dislike")} label={`👎 ${text.negative}`} /><CheckPill checked={types.includes("none")} onChange={() => toggleType("none")} label={`➖ ${text.neutral}`} /></div></div><DateFilter label={text.dateReceived} value={date} onChange={setDate} /></div></div>;
}

function CheckPill({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) { return <label className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold ${checked ? "border-[var(--qf-accent)] bg-[var(--qf-accent-soft)] text-[var(--qf-accent)]" : "border-[var(--qf-border)] bg-white"}`}><input type="checkbox" checked={checked} onChange={onChange} className="accent-[var(--qf-accent)]" />{label}</label>; }
function DateFilter({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <label className="block"><span className="mb-2 block text-xs font-semibold">{label}</span><input type="date" value={value} onChange={(event) => onChange(event.target.value)} className="h-10 w-full rounded-lg border border-[var(--qf-border)] bg-white px-3 text-sm outline-none focus:border-[var(--qf-accent)]" /></label>; }
function InfoCard({ title, rows, fallback }: { title: string; rows: Array<[string, string]>; fallback: string }) { return <div className="rounded-lg border border-[var(--qf-border)] p-5"><h2 className="font-bold">{title}</h2><dl className="mt-3">{rows.map(([label, value]) => <div key={label} className="flex flex-col justify-between gap-1 border-b border-[var(--qf-border)] py-2.5 text-sm last:border-0 sm:flex-row"><dt className="font-semibold text-[var(--qf-text-muted)]">{label}</dt><dd className="break-all sm:text-right">{value || fallback}</dd></div>)}</dl></div>; }
function Empty({ message, compact = false }: { message: string; compact?: boolean }) { return <div className={`rounded-lg border border-dashed border-[var(--qf-border)] text-center text-sm text-[var(--qf-text-muted)] ${compact ? "px-5 py-7" : "px-6 py-12"}`}>{message}</div>; }
function Th({ children }: { children: React.ReactNode }) { return <th className="px-4 py-3 text-xs font-bold text-[var(--qf-text)]">{children}</th>; }
function Td({ children }: { children: React.ReactNode }) { return <td className="px-4 py-3 text-sm text-[var(--qf-text)]">{children}</td>; }
function inScoreRange(score: number, range: ScoreRange) { const [min, max] = range.split("-").map(Number); return score >= min && score <= max; }
function afterDate(value: string, minimum: string) { if (!minimum) return true; const date = new Date(value); const threshold = new Date(`${minimum}T00:00:00`); return !Number.isNaN(date.getTime()) && date >= threshold; }
function formatDate(value: string, locale: string, fallback: string) { const date = new Date(value); return value && !Number.isNaN(date.getTime()) ? new Intl.DateTimeFormat(locale, { year: "numeric", month: "short", day: "numeric" }).format(date) : fallback; }
function formatDateTime(value: string, locale: string, fallback: string) { const date = new Date(value); return value && !Number.isNaN(date.getTime()) ? new Intl.DateTimeFormat(locale, { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(date) : fallback; }
function formatNumber(value: number) { return new Intl.NumberFormat().format(value); }
function formatScore(value: number) { return Number.isInteger(value) ? String(value) : value.toFixed(1); }
