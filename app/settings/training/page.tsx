"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "../../../components/dashboard/app-shell";
import { useI18n } from "../../../components/i18n/i18n-provider";
import { FileDropZone } from "../../../components/settings/file-drop-zone";
import { getKnowledgeMessages } from "../../../lib/i18n/knowledge-messages";

type TrainingFile = { id: string; name: string; size?: number };
const initialFiles: TrainingFile[] = [{ id: "tone", name: "Tonfall-Beispiele Rezension-Antworten.pdf" }, { id: "jobs", name: "Stellenausschreibung-Vorlagen.pdf" }];
export default function TrainingPage() {
  const router = useRouter(); const { locale } = useI18n(); const t = getKnowledgeMessages(locale); const [files, setFiles] = useState(initialFiles); const [notice, setNotice] = useState("");
  function addFiles(selected: File[]) { const valid = selected.filter(file => { if (file.size > 20 * 1024 * 1024) { setNotice(t.fileTooLarge); return false; } if (!/\.(pdf|docx|txt)$/i.test(file.name)) { setNotice(t.invalidType); return false; } return true; }); if (!valid.length) return; setFiles(items => [...items, ...valid.map((file, index) => ({ id: `${file.name}-${file.lastModified}-${index}`, name: file.name, size: file.size }))]); setNotice(t.uploadReady); }
  return <AppShell activeItem="settings" pageTitle={t.trainingTitle}><main className="p-4 sm:p-5 lg:px-7 lg:py-6">
    <button type="button" onClick={() => router.push("/settings")} className="mb-4 cursor-pointer text-[12.5px] font-semibold text-[var(--qf-text-muted)] hover:text-[var(--qf-accent)]">← {t.settings}</button><p className="mb-5 max-w-4xl text-xs leading-[1.6] text-[var(--qf-text-muted)]">{t.trainingIntro}</p>
    <section className="rounded-[var(--qf-radius)] border border-[var(--qf-border)] bg-white p-4 shadow-[var(--qf-shadow)] sm:p-5"><FileDropZone label={t.uploadTraining} messages={t} onFiles={addFiles} />{notice ? <p role="status" className={`mt-3 rounded-md px-3 py-2 text-[11.5px] ${notice === t.uploadReady ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>{notice}</p> : null}
      <div className="mt-4">{files.length ? files.map(file => <div key={file.id} className="flex items-center gap-3 border-b border-[var(--qf-border)] py-3 last:border-0"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--qf-background)]">📎</span><span className="min-w-0 flex-1"><span className="block truncate text-[12.5px] font-semibold">{file.name}</span>{file.size ? <span className="mt-0.5 block text-[10.5px] text-[var(--qf-text-light)]">{(file.size / 1024).toFixed(1)} KB</span> : null}</span><button type="button" onClick={() => { if (window.confirm(t.removeConfirm)) setFiles(items => items.filter(item => item.id !== file.id)); }} aria-label={`${t.remove}: ${file.name}`} title={t.remove} className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-md text-sm text-[var(--qf-text-light)] transition hover:bg-red-50 hover:text-red-600">🗑️</button></div>) : <p className="py-8 text-center text-xs text-[var(--qf-text-light)]">{t.emptyTraining}</p>}</div>
    </section><p className="mt-3 text-[10.5px] text-[var(--qf-text-light)]">ⓘ {t.previewNote}</p>
  </main></AppShell>;
}
