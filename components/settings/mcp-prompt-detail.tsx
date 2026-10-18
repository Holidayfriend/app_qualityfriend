"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
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
  departmentName: string;
  authorEmail: string;
};

type Conversation = { id: string; title: string; createdAt: string };
type Feedback = { feedbackScore: number; reaction: "like" | "dislike" | null } | null;
type DetailData = {
  prompt: Prompt;
  feedback: Feedback;
  similarPrompts: Prompt[];
  conversations: Conversation[];
};

export function McpPromptDetail({ promptId }: { promptId: string }) {
  const { locale } = useI18n();
  const text = mcpPortalMessages[locale];
  const toast = useToast();
  const [data, setData] = useState<DetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [rating, setRating] = useState(0);
  const [reaction, setReaction] = useState<"like" | "dislike" | null>(null);
  const [savingFeedback, setSavingFeedback] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/settings/mcp-portal/prompts/${encodeURIComponent(promptId)}`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const result = await response.json().catch(() => ({}));
        if (!response.ok || !result.prompt) throw new Error();
        const detail = result as DetailData;
        setData(detail);
        setRating(detail.feedback ? detail.feedback.feedbackScore / 20 : 0);
        setReaction(detail.feedback?.reaction ?? null);
      })
      .catch(() => { if (!controller.signal.aborted) setLoadError(true); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [promptId]);

  async function saveFeedback(nextRating: number, nextReaction: "like" | "dislike" | null) {
    setSavingFeedback(true);
    try {
      const response = await fetch(`/api/settings/mcp-portal/prompts/${encodeURIComponent(promptId)}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feedbackScore: Math.round(nextRating * 20), reaction: nextReaction ?? "none" }),
      });
      if (!response.ok) throw new Error();
    } catch {
      toast({ message: text.feedbackSaveFailed, tone: "error" });
    } finally {
      setSavingFeedback(false);
    }
  }

  function chooseRating(value: number) {
    setRating(value);
    void saveFeedback(value, reaction);
  }

  function chooseReaction(value: "like" | "dislike") {
    const next = reaction === value ? null : value;
    setReaction(next);
    void saveFeedback(rating, next);
  }

  async function copyPrompt() {
    if (!data) return;
    try {
      await navigator.clipboard.writeText(data.prompt.body);
      toast({ message: text.promptCopied, tone: "success" });
    } catch {
      toast({ message: text.promptCopyFailed, tone: "error" });
    }
  }

  if (loading) return <BrandLoader label={text.loadingPrompt} />;
  if (loadError || !data) {
    return (
      <section className="rounded-[var(--qf-radius)] border border-red-200 bg-white p-8 text-center shadow-[var(--qf-shadow)]">
        <p className="text-sm font-semibold text-red-700">{text.promptLoadFailed}</p>
        <Link href="/settings/mcp-portal/prompt-library" className="mt-4 inline-flex min-h-10 items-center rounded-lg border border-[var(--qf-border)] px-4 text-sm font-semibold">{text.backToLibrary}</Link>
      </section>
    );
  }

  const { prompt, conversations, similarPrompts } = data;
  const author = prompt.authorEmail || text.notAvailable;

  return (
    <section>
      <nav className="mb-5 flex flex-wrap items-center gap-2 text-xs text-[var(--qf-text-muted)]" aria-label={text.breadcrumbs}>
        <Link href="/settings/mcp-portal/prompt-library" className="font-semibold hover:text-[var(--qf-accent)]">{text.promptLibrary}</Link>
        <span aria-hidden>›</span>
        <span>{prompt.categoryName || text.uncategorized}</span>
        <span aria-hidden>›</span>
        <span className="font-semibold text-[var(--qf-text)]">{prompt.title}</span>
      </nav>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(260px,1fr)]">
        <article className="rounded-[var(--qf-radius)] border border-[var(--qf-border)] bg-white p-6 shadow-[var(--qf-shadow)] sm:p-7">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--qf-accent)] text-sm font-bold text-white">{author.slice(0, 1).toUpperCase()}</span>
            <div className="min-w-0"><p className="truncate text-sm font-bold">{author}</p><p className="text-xs text-[var(--qf-text-muted)]">{text.author}</p></div>
          </div>
          <span className="mt-6 inline-flex rounded-full bg-[var(--qf-accent-soft)] px-3 py-1 text-[11px] font-bold text-[var(--qf-accent)]">{prompt.categoryName || text.uncategorized}</span>
          <h1 className="mt-3 text-xl font-bold text-[var(--qf-text)] sm:text-2xl">{prompt.title}</h1>
          <p className="mt-1 text-xs text-[var(--qf-text-muted)]">{text.version} {prompt.version}</p>
          <div className="mt-5 whitespace-pre-wrap rounded-xl border border-[var(--qf-border)] bg-[#faf9f7] p-5 text-sm leading-7 text-[var(--qf-text)]">{prompt.body}</div>
          {prompt.tags.length ? <div className="mt-4 flex flex-wrap gap-2">{prompt.tags.map((tag) => <span key={tag} className="rounded-full bg-[var(--qf-accent-soft)] px-3 py-1 text-xs font-semibold text-[var(--qf-accent)]">#{tag}</span>)}</div> : null}

          <div className="mt-5 flex flex-wrap items-center justify-between gap-4 border-t border-[var(--qf-border)] pt-5">
            <div>
              <div className="flex gap-1" aria-label={text.ratePrompt}>
                {[1, 2, 3, 4, 5].map((value) => <button key={value} type="button" disabled={savingFeedback} onClick={() => chooseRating(value)} aria-label={`${value} ${text.stars}`} className={`cursor-pointer text-2xl leading-none disabled:cursor-wait ${value <= rating ? "text-amber-400" : "text-gray-300"}`}>★</button>)}
              </div>
              <p className="mt-1 text-[11px] text-[var(--qf-text-muted)]">{rating ? `${text.yourRating}: ${rating}/5` : text.clickToRate}</p>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" disabled={savingFeedback} onClick={() => chooseReaction("like")} aria-label={text.likePrompt} className={`flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg border text-lg disabled:cursor-wait ${reaction === "like" ? "border-green-300 bg-green-50 text-green-700" : "border-[var(--qf-border)]"}`}>👍</button>
              <button type="button" disabled={savingFeedback} onClick={() => chooseReaction("dislike")} aria-label={text.dislikePrompt} className={`flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg border text-lg disabled:cursor-wait ${reaction === "dislike" ? "border-red-300 bg-red-50 text-red-700" : "border-[var(--qf-border)]"}`}>👎</button>
              <button type="button" onClick={() => void copyPrompt()} className="flex h-10 cursor-pointer items-center gap-2 rounded-lg border border-[var(--qf-border)] px-3 text-xs font-semibold hover:border-[var(--qf-accent)] hover:text-[var(--qf-accent)]">⧉ {text.copyPrompt}</button>
            </div>
          </div>

          <Button className="mt-5 w-full" disabled title={text.usePromptLater}>{text.usePrompt}</Button>
        </article>

        <aside className="h-fit rounded-[var(--qf-radius)] border border-[var(--qf-border)] bg-white p-6 shadow-[var(--qf-shadow)]">
          <h2 className="text-base font-bold">{text.howToUsePrompt}</h2>
          <ol className="mt-4 list-decimal space-y-3 pl-5 text-sm leading-6 text-[var(--qf-text-muted)]">
            <li>{text.howToUse1}</li><li>{text.howToUse2}</li><li>{text.howToUse3}</li><li>{text.howToUse4}</li>
          </ol>
          <Link href="/settings/mcp-portal/prompt-library" className="mt-6 inline-flex min-h-10 w-full items-center justify-center rounded-lg border border-[var(--qf-border)] px-4 text-center text-sm font-semibold transition hover:border-[var(--qf-accent)] hover:text-[var(--qf-accent)]">{text.exploreMorePrompts}</Link>
        </aside>
      </div>

      <DetailSection title={text.promptConversations} empty={text.noPromptConversations} hasItems={Boolean(conversations.length)}>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {conversations.map((conversation) => <article key={conversation.id} className="rounded-[var(--qf-radius)] border border-[var(--qf-border)] bg-white p-5 shadow-[var(--qf-shadow)]"><h3 className="text-sm font-bold">{conversation.title || text.untitledConversation}</h3><p className="mt-2 text-xs text-[var(--qf-text-muted)]">{formatDate(conversation.createdAt, locale, text.unknownDate)}</p></article>)}
        </div>
      </DetailSection>

      <DetailSection title={text.moreLikeThis} empty={text.noSimilarPrompts} hasItems={Boolean(similarPrompts.length)}>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {similarPrompts.map((item) => <SimilarPromptCard key={item.id} prompt={item} authorLabel={text.author} viewLabel={text.viewPrompt} uncategorized={text.uncategorized} />)}
        </div>
      </DetailSection>
    </section>
  );
}

function DetailSection({ title, empty, hasItems, children }: { title: string; empty: string; hasItems: boolean; children: React.ReactNode }) {
  return <section className="mt-7"><h2 className="mb-4 text-lg font-bold text-[var(--qf-text)]">{title}</h2>{hasItems ? children : <div className="rounded-[var(--qf-radius)] border border-dashed border-[var(--qf-border)] bg-white px-6 py-9 text-center text-sm text-[var(--qf-text-muted)]">{empty}</div>}</section>;
}

function SimilarPromptCard({ prompt, authorLabel, viewLabel, uncategorized }: { prompt: Prompt; authorLabel: string; viewLabel: string; uncategorized: string }) {
  const author = prompt.authorEmail || "?";
  return (
    <article className="flex min-h-64 flex-col rounded-[var(--qf-radius)] border border-[var(--qf-border)] bg-white p-5 shadow-[var(--qf-shadow)]">
      <span className="w-fit rounded-full bg-[var(--qf-accent-soft)] px-3 py-1 text-[11px] font-bold text-[var(--qf-accent)]">{prompt.categoryName || uncategorized}</span>
      <h3 className="mt-4 text-base font-bold">{prompt.title}</h3>
      <p className="mt-2 line-clamp-3 flex-1 whitespace-pre-wrap text-xs leading-5 text-[var(--qf-text-muted)]">{prompt.body}</p>
      <div className="mt-4 flex items-center gap-2"><span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--qf-accent)] text-xs font-bold text-white">{author.slice(0, 1).toUpperCase()}</span><div className="min-w-0"><p className="truncate text-xs font-semibold">{author}</p><p className="text-[10px] text-[var(--qf-text-muted)]">{authorLabel}</p></div></div>
      <Link href={`/settings/mcp-portal/prompt-library/${encodeURIComponent(prompt.id)}`} className="mt-4 inline-flex min-h-10 items-center justify-center rounded-lg border border-[var(--qf-border)] px-4 text-sm font-semibold transition hover:border-[var(--qf-accent)] hover:text-[var(--qf-accent)]">{viewLabel}</Link>
    </article>
  );
}

function formatDate(value: string, locale: string, fallback: string) {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) return fallback;
  return new Intl.DateTimeFormat(locale, { year: "numeric", month: "short", day: "numeric" }).format(date);
}
