"use client";

import { useMemo, useState } from "react";
import { AppShell } from "../dashboard/app-shell";
import { useI18n } from "../i18n/i18n-provider";
import { getManualsMessages } from "../../lib/i18n/manuals-messages";
import { knowledgeBaseMeta, previewFiles, type FileStatus, type KnowledgeBaseKey } from "../../lib/knowledge-preview-data";

const CATEGORY_ORDER: KnowledgeBaseKey[] = ["hotel", "reception", "housekeeping", "restaurant", "kitchen", "administration", "marketing"];

type Doc = { id: string; name: string; updated: string; status: FileStatus; storeId: KnowledgeBaseKey; storeName: string; icon: string };

function chipClass(status: FileStatus) {
  return status === "current" ? "chip-g" : status === "review" ? "chip-a" : "chip-r";
}

export function ManualsPage() {
  const { locale } = useI18n();
  const t = getManualsMessages(locale);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<"all" | KnowledgeBaseKey>("all");
  const [extra, setExtra] = useState<Record<string, { id: string; name: string; updated: string; status: FileStatus }[]>>({});

  const stores = CATEGORY_ORDER.map((id) => ({
    id,
    name: t.categories[id],
    icon: knowledgeBaseMeta[id].icon,
    docs: [...previewFiles(id), ...(extra[id] ?? [])],
  }));

  const docs = useMemo(() => {
    const rows: Doc[] = [];
    for (const store of stores) {
      if (category !== "all" && category !== store.id) continue;
      for (const doc of store.docs) rows.push({ ...doc, storeId: store.id, storeName: store.name, icon: store.icon });
    }
    const text = query.trim().toLowerCase();
    if (!text) return rows;
    return rows.filter((doc) => `${doc.name} ${doc.storeName}`.toLowerCase().includes(text));
  }, [category, extra, query, stores]);

  const statusLabel = { current: t.current, review: t.review, outdated: t.outdated };

  function upload() {
    const labels = CATEGORY_ORDER.map((id) => t.categories[id]).join(", ");
    const target = window.prompt(labels, t.categories.hotel);
    if (!target) return;
    const key = CATEGORY_ORDER.find((id) => t.categories[id].toLowerCase() === target.trim().toLowerCase());
    if (!key) return;
    const name = window.prompt("Neues-Dokument.pdf", "Neues-Dokument.pdf");
    if (!name) return;
    const updated = new Date().toLocaleDateString(locale === "de" ? "de-DE" : locale === "it" ? "it-IT" : "en-GB");
    setExtra((current) => ({ ...current, [key]: [...(current[key] ?? []), { id: `${key}-${Date.now()}`, name, updated, status: "current" }] }));
  }

  return <AppShell activeItem="manuals" pageTitle={t.pageTitle}>
    <main className="qf-dashboard pb-24 lg:pb-[24px]">
      <div className="hb-intro">📚 {t.intro}</div>
      <div className="hb-toolbar">
        <input className="hb-search" placeholder={t.search} value={query} onChange={(event) => setQuery(event.target.value)} />
        <button type="button" className="btn btn-primary" onClick={upload}>{t.upload}</button>
      </div>
      <div className="hb-cat">
        <div className={`hb-cat-btn${category === "all" ? " active" : ""}`} onClick={() => setCategory("all")}>📚 {t.filterAll}</div>
        {stores.map((store) => <div key={store.id} className={`hb-cat-btn${category === store.id ? " active" : ""}`} onClick={() => setCategory(store.id)}>{store.icon} {store.name}</div>)}
      </div>
      <div>
        {docs.length ? docs.map((doc) => <div key={`${doc.storeId}-${doc.id}`} className="hb-item" onClick={() => window.alert(t.previewBody)}>
          <div className="hb-ic">{doc.icon}</div>
          <div>
            <div className="hb-t">{doc.name.replace(/\.pdf$/i, "")}</div>
            <div className="hb-m">{doc.storeName} · {t.updated}: {doc.updated}</div>
          </div>
          <span className={`chip ${chipClass(doc.status)}`} style={{ marginLeft: "auto" }}>{statusLabel[doc.status]}</span>
        </div>) : <div style={{ fontSize: 12.5, color: "var(--text3)", padding: 12 }}>{t.empty}</div>}
      </div>
    </main>
  </AppShell>;
}
