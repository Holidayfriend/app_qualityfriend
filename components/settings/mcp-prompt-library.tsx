"use client";

import { useMemo, useState, useEffect, type FormEvent } from "react";
import Link from "next/link";
import { mcpPortalMessages } from "../../lib/i18n/dictionaries";
import { useI18n } from "../i18n/i18n-provider";
import { BrandLoader } from "../ui/brand-loader";
import { Button } from "../ui/button";
import { useToast } from "../ui/toast-provider";

type Prompt = {
  id: string;
  title: string;
  body: string;
  version: string;
  tags: string[];
  categoryId: string;
  categoryName: string;
  departmentId: string;
  departmentName: string;
  authorEmail: string;
  assignedUserIds: string[];
  assignedUsers: Array<{ id: string; email: string }>;
  createdAt: string;
};
type Option = { id: string; name: string };
type UserOption = { id: string; email: string };
type LibraryData = {
  prompts: Prompt[];
  categories: Option[];
  departments: Option[];
  users: UserOption[];
  currentUserId: string;
  currentDepartmentId: string;
  canManage: boolean;
};
type PromptForm = {
  title: string;
  version: string;
  categoryId: string;
  departmentId: string;
  assignedUserId: string[];
  tags: string;
  body: string;
};

const emptyData: LibraryData = { prompts: [], categories: [], departments: [], users: [], currentUserId: "", currentDepartmentId: "", canManage: false };

async function fetchLibrary(search: string, signal?: AbortSignal) {
  const query = search.trim() ? `?search=${encodeURIComponent(search.trim())}` : "";
  const response = await fetch(`/api/settings/mcp-portal/prompts${query}`, { cache: "no-store", signal });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "LOAD_FAILED");
  return data as LibraryData;
}

function initialForm(data: LibraryData): PromptForm {
  return {
    title: "",
    version: "1.0",
    categoryId: data.categories[0]?.id ?? "",
    departmentId: data.currentDepartmentId || data.departments[0]?.id || "",
    assignedUserId: data.currentUserId ? [data.currentUserId] : [],
    tags: "",
    body: "",
  };
}

function formFromPrompt(prompt: Prompt): PromptForm {
  return {
    title: prompt.title,
    version: prompt.version || "1.0",
    categoryId: prompt.categoryId,
    departmentId: prompt.departmentId,
    assignedUserId: prompt.assignedUserIds,
    tags: prompt.tags.join(", "),
    body: prompt.body,
  };
}

export function McpPromptLibrary() {
  const { locale } = useI18n();
  const text = mcpPortalMessages[locale];
  const toast = useToast();
  const [data, setData] = useState<LibraryData>(emptyData);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [activeSearch, setActiveSearch] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [editor, setEditor] = useState<"create" | "edit" | null>(null);
  const [form, setForm] = useState<PromptForm>(initialForm(emptyData));
  const [editingId, setEditingId] = useState("");
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    fetchLibrary("", controller.signal)
      .then(setData)
      .catch((error) => { if (!controller.signal.aborted) setLoadError(error instanceof Error ? error.message : "LOAD_FAILED"); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, []);

  const visiblePrompts = useMemo(() => data.prompts.filter((prompt) => !selectedCategories.length || selectedCategories.includes(prompt.categoryId)), [data.prompts, selectedCategories]);

  async function reload(search = activeSearch) {
    setLoading(true);
    setLoadError("");
    try { setData(await fetchLibrary(search)); }
    catch (error) { setLoadError(error instanceof Error ? error.message : "LOAD_FAILED"); }
    finally { setLoading(false); }
  }

  async function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = searchInput.trim();
    setActiveSearch(next);
    await reload(next);
  }

  function openCreate() {
    setForm(initialForm(data));
    setEditingId("");
    setFormError("");
    setEditor("create");
  }

  async function loadPrompt(promptId: string) {
    setDetailLoading(true);
    try {
      const response = await fetch(`/api/settings/mcp-portal/prompts/${encodeURIComponent(promptId)}`, { cache: "no-store" });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.prompt) throw new Error();
      const prompt = result.prompt as Prompt;
      setEditingId(prompt.id);
      setForm(formFromPrompt(prompt));
      setFormError("");
      setEditor("edit");
    } catch {
      toast({ message: text.promptLoadFailed, tone: "error" });
    } finally {
      setDetailLoading(false);
    }
  }

  function toggleUser(id: string) {
    setForm((current) => ({
      ...current,
      assignedUserId: current.assignedUserId.includes(id)
        ? current.assignedUserId.filter((value) => value !== id)
        : [...current.assignedUserId, id],
    }));
  }

  async function savePrompt(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.title.trim() || !form.body.trim() || !form.version.trim() || !form.categoryId || !form.departmentId) {
      setFormError(text.promptRequiredFields);
      return;
    }
    if (!form.assignedUserId.length) {
      setFormError(text.promptUserRequired);
      return;
    }
    setSaving(true);
    setFormError("");
    const editing = editor === "edit";
    try {
      const response = await fetch(editing ? `/api/settings/mcp-portal/prompts/${encodeURIComponent(editingId)}` : "/api/settings/mcp-portal/prompts", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          tags: form.tags.split(",").map((tag) => tag.trim()).filter(Boolean),
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof result.message === "string" ? result.message : text.promptSaveFailed);
      setEditor(null);
      toast({ message: editing ? text.promptUpdated : text.promptCreated, tone: "success" });
      await reload();
    } catch (error) {
      toast({ message: error instanceof Error ? error.message : text.promptSaveFailed, tone: "error" });
    } finally {
      setSaving(false);
    }
  }

  if (loading && !data.prompts.length && !loadError) return <BrandLoader label={text.loadingPrompts} />;
  if (loadError) {
    return <section className="rounded-[var(--qf-radius)] border border-red-200 bg-white p-6 shadow-[var(--qf-shadow)]"><p role="alert" className="text-sm font-semibold text-red-700">{loadError === "MCP_USER_NOT_SYNCED" ? text.mcpNotReady : text.promptsLoadFailed}</p><Button className="mt-4" variant="secondary" onClick={() => void reload()}>{text.retry}</Button></section>;
  }

  return (
    <>
      {detailLoading ? <BrandLoader label={text.loadingPrompt} overlay /> : null}
      <section>
        <form onSubmit={(event) => void submitSearch(event)} className="mb-5 flex max-w-2xl gap-2">
          <label className="relative min-w-0 flex-1">
            <span className="sr-only">{text.searchPrompt}</span>
            <input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder={text.searchPrompt} className="h-11 w-full rounded-lg border border-[var(--qf-border)] bg-white px-4 pr-11 text-sm outline-none focus:border-[var(--qf-accent)] focus:ring-3 focus:ring-[var(--qf-accent-soft)]" />
            <button type="submit" aria-label={text.searchPrompt} className="absolute inset-y-0 right-0 flex w-11 cursor-pointer items-center justify-center text-[var(--qf-accent)]">⌕</button>
          </label>
          <Button type="button" variant="secondary" onClick={() => setFilterOpen((open) => !open)}>⚙ {text.filter}</Button>
        </form>

        {filterOpen ? (
          <div className="mb-5 rounded-[var(--qf-radius)] border border-[var(--qf-border)] bg-white p-4 shadow-[var(--qf-shadow)]">
            <div className="flex items-center justify-between gap-3"><h2 className="text-sm font-bold">{text.filterByCategory}</h2><button type="button" className="cursor-pointer text-xs font-semibold text-[var(--qf-accent)]" onClick={() => setSelectedCategories([])}>{text.clearFilters}</button></div>
            <div className="mt-3 flex flex-wrap gap-2">
              {data.categories.length ? data.categories.map((category) => {
                const checked = selectedCategories.includes(category.id);
                return <label key={category.id} className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold ${checked ? "border-[var(--qf-accent)] bg-[var(--qf-accent-soft)] text-[var(--qf-accent)]" : "border-[var(--qf-border)]"}`}><input type="checkbox" checked={checked} onChange={() => setSelectedCategories((current) => checked ? current.filter((id) => id !== category.id) : [...current, category.id])} className="accent-[var(--qf-accent)]" />{category.name}</label>;
              }) : <p className="text-xs text-[var(--qf-text-muted)]">{text.noCategories}</p>}
            </div>
          </div>
        ) : null}

        <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div><h1 className="text-lg font-bold text-[var(--qf-text)]">{text.allPrompts}{activeSearch ? ` — “${activeSearch}”` : ""}</h1><p className="mt-1 text-xs text-[var(--qf-text-muted)]">{visiblePrompts.length} {text.promptsCount}</p></div>
          {data.canManage ? <Button onClick={openCreate}>{text.createPrompt}<span aria-hidden className="ml-2 text-base">+</span></Button> : null}
        </header>

        {visiblePrompts.length ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {visiblePrompts.map((prompt) => (
              <article key={prompt.id} className="flex min-h-[270px] flex-col rounded-[var(--qf-radius)] border border-[var(--qf-border)] bg-white p-5 shadow-[var(--qf-shadow)]">
                <div className="flex items-start justify-between gap-3"><span className="rounded-full bg-[var(--qf-accent-soft)] px-3 py-1 text-[11px] font-bold text-[var(--qf-accent)]">{prompt.categoryName || text.uncategorized}</span>{data.canManage ? <button type="button" title={text.editPrompt} onClick={() => void loadPrompt(prompt.id)} className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-md border border-[var(--qf-border)] text-sm hover:border-[var(--qf-accent)] hover:text-[var(--qf-accent)]">✎</button> : null}</div>
                <h2 className="mt-4 text-base font-bold text-[var(--qf-text)]">{prompt.title}</h2>
                <p className="mt-2 line-clamp-4 flex-1 whitespace-pre-wrap text-xs leading-5 text-[var(--qf-text-muted)]">{prompt.body}</p>
                <div className="mt-4 flex items-center gap-2 border-t border-[var(--qf-border)] pt-4"><span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--qf-accent)] text-xs font-bold text-white">{(prompt.authorEmail || "?").slice(0, 1).toUpperCase()}</span><div className="min-w-0"><p className="truncate text-xs font-semibold">{prompt.authorEmail || text.notAvailable}</p><p className="text-[10px] text-[var(--qf-text-muted)]">{text.author}</p></div></div>
                <div className="mt-4 grid grid-cols-2 gap-2"><Link href={`/settings/mcp-portal/prompt-library/${encodeURIComponent(prompt.id)}`} className="inline-flex min-h-10 items-center justify-center rounded-lg border border-[var(--qf-border)] bg-white px-4 py-2 text-center text-sm font-semibold text-[var(--qf-text)] transition hover:border-[var(--qf-accent)] hover:text-[var(--qf-accent)]">{text.viewPrompt}</Link><Button disabled title={text.usePromptLater}>{text.usePrompt}</Button></div>
              </article>
            ))}
          </div>
        ) : (
          <div className="rounded-[var(--qf-radius)] border border-dashed border-[var(--qf-border)] bg-white px-6 py-14 text-center shadow-[var(--qf-shadow)]"><div aria-hidden className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-[var(--qf-accent-soft)] text-2xl">📚</div><p className="mt-4 text-sm font-semibold text-[var(--qf-text-muted)]">{selectedCategories.length ? text.noPromptsForCategories : activeSearch ? text.noPromptsForSearch : text.noPrompts}</p></div>
        )}
      </section>

      {editor ? (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/45 p-4">
          <div role="dialog" aria-modal="true" aria-labelledby="prompt-editor-title" className="max-h-[94vh] w-full max-w-4xl overflow-y-auto rounded-xl bg-white shadow-2xl">
            <header className="flex items-start justify-between gap-4 border-b border-[var(--qf-border)] px-6 py-5"><div><h2 id="prompt-editor-title" className="text-lg font-bold">{editor === "create" ? text.createNewPrompt : text.editPrompt}</h2><p className="mt-1 text-xs text-[var(--qf-text-muted)]">{editor === "create" ? text.createPromptHelp : text.editPromptHelp}</p></div><button type="button" aria-label={text.cancel} disabled={saving} onClick={() => setEditor(null)} className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-xl hover:bg-[var(--qf-background)] disabled:cursor-not-allowed">×</button></header>
            <form onSubmit={(event) => void savePrompt(event)}>
              <div className="grid gap-5 p-6 md:grid-cols-2">
                <Field label={text.promptTitle}><input required maxLength={200} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder={text.enterPromptTitle} className={fieldClass} /></Field>
                <Field label={text.version}><input required maxLength={40} value={form.version} onChange={(event) => setForm({ ...form, version: event.target.value })} placeholder="1.0" className={fieldClass} /></Field>
                <Field label={text.category}><select required value={form.categoryId} onChange={(event) => setForm({ ...form, categoryId: event.target.value })} className={fieldClass}><option value="">{text.selectCategory}</option>{data.categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></Field>
                <Field label={text.department}><select required value={form.departmentId} onChange={(event) => setForm({ ...form, departmentId: event.target.value })} className={fieldClass}><option value="">{text.selectDepartment}</option>{data.departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</select></Field>
                <Field label={`${text.users} (${text.usersMultiple})`} className="md:col-span-2"><div className="max-h-44 overflow-y-auto rounded-lg border border-[var(--qf-border)] p-2">{data.users.length ? data.users.map((user) => <label key={user.id} className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-[var(--qf-background)]"><input type="checkbox" checked={form.assignedUserId.includes(user.id)} onChange={() => toggleUser(user.id)} className="accent-[var(--qf-accent)]" /><span className="truncate">{user.email}</span></label>) : <p className="p-3 text-xs text-[var(--qf-text-muted)]">{text.noUsers}</p>}</div></Field>
                <Field label={text.tags} hint={text.tagsHint} className="md:col-span-2"><input value={form.tags} onChange={(event) => setForm({ ...form, tags: event.target.value })} placeholder={text.tagsPlaceholder} className={fieldClass} /></Field>
                <Field label={text.promptBody} className="md:col-span-2"><textarea required maxLength={20_000} rows={8} value={form.body} onChange={(event) => setForm({ ...form, body: event.target.value })} placeholder={text.promptBodyPlaceholder} className={`${fieldClass} h-auto min-h-44 py-3`} /></Field>
                {formError ? <p role="alert" className="md:col-span-2 text-xs font-semibold text-[var(--qf-danger)]">{formError}</p> : null}
              </div>
              <footer className="flex justify-end gap-2.5 border-t border-[var(--qf-border)] px-6 py-4"><Button type="button" variant="secondary" disabled={saving} onClick={() => setEditor(null)}>{text.cancel}</Button><Button type="submit" disabled={saving}>{saving ? (editor === "create" ? text.creatingPrompt : text.updatingPrompt) : (editor === "create" ? text.savePrompt : text.updatePrompt)}</Button></footer>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}

const fieldClass = "h-11 w-full rounded-lg border border-[var(--qf-border)] bg-white px-3.5 text-sm text-[var(--qf-text)] outline-none transition placeholder:text-[var(--qf-text-light)] focus:border-[var(--qf-accent)] focus:ring-3 focus:ring-[var(--qf-accent-soft)]";

function Field({ label, hint, className = "", children }: { label: string; hint?: string; className?: string; children: React.ReactNode }) {
  return <label className={`block space-y-1.5 ${className}`}><span className="block text-[13px] font-semibold text-[var(--qf-text)]">{label}</span>{children}{hint ? <span className="block text-[11px] text-[var(--qf-text-muted)]">{hint}</span> : null}</label>;
}
