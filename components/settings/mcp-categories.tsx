"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { mcpPortalMessages } from "../../lib/i18n/dictionaries";
import { useI18n } from "../i18n/i18n-provider";
import { BrandLoader } from "../ui/brand-loader";
import { Button } from "../ui/button";
import { useToast } from "../ui/toast-provider";

type Category = { id: string; name: string };

export function McpCategories() {
  const { locale } = useI18n();
  const text = mcpPortalMessages[locale];
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [canCreate, setCanCreate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState("");
  const [nameError, setNameError] = useState("");
  const [creating, setCreating] = useState(false);

  async function load() {
    try {
      const response = await fetch("/api/settings/mcp-portal/categories", { cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "LOAD_FAILED");
      setCategories(Array.isArray(data.categories) ? data.categories : []);
      setCanCreate(data.canCreate === true);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "LOAD_FAILED");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/settings/mcp-portal/categories", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "LOAD_FAILED");
        setCategories(Array.isArray(data.categories) ? data.categories : []);
        setCanCreate(data.canCreate === true);
      })
      .catch((error) => {
        if (!controller.signal.aborted) setLoadError(error instanceof Error ? error.message : "LOAD_FAILED");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!dialogOpen) return;
    inputRef.current?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !creating) setDialogOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [dialogOpen, creating]);

  function openDialog() {
    setName("");
    setNameError("");
    setDialogOpen(true);
  }

  function closeDialog() {
    if (!creating) setDialogOpen(false);
  }

  async function createCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = name.trim();
    if (!normalized) {
      setNameError(text.categoryNameRequired);
      inputRef.current?.focus();
      return;
    }

    setCreating(true);
    setNameError("");
    try {
      const response = await fetch("/api/settings/mcp-portal/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: normalized }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (data.error === "CATEGORY_NAME_REQUIRED") setNameError(text.categoryNameRequired);
        else toast({ message: typeof data.message === "string" ? data.message : text.categoryCreateFailed, tone: "error" });
        return;
      }
      setDialogOpen(false);
      setName("");
      toast({ message: text.categoryCreated, tone: "success" });
      await load();
    } catch {
      toast({ message: text.categoryCreateFailed, tone: "error" });
    } finally {
      setCreating(false);
    }
  }

  if (loading && !categories.length) return <BrandLoader label={text.loadingCategories} />;
  if (loadError) {
    return (
      <section className="rounded-[var(--qf-radius)] border border-red-200 bg-white p-6 shadow-[var(--qf-shadow)]">
        <p role="alert" className="text-sm font-semibold text-red-700">
          {loadError === "MCP_USER_NOT_SYNCED" ? text.mcpNotReady : text.categoriesLoadFailed}
        </p>
        <Button className="mt-4" variant="secondary" onClick={() => { setLoading(true); setLoadError(""); void load(); }}>{text.retry}</Button>
      </section>
    );
  }

  return (
    <>
      <section>
        <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold text-[var(--qf-text)]">{text.promptCategories}</h1>
            <p className="mt-1 text-xs text-[var(--qf-text-muted)]">{text.categoryNameHint}</p>
          </div>
          {canCreate ? <Button onClick={openDialog}>{text.createCategory}<span aria-hidden className="ml-2 text-base">+</span></Button> : null}
        </header>

        {categories.length ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {categories.map((category) => (
              <article key={category.id} className="flex min-h-28 items-center gap-3 rounded-[var(--qf-radius)] border border-[var(--qf-border)] bg-white p-5 shadow-[var(--qf-shadow)] transition hover:-translate-y-0.5 hover:border-[var(--qf-accent)]">
                <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--qf-accent-soft)] text-lg">🏷️</span>
                <h2 className="min-w-0 break-words text-sm font-bold text-[var(--qf-text)]">{category.name}</h2>
              </article>
            ))}
          </div>
        ) : (
          <div className="rounded-[var(--qf-radius)] border border-dashed border-[var(--qf-border)] bg-white px-6 py-14 text-center shadow-[var(--qf-shadow)]">
            <div aria-hidden className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-[var(--qf-accent-soft)] text-2xl">🏷️</div>
            <p className="mt-4 text-sm font-semibold text-[var(--qf-text-muted)]">{text.noCategories}</p>
          </div>
        )}
      </section>

      {dialogOpen ? (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/45 p-4" onMouseDown={(event) => event.target === event.currentTarget && closeDialog()}>
          <div role="dialog" aria-modal="true" aria-labelledby="create-category-title" className="w-full max-w-[480px] overflow-hidden rounded-xl bg-white shadow-2xl">
            <header className="flex items-center justify-between border-b border-[var(--qf-border)] px-5 py-4">
              <h2 id="create-category-title" className="text-[15px] font-bold text-[var(--qf-text)]">{text.createCategory}</h2>
              <button type="button" aria-label={text.cancel} disabled={creating} onClick={closeDialog} className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-xl text-[var(--qf-text-muted)] hover:bg-[var(--qf-background)] disabled:cursor-not-allowed">×</button>
            </header>
            <form onSubmit={(event) => void createCategory(event)}>
              <div className="p-5">
                <div className="space-y-1.5">
                  <label htmlFor="category-name" className="block text-[13px] font-semibold text-[var(--qf-text)]">
                    {text.categoryName}<span aria-hidden className="text-[var(--qf-danger)]"> *</span>
                  </label>
                  <input
                    ref={inputRef}
                    id="category-name"
                    required
                    aria-invalid={Boolean(nameError)}
                    aria-describedby={nameError ? "category-name-error" : "category-name-hint"}
                    placeholder={text.enterCategoryName}
                    maxLength={120}
                    value={name}
                    disabled={creating}
                    onChange={(event) => { setName(event.target.value); if (nameError) setNameError(""); }}
                    className={`h-11 w-full rounded-lg border bg-white px-3.5 text-sm text-[var(--qf-text)] outline-none transition placeholder:text-[var(--qf-text-light)] ${nameError ? "border-[var(--qf-danger)] focus:ring-3 focus:ring-[#fee2e2]" : "border-[var(--qf-border)] hover:border-[#d8d4cc] focus:border-[var(--qf-accent)] focus:ring-3 focus:ring-[var(--qf-accent-soft)]"}`}
                  />
                  {nameError
                    ? <p id="category-name-error" role="alert" className="text-[11px] font-medium text-[var(--qf-danger)]">{nameError}</p>
                    : <p id="category-name-hint" className="text-[11px] text-[var(--qf-text-muted)]">{text.categoryNameHint}</p>}
                </div>
              </div>
              <footer className="flex justify-end gap-2.5 border-t border-[var(--qf-border)] px-5 py-4">
                <Button type="button" variant="secondary" disabled={creating} onClick={closeDialog}>{text.cancel}</Button>
                <Button type="submit" disabled={creating}>{creating ? text.creatingCategory : text.createCategory}</Button>
              </footer>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
