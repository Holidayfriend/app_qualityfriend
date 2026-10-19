"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import type { ChatConversation, ChatFile, ChatMessage, ChatSuggestion, ChatTool, ChatToolGroup, ChatVectorStore } from "../../lib/mcp/chat-data";
import type { PortalPrompt } from "../../lib/mcp/prompt-data";
import { mcpPortalMessages } from "../../lib/i18n/dictionaries";
import { useI18n } from "../i18n/i18n-provider";
import { BrandLoader } from "../ui/brand-loader";
import { Button } from "../ui/button";
import { ConfirmDialog } from "../ui/confirm-dialog";
import { useToast } from "../ui/toast-provider";

type Preferences = { enabledProviders: string[]; defaultProvider: string; models: Record<string, string> };
type BootstrapData = { suggestions: ChatSuggestion[]; mostUsedPrompts: PortalPrompt[]; conversations: ChatConversation[]; preferences: Preferences; toolGroups: ChatToolGroup[]; vectorStores: ChatVectorStore[]; selectedPrompt: PortalPrompt | null; files: ChatFile[]; account: { email: string; role: string; hotelId: string } };
type ConversationData = { conversation: ChatConversation | null; conversations: ChatConversation[]; messages: ChatMessage[]; conversationProvider: { provider: string; model: string }; files: ChatFile[] };
type ToolSelection = { category: string; serverId: string; name: string; title: string; args: Record<string, unknown> };

const modelCatalog: Record<string, Array<{ value: string; label: string }>> = {
  openai: [{ value: "gpt-5", label: "GPT-5" }, { value: "gpt-5-mini", label: "GPT-5 Mini" }, { value: "gpt-5-nano", label: "GPT-5 Nano" }, { value: "gpt-4o-mini", label: "GPT-4o Mini" }, { value: "gpt-4o", label: "GPT-4o" }, { value: "gpt-3.5-turbo", label: "GPT-3.5 Turbo" }],
  deepseek: [{ value: "deepseek-chat", label: "DeepSeek Chat" }, { value: "deepseek-coder", label: "DeepSeek Coder" }],
  perplexity: [{ value: "sonar", label: "Sonar" }, { value: "sonar-deep-research", label: "Sonar Deep Research" }, { value: "sonar-reasoning-pro", label: "Sonar Reasoning Pro" }],
  claude: [{ value: "claude-sonnet-4-5", label: "Claude Sonnet 4.5" }, { value: "claude-haiku-4-5", label: "Claude Haiku 4.5" }, { value: "claude-opus-4-5", label: "Claude Opus 4.5" }, { value: "claude-opus-4-1", label: "Claude Opus 4.1" }],
};

async function getJson(url: string, signal?: AbortSignal) { const response = await fetch(url, { cache: "no-store", signal }); const result = await response.json().catch(() => ({})); if (!response.ok) throw new Error(typeof result.message === "string" ? result.message : typeof result.error === "string" ? result.error : "REQUEST_FAILED"); return result; }

export function McpNewChat({ promptId = "" }: { promptId?: string }) {
  const { locale } = useI18n();
  const text = mcpPortalMessages[locale];
  const router = useRouter();
  const toast = useToast();
  const [data, setData] = useState<BootstrapData | null>(null);
  const [message, setMessage] = useState("");
  const [activePromptId, setActivePromptId] = useState(promptId);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    const query = promptId ? `?promptId=${encodeURIComponent(promptId)}` : "";
    getJson(`/api/settings/mcp-portal/chat/bootstrap${query}`, controller.signal)
      .then((result) => {
        const next = result as BootstrapData;
        setData(next);
        if (next.selectedPrompt?.body) setMessage(next.selectedPrompt.body);
      })
      .catch((reason) => {
        if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "LOAD_FAILED");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [promptId]);

  async function startChat(content: string) {
    const clean = content.trim();
    if (!clean || !data || sending) return;
    setSending(true);
    try {
      const title = clean.split(/\s+/).slice(0, 3).join(" ") || text.myFirstChat;
      const create = await fetch("/api/settings/mcp-portal/chat/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, promptId: activePromptId }),
      });
      const created = await create.json().catch(() => ({}));
      if (!create.ok || !created.id) throw new Error(created.message || text.conversationCreateFailed);
      const provider = data.preferences.defaultProvider || "openai";
      const model = data.preferences.models[provider] || modelCatalog[provider]?.[0]?.value || "gpt-4o-mini";
      const send = await fetch(`/api/settings/mcp-portal/chat/conversations/${encodeURIComponent(created.id)}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: clean, provider, model }),
      });
      const sent = await send.json().catch(() => ({}));
      if (!send.ok) throw new Error(sent.message || text.messageSendFailed);
      router.push(`/settings/mcp-portal/chat-history/${encodeURIComponent(created.id)}`);
    } catch (reason) {
      toast({ message: reason instanceof Error ? reason.message : text.messageSendFailed, tone: "error" });
      setSending(false);
    }
  }

  if (loading) return <BrandLoader label={text.chatLoading} />;
  if (error || !data) return <ChatError message={text.chatLoadFailed} retryLabel={text.retry} retry={() => location.reload()} />;

  return (
    <section className="pb-28">
      <div className="mx-auto max-w-5xl text-center">
        <Image src="/logo-icon.png" alt="" width={70} height={70} className="mx-auto" />
        <h1 className="mt-5 text-2xl font-bold sm:text-3xl">{text.howCanWeAssist}</h1>
        <p className="mt-2 text-sm text-[var(--qf-text-muted)]">{text.chatWelcome}</p>
        <Link href="/settings/mcp-portal/prompt-library" className="mt-4 inline-flex text-sm font-bold text-[var(--qf-accent)] hover:underline">{text.exploreMorePrompts} &rarr;</Link>
      </div>
      <div className="mx-auto mt-8 grid max-w-6xl gap-4 md:grid-cols-2 xl:grid-cols-4">
        {data.mostUsedPrompts.length ? data.mostUsedPrompts.map((prompt) => (
          <article key={prompt.id} className="flex min-h-52 flex-col rounded-[var(--qf-radius)] border border-[var(--qf-border)] bg-white p-5 text-left shadow-[var(--qf-shadow)]">
            <h2 className="line-clamp-2 font-bold">{prompt.title}</h2>
            <p className="mt-3 line-clamp-4 flex-1 text-xs leading-5 text-[var(--qf-text-muted)]">{prompt.body}</p>
            <button type="button" onClick={() => { setMessage(prompt.body); setActivePromptId(prompt.id); }} className="mt-4 cursor-pointer rounded-lg bg-[var(--qf-accent)] px-4 py-2 text-xs font-bold text-white">{text.usePrompt}</button>
          </article>
        )) : <div className="col-span-full rounded-lg border border-dashed border-[var(--qf-border)] p-8 text-sm text-[var(--qf-text-muted)]">{text.noPrompts}</div>}
      </div>
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--qf-border)] bg-white/95 p-3 backdrop-blur sm:left-[272px]">
        <div className="mx-auto max-w-6xl">
          <div className="mb-2 flex gap-2 overflow-x-auto">
            {data.suggestions.map((suggestion) => <button key={suggestion.key} type="button" disabled={sending} onClick={() => void startChat(`${suggestion.icon} ${suggestion.label}`)} className="shrink-0 cursor-pointer rounded-full border border-[var(--qf-border)] bg-white px-3 py-1.5 text-xs hover:border-[var(--qf-accent)]">{suggestion.icon} {suggestion.label}</button>)}
          </div>
          <Composer value={message} setValue={(value) => { setMessage(value); if (value !== data.selectedPrompt?.body) setActivePromptId(""); }} disabled={sending} placeholder={text.messageToAi} onSend={() => void startChat(message)} />
        </div>
      </div>
      {sending ? <BrandLoader label={text.creatingConversation} overlay /> : null}
    </section>
  );
}

export function McpChatHistory() {
  const { locale } = useI18n(); const text = mcpPortalMessages[locale]; const router = useRouter(); const [conversations, setConversations] = useState<ChatConversation[]>([]); const [search, setSearch] = useState(""); const [loading, setLoading] = useState(true); const [error, setError] = useState("");
  useEffect(() => { const controller = new AbortController(); getJson("/api/settings/mcp-portal/chat/bootstrap", controller.signal).then((result) => { const items = (result as BootstrapData).conversations; setConversations(items); if (items[0]) router.replace(`/settings/mcp-portal/chat-history/${encodeURIComponent(items[0].id)}`); }).catch((reason) => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "LOAD_FAILED"); }).finally(() => { if (!controller.signal.aborted) setLoading(false); }); return () => controller.abort(); }, [router]);
  if (loading) return <BrandLoader label={text.chatHistoryLoading} />; if (error) return <ChatError message={text.chatLoadFailed} retryLabel={text.retry} retry={() => location.reload()} />;
  const visible = conversations.filter((conversation) => conversation.title.toLowerCase().includes(search.toLowerCase()));
  return <section className="rounded-[var(--qf-radius)] border border-[var(--qf-border)] bg-white p-6 shadow-[var(--qf-shadow)]"><div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-lg font-bold">{text.chatHistory}</h1><p className="mt-1 text-xs text-[var(--qf-text-muted)]">{text.chatHistoryHelp}</p></div><Link href="/settings/mcp-portal/new-chat" className="rounded-lg bg-[var(--qf-accent)] px-4 py-2.5 text-sm font-bold text-white">+ {text.newChat}</Link></div><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={text.searchConversations} className="mt-5 h-11 w-full max-w-lg rounded-lg border border-[var(--qf-border)] px-4 text-sm outline-none focus:border-[var(--qf-accent)]" /><div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{visible.map((conversation) => <Link key={conversation.id} href={`/settings/mcp-portal/chat-history/${encodeURIComponent(conversation.id)}`} className="rounded-lg border border-[var(--qf-border)] p-4 hover:border-[var(--qf-accent)]"><h2 className="font-bold">{conversation.title || text.untitledConversation}</h2><p className="mt-2 text-xs text-[var(--qf-text-muted)]">{formatDate(conversation.updatedAt || conversation.createdAt, locale, text.unknownDate)}</p></Link>)}{!visible.length ? <div className="col-span-full rounded-lg border border-dashed border-[var(--qf-border)] p-10 text-center text-sm text-[var(--qf-text-muted)]">{text.noConversations}</div> : null}</div></section>;
}

export function McpConversationChat({ conversationId }: { conversationId: string }) {
  const { locale } = useI18n(); const text = mcpPortalMessages[locale]; const router = useRouter(); const toast = useToast(); const endRef = useRef<HTMLDivElement>(null); const fileRef = useRef<HTMLInputElement>(null);
  const [bootstrap, setBootstrap] = useState<BootstrapData | null>(null); const [detail, setDetail] = useState<ConversationData | null>(null); const [loading, setLoading] = useState(true); const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [message, setMessage] = useState(""); const [providerModel, setProviderModel] = useState(""); const [toolsOpen, setToolsOpen] = useState(false); const [openGroup, setOpenGroup] = useState(""); const [selectedTool, setSelectedTool] = useState<ToolSelection | null>(null); const [selectedKnowledge, setSelectedKnowledge] = useState<ChatVectorStore | null>(null); const [editingTool, setEditingTool] = useState<{ group: ChatToolGroup; tool: ChatTool } | null>(null); const [toolArgs, setToolArgs] = useState<Record<string, string>>({}); const [pendingDelete, setPendingDelete] = useState<ChatConversation | null>(null); const [renaming, setRenaming] = useState<ChatConversation | null>(null); const [renameTitle, setRenameTitle] = useState("");
  const load = useCallback(async () => { const [boot, conversation] = await Promise.all([getJson(`/api/settings/mcp-portal/chat/bootstrap?conversationId=${encodeURIComponent(conversationId)}`), getJson(`/api/settings/mcp-portal/chat/conversations/${encodeURIComponent(conversationId)}`)]); const bootData = boot as BootstrapData, detailData = conversation as ConversationData; setBootstrap(bootData); setDetail(detailData); const provider = detailData.conversationProvider.provider || bootData.preferences.defaultProvider || "openai"; const model = detailData.conversationProvider.model || bootData.preferences.models[provider] || modelCatalog[provider]?.[0]?.value || "gpt-4o-mini"; setProviderModel(`${provider}:${model}`); }, [conversationId]);
  useEffect(() => { let active = true; setTimeout(() => { if (!active) return; load().catch((reason) => setError(reason instanceof Error ? reason.message : "LOAD_FAILED")).finally(() => setLoading(false)); }, 0); return () => { active = false; }; }, [load]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [detail?.messages.length]);
  const modelOptions = useMemo(() => { if (!bootstrap) return []; const enabled = bootstrap.preferences.enabledProviders.length ? bootstrap.preferences.enabledProviders : Object.keys(modelCatalog); return enabled.flatMap((provider) => (modelCatalog[provider] ?? []).map((model) => ({ value: `${provider}:${model.value}`, label: `${providerName(provider)} - ${model.label}` }))); }, [bootstrap]);
  async function send(content: string, override?: { provider: string; model: string }) { const clean = content.trim(); if (!clean || !bootstrap || busy) return; const [selectedProvider, selectedModel] = override ? [override.provider, override.model] : providerModel.split(":"); setBusy(true); try { const body: Record<string, unknown> = { content: clean, provider: selectedProvider || "openai", model: selectedModel || "gpt-4o-mini" }; if (selectedTool) body.tool = { serverId: selectedTool.serverId, name: selectedTool.name, args: selectedTool.args }; else if (selectedKnowledge) body.knowledge = { vectorStoreId: selectedKnowledge.id }; const response = await fetch(`/api/settings/mcp-portal/chat/conversations/${encodeURIComponent(conversationId)}/messages`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); const result = await response.json().catch(() => ({})); if (!response.ok) throw new Error(result.message || text.messageSendFailed); setMessage(""); setSelectedTool(null); setSelectedKnowledge(null); await load(); } catch (reason) { toast({ message: reason instanceof Error ? reason.message : text.messageSendFailed, tone: "error" }); } finally { setBusy(false); } }
  async function saveFeedback(messageId: string, current: ChatMessage["reaction"], next: "like" | "dislike") { const reaction = current === next ? "none" : next; setDetail((value) => value ? { ...value, messages: value.messages.map((item) => item.id === messageId ? { ...item, reaction } : item) } : value); const response = await fetch(`/api/settings/mcp-portal/chat/messages/${encodeURIComponent(messageId)}/feedback`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reaction }) }); if (!response.ok) { toast({ message: text.feedbackSaveFailed, tone: "error" }); await load(); } }
  async function upload(files: FileList | null) { if (!files?.length) return; if (files.length > 5) { toast({ message: text.maxFiveFiles, tone: "error" }); return; } setBusy(true); try { const form = new FormData(); Array.from(files).forEach((file) => form.append("files", file)); const response = await fetch(`/api/settings/mcp-portal/chat/conversations/${encodeURIComponent(conversationId)}/files`, { method: "POST", body: form }); const result = await response.json().catch(() => ({})); if (!response.ok) throw new Error(result.message || text.fileUploadFailed); toast({ message: text.filesUploaded, tone: "success" }); await load(); } catch (reason) { toast({ message: reason instanceof Error ? reason.message : text.fileUploadFailed, tone: "error" }); } finally { setBusy(false); if (fileRef.current) fileRef.current.value = ""; } }
  function openTool(group: ChatToolGroup, tool: ChatTool) { const properties = schemaProperties(tool); setToolArgs(Object.fromEntries(Object.entries(properties).map(([key, value]) => [key, defaultSchemaValue(value)]))); setEditingTool({ group, tool }); setToolsOpen(false); }
  async function handleTool(mode: "select" | "execute") {
    if (!editingTool) return;
    const required = Array.isArray(editingTool.tool.inputSchema.required)
      ? editingTool.tool.inputSchema.required.filter((item): item is string => typeof item === "string")
      : [];
    if (required.some((key) => !toolArgs[key]?.trim())) {
      toast({ message: text.toolRequiredFields, tone: "error" });
      return;
    }
    const args = typedToolArgs(editingTool.tool, toolArgs);
    const selected = { category: editingTool.group.category, serverId: editingTool.group.serverId, name: editingTool.tool.name, title: editingTool.tool.title, args };
    setEditingTool(null);
    if (mode === "select") {
      setSelectedTool(selected);
      setSelectedKnowledge(null);
      return;
    }
    setBusy(true);
    try {
      const response = await fetch(`/api/settings/mcp-portal/chat/conversations/${encodeURIComponent(conversationId)}/execute-tool`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serverId: selected.serverId, tool: selected.name, arguments: selected.args }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.message || text.toolExecutionFailed);
      await load();
    } catch (reason) {
      toast({ message: reason instanceof Error ? reason.message : text.toolExecutionFailed, tone: "error" });
    } finally {
      setBusy(false);
    }
  }
  async function renameConversation(event: FormEvent) { event.preventDefault(); if (!renaming || !renameTitle.trim()) return; setBusy(true); try { const response = await fetch(`/api/settings/mcp-portal/chat/conversations/${encodeURIComponent(renaming.id)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: renameTitle }) }); if (!response.ok) throw new Error(); setRenaming(null); await load(); } catch { toast({ message: text.conversationRenameFailed, tone: "error" }); } finally { setBusy(false); } }
  async function deleteConversation() { if (!pendingDelete) return; setBusy(true); try { const response = await fetch(`/api/settings/mcp-portal/chat/conversations/${encodeURIComponent(pendingDelete.id)}`, { method: "DELETE" }); if (!response.ok) throw new Error(); setPendingDelete(null); router.push("/settings/mcp-portal/chat-history"); } catch { toast({ message: text.conversationDeleteFailed, tone: "error" }); } finally { setBusy(false); } }
  if (loading) return <BrandLoader label={text.chatLoading} />; if (error || !bootstrap || !detail) return <ChatError message={text.chatLoadFailed} retryLabel={text.retry} retry={() => location.reload()} />;
  return (
    <>
      <section className="grid min-h-[650px] overflow-hidden rounded-[var(--qf-radius)] border border-[var(--qf-border)] bg-white shadow-[var(--qf-shadow)] lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="border-b border-[var(--qf-border)] bg-[#faf9f7] p-4 lg:border-r lg:border-b-0">
          <p className="truncate rounded-lg border border-[var(--qf-border)] bg-white px-3 py-2 text-xs font-semibold">{bootstrap.account.email || text.notAvailable}</p>
          <Link href="/settings/mcp-portal/new-chat" className="mt-2 flex h-10 items-center rounded-lg border border-[var(--qf-text)] px-3 text-sm font-bold">+ {text.newChat}</Link>
          <h2 className="mt-5 text-sm font-bold">{text.myConversations}</h2>
          <div className="mt-2 max-h-[520px] space-y-1 overflow-y-auto">
            {detail.conversations.map((conversation) => (
              <div key={conversation.id} className={`group flex items-center gap-1 rounded-lg px-2 py-2 ${conversation.id === conversationId ? "bg-[var(--qf-accent)] text-white" : "hover:bg-white"}`}>
                <Link href={`/settings/mcp-portal/chat-history/${encodeURIComponent(conversation.id)}`} className="min-w-0 flex-1 truncate text-xs font-semibold">{conversation.title || text.untitledConversation}</Link>
                <button type="button" onClick={() => { setRenaming(conversation); setRenameTitle(conversation.title); }} className="cursor-pointer px-1 text-xs opacity-70 hover:opacity-100">✎</button>
                <button type="button" onClick={() => setPendingDelete(conversation)} className="cursor-pointer px-1 text-xs opacity-70 hover:opacity-100">🗑</button>
              </div>
            ))}
          </div>
        </aside>
        <div className="flex min-h-0 flex-col">
          <div className="border-b border-[var(--qf-border)] p-3">
            <select value={providerModel} onChange={(event) => setProviderModel(event.target.value)} className="h-11 w-full rounded-lg border border-[var(--qf-border)] px-3 text-sm">
              {modelOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </div>
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4 sm:p-6">
            {detail.messages.map((item, index) => <ChatBubble key={item.id || `${item.role}-${index}`} message={item} previousUser={previousUserContent(detail.messages, index)} preferences={bootstrap.preferences} text={text} onCompare={(content, provider, model) => void send(content, { provider, model })} onFeedback={(reaction) => void saveFeedback(item.id, item.reaction, reaction)} />)}
            {!detail.messages.length ? <div className="flex h-full min-h-80 items-center justify-center text-sm text-[var(--qf-text-muted)]">{text.noMessages}</div> : null}
            <div ref={endRef} />
          </div>
          <div className="relative border-t border-[var(--qf-border)] p-3">
            <div className="mb-2 flex flex-wrap gap-2">
              {selectedTool ? <Tag label={`${selectedTool.category}: ${selectedTool.title}`} clear={() => setSelectedTool(null)} /> : null}
              {selectedKnowledge ? <Tag label={`${text.knowledgeBase}: ${selectedKnowledge.name}`} clear={() => setSelectedKnowledge(null)} /> : null}
              {detail.files.length ? <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">📎 {detail.files.length} {text.files}</span> : null}
            </div>
            <div className="flex items-end gap-2">
              <div className="relative">
                <button type="button" onClick={() => setToolsOpen((open) => !open)} className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-full bg-[var(--qf-accent)] text-white" aria-label={text.tools}>🛠</button>
                {toolsOpen ? <ToolsMenu groups={bootstrap.toolGroups} stores={bootstrap.vectorStores} text={text} openGroup={openGroup} setOpenGroup={setOpenGroup} selectTool={openTool} selectStore={(store) => { setSelectedKnowledge(store); setSelectedTool(null); setToolsOpen(false); }} upload={() => fileRef.current?.click()} /> : null}
              </div>
              <input ref={fileRef} type="file" multiple hidden accept=".pdf,.docx,.txt,.csv,.xlsx,.pptx,.md,.zip,.png,.jpg,.jpeg,.webp" onChange={(event) => void upload(event.target.files)} />
              <Composer value={message} setValue={setMessage} disabled={busy} placeholder={text.messageToAi} onSend={() => void send(message)} compact />
            </div>
          </div>
        </div>
      </section>
      {busy ? <BrandLoader label={text.chatWorking} overlay /> : null}
      {editingTool ? <ToolDialog selection={editingTool} values={toolArgs} setValues={setToolArgs} text={text} close={() => setEditingTool(null)} select={() => void handleTool("select")} execute={() => void handleTool("execute")} /> : null}
      {renaming ? <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/45 p-4"><form onSubmit={renameConversation} className="w-full max-w-md rounded-xl bg-white p-6"><h2 className="font-bold">{text.renameConversation}</h2><input autoFocus value={renameTitle} onChange={(event) => setRenameTitle(event.target.value)} className="mt-4 h-11 w-full rounded-lg border border-[var(--qf-border)] px-3" /><div className="mt-5 flex justify-end gap-2"><Button variant="secondary" onClick={() => setRenaming(null)}>{text.cancel}</Button><Button type="submit">{text.saveChanges}</Button></div></form></div> : null}
      {pendingDelete ? <ConfirmDialog open title={text.deleteConversation} message={text.deleteConversationConfirm.replace("{title}", pendingDelete.title)} confirmLabel={text.deletePromptAction} cancelLabel={text.cancel} pending={busy} onConfirm={() => void deleteConversation()} onCancel={() => { if (!busy) setPendingDelete(null); }} /> : null}
    </>
  );
}

function ChatBubble({ message, previousUser, preferences, text, onCompare, onFeedback }: { message: ChatMessage; previousUser: string; preferences: Preferences; text: typeof mcpPortalMessages.en; onCompare: (content: string, provider: string, model: string) => void; onFeedback: (reaction: "like" | "dislike") => void }) { const assistant = message.role !== "user"; const tool = message.content.startsWith("TOOL ") && message.content.includes(" RESULT:"); return <div className={`flex gap-3 ${assistant ? "justify-start" : "justify-end"}`}>{assistant ? <Image src="/logo-icon.png" width={34} height={34} alt="AI" className="h-9 w-9 shrink-0" /> : null}<div className={`max-w-[85%] ${assistant ? "" : "rounded-xl bg-[var(--qf-accent)] px-4 py-3 text-white"}`}>{tool ? <ToolOutput content={message.content} /> : <div className={`whitespace-pre-wrap rounded-xl px-4 py-3 text-sm leading-6 ${assistant ? "border border-[var(--qf-border)] bg-[#faf9f7]" : ""}`}>{message.content}</div>}{assistant ? <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-[var(--qf-text-muted)]"><span className="italic">{providerName(message.provider || "openai")} - {modelLabel(message.model || "gpt-4o-mini")}</span>{previousUser ? <><span>{text.compareWith}</span>{preferences.enabledProviders.filter((provider) => provider !== message.provider).map((provider) => <button key={provider} type="button" onClick={() => onCompare(previousUser, provider, preferences.models[provider] || modelCatalog[provider]?.[0]?.value || "")} className="cursor-pointer font-semibold text-[var(--qf-accent)]">{providerName(provider)}</button>)}</> : null}{message.id ? <span className="ml-auto flex gap-1"><button type="button" onClick={() => onFeedback("like")} className={`cursor-pointer rounded px-1 ${message.reaction === "like" ? "bg-green-100 text-green-700" : ""}`}>👍</button><button type="button" onClick={() => onFeedback("dislike")} className={`cursor-pointer rounded px-1 ${message.reaction === "dislike" ? "bg-red-100 text-red-700" : ""}`}>👎</button></span> : null}</div> : null}</div>{!assistant ? <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--qf-accent)] text-xs font-bold text-white">U</span> : null}</div>; }
function ToolOutput({ content }: { content: string }) { const index = content.indexOf(" RESULT:"); const name = content.slice(5, index); const raw = content.slice(index + 8).trim(); let pretty = raw; try { pretty = JSON.stringify(JSON.parse(raw), null, 2); } catch {} return <div className="max-w-full overflow-hidden rounded-xl border border-[var(--qf-border)] bg-[#111827] text-white"><div className="border-b border-white/10 px-4 py-2 text-xs font-bold">{name}</div><pre className="max-h-96 overflow-auto p-4 text-xs whitespace-pre-wrap">{pretty}</pre></div>; }
function ToolsMenu({ groups, stores, text, openGroup, setOpenGroup, selectTool, selectStore, upload }: { groups: ChatToolGroup[]; stores: ChatVectorStore[]; text: typeof mcpPortalMessages.en; openGroup: string; setOpenGroup: (value: string) => void; selectTool: (group: ChatToolGroup, tool: ChatTool) => void; selectStore: (store: ChatVectorStore) => void; upload: () => void }) { return <div className="absolute bottom-13 left-0 z-40 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-[var(--qf-border)] bg-white shadow-2xl">{groups.map((group) => <div key={group.category}><button type="button" onClick={() => setOpenGroup(openGroup === group.category ? "" : group.category)} className="flex w-full cursor-pointer items-center justify-between border-b border-[var(--qf-border)] px-4 py-3 text-left text-sm font-bold"><span>{group.category === "Energy" ? "⚡" : group.category === "Brevo" ? "✉" : "</>"} {group.category} {text.tools}</span><span>⌄</span></button>{openGroup === group.category ? <div className="max-h-52 overflow-y-auto bg-[#faf9f7]">{group.tools.map((tool) => <button key={tool.name} type="button" title={tool.description} onClick={() => selectTool(group, tool)} className="block w-full cursor-pointer border-b border-[var(--qf-border)] px-5 py-2.5 text-left text-xs hover:bg-white">{tool.title}</button>)}{!group.tools.length ? <p className="px-5 py-3 text-xs text-[var(--qf-text-muted)]">{text.noTools}</p> : null}</div> : null}</div>)}{stores.map((store) => <button key={store.id} type="button" onClick={() => selectStore(store)} className="block w-full cursor-pointer border-b border-[var(--qf-border)] px-4 py-3 text-left text-sm">📘 {text.knowledgeBase}: {store.name}</button>)}<button type="button" onClick={upload} className="block w-full cursor-pointer px-4 py-3 text-left text-sm">⬆ {text.uploadFiles}</button></div>; }
function ToolDialog({ selection, values, setValues, text, close, select, execute }: { selection: { group: ChatToolGroup; tool: ChatTool }; values: Record<string, string>; setValues: (value: Record<string, string>) => void; text: typeof mcpPortalMessages.en; close: () => void; select: () => void; execute: () => void }) { const properties = schemaProperties(selection.tool); const required = Array.isArray(selection.tool.inputSchema.required) ? selection.tool.inputSchema.required.filter((item): item is string => typeof item === "string") : []; return <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/45 p-4"><div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white"><header className="border-b border-[var(--qf-border)] p-5"><h2 className="font-bold">{selection.tool.title}</h2><p className="mt-1 text-xs text-[var(--qf-text-muted)]">{selection.tool.description}</p></header><div className="grid gap-4 p-5 sm:grid-cols-2">{Object.entries(properties).map(([key, schema]) => <SchemaField key={key} name={key} schema={schema} required={required.includes(key)} value={values[key] ?? ""} onChange={(value) => setValues({ ...values, [key]: value })} />)}{!Object.keys(properties).length ? <p className="sm:col-span-2 text-sm text-[var(--qf-text-muted)]">{text.toolNoArguments}</p> : null}</div><footer className="flex flex-wrap justify-end gap-2 border-t border-[var(--qf-border)] p-4"><Button variant="secondary" onClick={close}>{text.cancel}</Button><Button variant="secondary" onClick={select}>{text.useWithMessage}</Button><Button onClick={execute}>{text.runToolNow}</Button></footer></div></div>; }
function SchemaField({ name, schema, required, value, onChange }: { name: string; schema: Record<string, unknown>; required: boolean; value: string; onChange: (value: string) => void }) { const choices = Array.isArray(schema.enum) ? schema.enum.map(String) : []; const label = typeof schema.title === "string" ? schema.title : name.replace(/([A-Z])/g, " $1"); const description = typeof schema.description === "string" ? schema.description : ""; return <label className="block"><span className="mb-1.5 block text-xs font-bold">{label}{required ? " *" : ""}</span>{choices.length ? <select required={required} value={value} onChange={(event) => onChange(event.target.value)} className="h-11 w-full rounded-lg border border-[var(--qf-border)] px-3 text-sm">{choices.map((choice) => <option key={choice} value={choice}>{choice}</option>)}</select> : schema.type === "boolean" ? <select value={value} onChange={(event) => onChange(event.target.value)} className="h-11 w-full rounded-lg border border-[var(--qf-border)] px-3 text-sm"><option value="false">false</option><option value="true">true</option></select> : <input required={required} type={schema.type === "number" || schema.type === "integer" ? "number" : "text"} value={value} onChange={(event) => onChange(event.target.value)} className="h-11 w-full rounded-lg border border-[var(--qf-border)] px-3 text-sm" />}{description ? <span className="mt-1 block text-[10px] text-[var(--qf-text-muted)]">{description}</span> : null}</label>; }
function Composer({ value, setValue, disabled, placeholder, onSend, compact = false }: { value: string; setValue: (value: string) => void; disabled: boolean; placeholder: string; onSend: () => void; compact?: boolean }) { return <div className={`flex min-w-0 flex-1 items-end gap-2 rounded-2xl border border-[var(--qf-border)] bg-white p-2 ${compact ? "" : "shadow-lg"}`}><textarea value={value} disabled={disabled} onChange={(event) => setValue(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); onSend(); } }} rows={1} placeholder={placeholder} className={`min-h-10 min-w-0 flex-1 resize-none px-2 py-2 text-sm outline-none ${compact ? "max-h-36" : "max-h-52"}`} /><button type="button" disabled={disabled || !value.trim()} onClick={onSend} className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full bg-[var(--qf-accent)] text-white disabled:cursor-not-allowed disabled:opacity-50">➤</button></div>; }
function Tag({ label, clear }: { label: string; clear: () => void }) { return <span className="inline-flex items-center gap-2 rounded-full bg-[var(--qf-accent-soft)] px-3 py-1 text-xs font-semibold text-[var(--qf-accent)]">{label}<button type="button" onClick={clear} className="cursor-pointer">×</button></span>; }
function ChatError({ message, retryLabel, retry }: { message: string; retryLabel: string; retry: () => void }) { return <section className="rounded-[var(--qf-radius)] border border-red-200 bg-white p-6"><p className="text-sm font-semibold text-red-700">{message}</p><Button variant="secondary" className="mt-4" onClick={retry}>{retryLabel}</Button></section>; }
function schemaProperties(tool: ChatTool) { const properties = tool.inputSchema.properties; return properties && typeof properties === "object" && !Array.isArray(properties) ? properties as Record<string, Record<string, unknown>> : {}; }
function defaultSchemaValue(schema: Record<string, unknown>) { if (schema.default !== undefined) return String(schema.default); if (Array.isArray(schema.enum) && schema.enum[0] !== undefined) return String(schema.enum[0]); return schema.type === "boolean" ? "false" : ""; }
function typedToolArgs(tool: ChatTool, values: Record<string, string>) { const properties = schemaProperties(tool); return Object.fromEntries(Object.entries(values).map(([key, value]) => { const type = properties[key]?.type; if (type === "integer") return [key, value === "" ? 0 : Number.parseInt(value, 10)]; if (type === "number") return [key, value === "" ? 0 : Number(value)]; if (type === "boolean") return [key, value === "true"]; return [key, value]; })); }
function previousUserContent(messages: ChatMessage[], index: number) { for (let current = index - 1; current >= 0; current--) if (messages[current].role === "user") return messages[current].content; return ""; }
function providerName(value: string) { return value ? value.charAt(0).toUpperCase() + value.slice(1) : "AI"; }
function modelLabel(value: string) { return value.replace(/-/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()); }
function formatDate(value: string, locale: string, fallback: string) { const date = new Date(value); return value && !Number.isNaN(date.getTime()) ? new Intl.DateTimeFormat(locale, { year: "numeric", month: "short", day: "numeric" }).format(date) : fallback; }
