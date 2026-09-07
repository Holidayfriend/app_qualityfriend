"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "../../../components/dashboard/app-shell";
import { useI18n } from "../../../components/i18n/i18n-provider";
import { FileDropZone } from "../../../components/settings/file-drop-zone";
import { getKnowledgeMessages } from "../../../lib/i18n/knowledge-messages";

type TrainingFile = { id: string; name: string; size?: number; status?: string };

function normalizeFiles(payload: unknown): TrainingFile[] {
  const object = payload && typeof payload === "object" && !Array.isArray(payload) ? payload as Record<string, unknown> : null;
  const rows = Array.isArray(payload) ? payload : Array.isArray(object?.files) ? object.files : Array.isArray(object?.data) ? object.data : [];
  return rows.flatMap((entry, index) => {
    if (!entry || typeof entry !== "object") return [];
    const row = entry as Record<string, unknown>;
    const name = typeof row.filename === "string" ? row.filename : typeof row.name === "string" ? row.name : "";
    if (!name || (typeof row.purpose === "string" && row.purpose !== "fine-tune")) return [];
    return [{ id: typeof row.id === "string" ? row.id : `${name}-${index}`, name, size: typeof row.bytes === "number" ? row.bytes : typeof row.size === "number" ? row.size : undefined, status: typeof row.status === "string" ? row.status : undefined }];
  });
}

export default function TrainingPage() {
  const router = useRouter(); const { locale } = useI18n(); const t = getKnowledgeMessages(locale);
  const copy = locale === "de" ? { purpose: "Zweck", cancel: "Abbrechen", upload: "Hochladen", uploading: "Wird hochgeladen…", loading: "Trainingsdateien werden geladen…", deleteUnavailable: "Die Lösch-API ist noch nicht verfügbar.", invalid: "Nur JSON- und JSONL-Dateien sind erlaubt.", failed: "Trainingsdateien konnten nicht geladen werden." } : locale === "it" ? { purpose: "Scopo", cancel: "Annulla", upload: "Carica", uploading: "Caricamento…", loading: "Caricamento dei file di addestramento…", deleteUnavailable: "L’API di eliminazione non è ancora disponibile.", invalid: "Sono consentiti solo file JSON e JSONL.", failed: "Impossibile caricare i file di addestramento." } : { purpose: "Purpose", cancel: "Cancel", upload: "Upload", uploading: "Uploading…", loading: "Loading training files…", deleteUnavailable: "The delete API is not available yet.", invalid: "Only JSON and JSONL files are allowed.", failed: "Training files could not be loaded." };
  const [files, setFiles] = useState<TrainingFile[]>([]); const [pending, setPending] = useState<File[]>([]); const [notice, setNotice] = useState(""); const [toast, setToast] = useState(""); const [loading, setLoading] = useState(true); const [uploading, setUploading] = useState(false);
  const load = useCallback(async () => { try { const response = await fetch("/api/settings/training", { cache: "no-store" }); const data = await response.json(); if (!response.ok) throw new Error(data.message || copy.failed); setFiles(normalizeFiles(data)); } catch (error) { setNotice(error instanceof Error ? error.message : copy.failed); } finally { setLoading(false); } }, [copy.failed]);
  useEffect(() => {
    let active = true;
    fetch("/api/settings/training", { cache: "no-store" }).then(async (response) => {
      const data = await response.json(); if (!response.ok) throw new Error(data.message || copy.failed); return data;
    }).then((data) => { if (active) setFiles(normalizeFiles(data)); }).catch((error: unknown) => { if (active) setNotice(error instanceof Error ? error.message : copy.failed); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [copy.failed]);
  useEffect(() => { if (!toast) return; const timer = window.setTimeout(() => setToast(""), 3500); return () => window.clearTimeout(timer); }, [toast]);
  function choose(selected: File[]) { if (selected.some(file => !/\.(json|jsonl)$/i.test(file.name))) { setNotice(copy.invalid); return; } setNotice(""); setPending(selected); }
  async function upload() { setUploading(true); const form = new FormData(); pending.forEach(file => form.append("files", file)); try { const response = await fetch("/api/settings/training", { method: "POST", body: form }); const data = await response.json(); if (!response.ok) throw new Error(data.message || copy.failed); setPending([]); setNotice(t.uploadReady); await load(); } catch (error) { setNotice(error instanceof Error ? error.message : copy.failed); } finally { setUploading(false); } }
  return <AppShell activeItem="settings" pageTitle={t.trainingTitle}><main className="p-4 sm:p-5 lg:px-7 lg:py-6">
    <button type="button" onClick={() => router.push("/settings")} className="mb-4 cursor-pointer text-[12.5px] font-semibold text-[var(--qf-text-muted)] hover:text-[var(--qf-accent)]">← {t.settings}</button><p className="mb-5 max-w-4xl text-xs leading-[1.6] text-[var(--qf-text-muted)]">{t.trainingIntro}</p>
    <section className="rounded-[var(--qf-radius)] border border-[var(--qf-border)] bg-white p-4 shadow-[var(--qf-shadow)] sm:p-5"><FileDropZone label={t.uploadTraining} messages={t} onFiles={choose} fileTypes=".json,.jsonl,application/json,application/jsonl" formats="JSON / JSONL" />
      {notice ? <p role="status" className={`mt-3 rounded-md px-3 py-2 text-[11.5px] ${notice === t.uploadReady ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>{notice}</p> : null}
      <div className="mt-4">{loading ? <p className="py-8 text-center text-xs text-[var(--qf-text-light)]">{copy.loading}</p> : files.length ? files.map(file => <div key={file.id} className="flex items-center gap-3 border-b border-[var(--qf-border)] py-3 last:border-0"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--qf-background)]">📎</span><span className="min-w-0 flex-1"><span className="block truncate text-[12.5px] font-semibold">{file.name}</span><span className="mt-0.5 block text-[10.5px] text-[var(--qf-text-light)]">fine-tune{file.size ? ` · ${(file.size / 1024).toFixed(1)} KB` : ""}{file.status ? ` · ${file.status}` : ""}</span></span><button type="button" onClick={() => setToast(copy.deleteUnavailable)} aria-label={`${t.remove}: ${file.name}`} title={t.remove} className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-md text-sm text-[var(--qf-text-light)] transition hover:bg-red-50 hover:text-red-600">🗑️</button></div>) : <p className="py-8 text-center text-xs text-[var(--qf-text-light)]">{t.emptyTraining}</p>}</div>
    </section>
    {pending.length ? <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true"><div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl"><h2 className="text-sm font-bold">{t.uploadTraining}</h2><p className="mt-2 truncate text-xs text-[var(--qf-text-muted)]">{pending.map(file => file.name).join(", ")}</p><label className="mt-4 block text-xs font-semibold">{copy.purpose}<input value="fine-tune" disabled readOnly className="mt-1.5 h-10 w-full rounded-lg border border-[var(--qf-border)] bg-[var(--qf-background)] px-3 text-xs text-[var(--qf-text-muted)]" /></label><div className="mt-5 flex justify-end gap-2"><button type="button" disabled={uploading} onClick={() => setPending([])} className="h-9 rounded-lg border border-[var(--qf-border)] px-4 text-xs font-semibold">{copy.cancel}</button><button type="button" disabled={uploading} onClick={() => void upload()} className="h-9 rounded-lg bg-[var(--qf-accent)] px-4 text-xs font-semibold text-white disabled:opacity-60">{uploading ? copy.uploading : copy.upload}</button></div></div></div> : null}
    {toast ? <div role="status" className="fixed bottom-5 right-5 z-[60] max-w-sm rounded-lg bg-slate-900 px-4 py-3 text-xs font-medium text-white shadow-xl">{toast}</div> : null}
  </main></AppShell>;
}
