"use client";
/* eslint-disable @next/next/no-img-element -- authenticated blob URLs cannot use the Next image optimizer */

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { AppShell } from "../../components/dashboard/app-shell";
import { BrandLoader } from "../../components/ui/brand-loader";
import { useI18n } from "../../components/i18n/i18n-provider";
import { formatHotelDateTime, formatHotelTime, readHotelTimeZone } from "../../lib/hotel/clock";
import { roleLevelNames } from "../../lib/i18n/dictionaries";

type ChannelKind = "user" | "team" | "department";
type ChatUser = { kind: "user"; id: string; first_name: string; last_name: string; role: string; role_names?: Record<"en" | "de" | "it", string>; last_message: string | null; unread_count: number; is_online: boolean; last_seen_at: string | null };
type ChatGroup = { kind: "team" | "department"; id: string; name_en: string; name_de: string; name_it: string; member_count: number; is_member: boolean; last_message: string | null; unread_count: number };
type Selection = ChatUser | ChatGroup;
type Message = { id: string; sender_id: string; sender_name?: string | null; type: "TEXT" | "DOCUMENT" | "IMAGE" | "VIDEO" | "VOICE"; text: string | null; attachment_name: string | null; attachment_size: number | null; created_at: string };
const copy = {
  en: { title: "Team chat", people: "People", teams: "Teams", departments: "Departments", searchPeople: "Search people", searchTeams: "Search teams", searchDepartments: "Search departments", empty: "Select a person, team, or department to start chatting.", message: "Write a message...", send: "Send", document: "Document", image: "Photo", video: "Video", voice: "Voice message", open: "Tap to open", download: "Download", max: "Maximum attachment size is 25 MB.", failed: "Message could not be sent.", noUsers: "No other active users.", noTeams: "No active teams.", noDepartments: "No active departments.", record: "Record voice message", stop: "Stop recording", loading: "Loading media...", mediaError: "Media could not be loaded.", micError: "Microphone access was not available.", online: "Online", lastSeen: "Last seen", member: "member", members: "members", yours: "Yours" },
  de: { title: "Team-Chat", people: "Personen", teams: "Teams", departments: "Abteilungen", searchPeople: "Personen suchen", searchTeams: "Teams suchen", searchDepartments: "Abteilungen suchen", empty: "Wählen Sie eine Person, ein Team oder eine Abteilung.", message: "Nachricht schreiben...", send: "Senden", document: "Dokument", image: "Foto", video: "Video", voice: "Sprachnachricht", open: "Tippen zum Öffnen", download: "Herunterladen", max: "Maximale Dateigröße: 25 MB.", failed: "Nachricht konnte nicht gesendet werden.", noUsers: "Keine weiteren aktiven Benutzer.", noTeams: "Keine aktiven Teams.", noDepartments: "Keine aktiven Abteilungen.", record: "Sprachnachricht aufnehmen", stop: "Aufnahme stoppen", loading: "Medium wird geladen...", mediaError: "Medium konnte nicht geladen werden.", micError: "Kein Zugriff auf das Mikrofon.", online: "Online", lastSeen: "Zuletzt gesehen", member: "Mitglied", members: "Mitglieder", yours: "Ihr Bereich" },
  it: { title: "Chat del team", people: "Persone", teams: "Team", departments: "Reparti", searchPeople: "Cerca persone", searchTeams: "Cerca team", searchDepartments: "Cerca reparti", empty: "Seleziona una persona, un team o un reparto.", message: "Scrivi un messaggio...", send: "Invia", document: "Documento", image: "Foto", video: "Video", voice: "Messaggio vocale", open: "Tocca per aprire", download: "Scarica", max: "Dimensione massima allegato: 25 MB.", failed: "Impossibile inviare il messaggio.", noUsers: "Nessun altro utente attivo.", noTeams: "Nessun team attivo.", noDepartments: "Nessun reparto attivo.", record: "Registra messaggio vocale", stop: "Interrompi registrazione", loading: "Caricamento media...", mediaError: "Impossibile caricare il media.", micError: "Accesso al microfono non disponibile.", online: "Online", lastSeen: "Ultimo accesso", member: "membro", members: "membri", yours: "Tuo" },
};

function channelPath(item: { kind: ChannelKind; id: string }) {
  if (item.kind === "team") return `/api/chat/teams/${item.id}`;
  if (item.kind === "department") return `/api/chat/departments/${item.id}`;
  return `/api/chat/${item.id}`;
}
function groupName(group: ChatGroup, locale: "en" | "de" | "it") {
  const name = locale === "de" ? group.name_de : locale === "it" ? group.name_it : group.name_en;
  return name || group.name_en;
}

export default function ChatPage() {
  const { locale } = useI18n(); const t = copy[locale];
  const [users, setUsers] = useState<ChatUser[]>([]);
  const [teams, setTeams] = useState<ChatGroup[]>([]);
  const [departments, setDepartments] = useState<ChatGroup[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [me, setMe] = useState("");
  const [tab, setTab] = useState<ChannelKind>("user");
  const [selected, setSelected] = useState<Selection | null>(null);
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [recording, setRecording] = useState(false);
  const [attachmentMenu, setAttachmentMenu] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const messagePane = useRef<HTMLDivElement>(null);
  const messageContent = useRef<HTMLDivElement>(null);
  const scrollToBottom = useRef(true);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const chunks = useRef<Blob[]>([]);
  const selectedKey = selected ? `${selected.kind}:${selected.id}` : "";
  const loadDirectory = useCallback(async () => {
    try {
      const r = await fetch("/api/chat");
      if (!r.ok) return;
      const d = await r.json();
      const nextUsers = (d.users as ChatUser[]).map((user) => ({ ...user, kind: "user" as const }));
      const nextTeams = (d.teams as ChatGroup[]).map((team) => ({ ...team, kind: "team" as const }));
      const nextDepartments = (d.departments as ChatGroup[]).map((department) => ({ ...department, kind: "department" as const }));
      setUsers(nextUsers);
      setTeams(nextTeams);
      setDepartments(nextDepartments);
      setMe(d.currentUserId);
      setSelected((current) => {
        if (!current) return current;
        if (current.kind === "user") return nextUsers.find((user) => user.id === current.id) ?? current;
        if (current.kind === "team") return nextTeams.find((team) => team.id === current.id) ?? current;
        return nextDepartments.find((department) => department.id === current.id) ?? current;
      });
    } finally {
      setLoadingUsers(false);
    }
  }, []);
  const loadMessages = useCallback(async (kind: ChannelKind, id: string, initial = false) => {
    try {
      const r = await fetch(channelPath({ kind, id }));
      if (!r.ok) return;
      const d = await r.json();
      if (initial) setHasMore(d.hasMore);
      setMessages((current) => initial ? d.messages : [...new Map([...current, ...d.messages].map((message: Message) => [message.id, message])).values()].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()));
    } finally {
      if (initial) setLoadingMessages(false);
    }
  }, []);
  useEffect(() => {
    const timer = setTimeout(() => void loadDirectory(), 0);
    const poll = setInterval(() => void loadDirectory(), 5000);
    return () => { clearTimeout(timer); clearInterval(poll); };
  }, [loadDirectory]);
  useEffect(() => {
    if (!selectedKey) return;
    const separator = selectedKey.indexOf(":");
    const kind = selectedKey.slice(0, separator) as ChannelKind;
    const id = selectedKey.slice(separator + 1);
    scrollToBottom.current = true;
    const initial = setTimeout(() => void loadMessages(kind, id, true), 0);
    const timer = setInterval(() => void loadMessages(kind, id), 5000);
    return () => { clearTimeout(initial); clearInterval(timer); };
  }, [selectedKey, loadMessages]);
  useEffect(() => {
    const pane = messagePane.current;
    if (!pane || !scrollToBottom.current) return;
    const pin = () => { pane.scrollTop = pane.scrollHeight; };
    pin();
    const first = requestAnimationFrame(pin);
    const timers = [setTimeout(pin, 100), setTimeout(pin, 350), setTimeout(pin, 800), setTimeout(() => { pin(); scrollToBottom.current = false; }, 1400)];
    return () => { cancelAnimationFrame(first); timers.forEach(clearTimeout); };
  }, [messages]);
  useEffect(() => {
    const content = messageContent.current;
    if (!content) return;
    const observer = new ResizeObserver(() => { const pane = messagePane.current; if (pane && scrollToBottom.current) pane.scrollTop = pane.scrollHeight; });
    observer.observe(content);
    return () => observer.disconnect();
  }, [selectedKey]);
  useEffect(() => () => { stream.current?.getTracks().forEach((track) => track.stop()); }, []);

  async function toggleRecording() {
    if (recording) { recorder.current?.stop(); return; }
    try {
      const microphone = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.current = microphone;
      chunks.current = [];
      const mediaRecorder = new MediaRecorder(microphone);
      recorder.current = mediaRecorder;
      mediaRecorder.ondataavailable = (e) => { if (e.data.size) chunks.current.push(e.data); };
      mediaRecorder.onstop = () => { const mime = mediaRecorder.mimeType || "audio/webm"; const blob = new Blob(chunks.current, { type: mime }); setFile(new File([blob], `voice-${Date.now()}.webm`, { type: mime })); setRecording(false); microphone.getTracks().forEach((track) => track.stop()); };
      mediaRecorder.start();
      setRecording(true);
      setError("");
    } catch { setError(t.micError); }
  }
  async function send(e: FormEvent) {
    e.preventDefault();
    if (!selected || (!text.trim() && !file)) return;
    if (file && file.size > 25 * 1024 * 1024) { setError(t.max); return; }
    setSending(true);
    setError("");
    const form = new FormData();
    form.append("text", text);
    if (file) form.append("attachment", file);
    try {
      const r = await fetch(channelPath(selected), { method: "POST", body: form });
      const d = await r.json();
      if (!r.ok) throw new Error();
      scrollToBottom.current = true;
      setMessages((v) => [...v, d.message]);
      setText("");
      setFile(null);
      void loadDirectory();
    } catch { setError(t.failed); } finally { setSending(false); }
  }
  async function loadOlder() {
    const pane = messagePane.current;
    if (!selected || !pane || !hasMore || loadingOlder || !messages[0]) return;
    setLoadingOlder(true);
    const previousHeight = pane.scrollHeight;
    try {
      const r = await fetch(`${channelPath(selected)}?before=${encodeURIComponent(messages[0].created_at)}`);
      if (r.ok) {
        const d = await r.json();
        setHasMore(d.hasMore);
        setMessages((current) => [...d.messages, ...current]);
        requestAnimationFrame(() => { if (messagePane.current) messagePane.current.scrollTop = messagePane.current.scrollHeight - previousHeight; });
      }
    } finally { setLoadingOlder(false); }
  }
  function openChannel(item: Selection) {
    setMessages([]);
    setLoadingMessages(true);
    setSelected(item);
    setTab(item.kind);
    setError("");
    setAttachmentMenu(false);
  }
  const query = search.toLowerCase();
  const shownUsers = users.filter((user) => `${user.first_name} ${user.last_name}`.toLowerCase().includes(query));
  const byName = (a: ChatGroup, b: ChatGroup) => groupName(a, locale).localeCompare(groupName(b, locale), locale, { sensitivity: "base" });
  const shownTeams = teams.filter((team) => `${team.name_en} ${team.name_de} ${team.name_it}`.toLowerCase().includes(query)).sort(byName);
  const shownDepartments = departments.filter((department) => `${department.name_en} ${department.name_de} ${department.name_it}`.toLowerCase().includes(query)).sort(byName);
  const tabs: { kind: ChannelKind; label: string; unread: number }[] = [
    { kind: "user", label: t.people, unread: users.reduce((sum, user) => sum + user.unread_count, 0) },
    { kind: "team", label: t.teams, unread: teams.reduce((sum, team) => sum + team.unread_count, 0) },
    { kind: "department", label: t.departments, unread: departments.reduce((sum, department) => sum + department.unread_count, 0) },
  ];
  const searchPlaceholder = tab === "team" ? t.searchTeams : tab === "department" ? t.searchDepartments : t.searchPeople;
  const emptyList = tab === "team" ? t.noTeams : tab === "department" ? t.noDepartments : t.noUsers;
  const list = tab === "team" ? shownTeams : tab === "department" ? shownDepartments : shownUsers;

  return <AppShell activeItem="chat"><main className="fixed inset-x-0 bottom-0 top-14 z-20 !h-[calc(100dvh-3.5rem)] overflow-hidden bg-white lg:left-[220px]">{loadingUsers ? <div className="absolute inset-0 z-40 flex items-center justify-center bg-white"><BrandLoader label={t.loading} /></div> : null}<div className="flex h-full min-h-0 overflow-hidden">
    <aside className={`${selected ? "hidden md:grid" : "grid"} h-full min-h-0 w-full shrink-0 grid-rows-[auto_minmax(0,1fr)] border-r border-[var(--qf-border)] md:w-[290px]`}>
      <header className="border-b border-[var(--qf-border)] px-3 py-2.5">
        <h1 className="text-sm font-bold">{t.title}</h1>
        <div className="mt-2 grid grid-cols-3 gap-1 rounded-lg bg-[var(--qf-background)] p-0.5" role="tablist">
          {tabs.map((item) => <button key={item.kind} type="button" role="tab" aria-selected={tab === item.kind} onClick={() => { setTab(item.kind); setSearch(""); }} className={`cursor-pointer rounded-md px-0.5 py-1 text-center text-[10px] font-semibold leading-none ${tab === item.kind ? "bg-white text-[var(--qf-text)] shadow-sm" : "text-[var(--qf-text-muted)]"}`}>{item.label}{item.unread > 0 ? <span className="ml-1 inline-flex min-w-4 justify-center rounded-full bg-[var(--qf-accent)] px-1 text-[9px] text-white">{Math.min(item.unread, 99)}</span> : null}</button>)}
        </div>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={searchPlaceholder} className="mt-2 h-8 w-full rounded-lg border border-[var(--qf-border)] bg-[var(--qf-background)] px-3 text-[13px] outline-none focus:border-[var(--qf-accent)]" />
      </header>
      <div className="flex-1 overflow-y-auto">
        {tab === "user" ? shownUsers.map((user) => <button key={user.id} onClick={() => openChannel(user)} className={`flex w-full cursor-pointer items-center gap-3 border-b border-[var(--qf-border)] p-3.5 text-left hover:bg-[var(--qf-background)] ${selected?.kind === "user" && selected.id === user.id ? "bg-[var(--qf-background)]" : ""}`}><Avatar user={user} /><span className="min-w-0 flex-1"><b className="block truncate text-[13px]">{user.first_name} {user.last_name}</b><span className="block truncate text-[11px] text-[var(--qf-text-muted)]">{user.last_message || (user.role_names?.[locale] ?? roleLevelNames[locale][user.role as keyof typeof roleLevelNames.en] ?? user.role)}</span></span>{user.unread_count > 0 ? <span className="rounded-full bg-[var(--qf-accent)] px-2 py-0.5 text-[10px] font-bold text-white">{user.unread_count}</span> : null}</button>) : list.map((group) => {
          const item = group as ChatGroup;
          const title = groupName(item, locale);
          return <button key={item.id} onClick={() => openChannel(item)} className={`flex w-full cursor-pointer items-center gap-3 border-b border-[var(--qf-border)] p-3.5 text-left hover:bg-[var(--qf-background)] ${selected?.kind === item.kind && selected.id === item.id ? "bg-[var(--qf-background)]" : ""}`}><GroupAvatar kind={item.kind} /><span className="min-w-0 flex-1"><b className="block truncate text-[13px]">{title}{item.is_member ? <span className="ml-1 text-[10px] font-semibold text-[var(--qf-accent)]">{t.yours}</span> : null}</b><span className="block truncate text-[11px] text-[var(--qf-text-muted)]">{item.last_message || memberLabel(item.member_count, t)}</span></span>{item.unread_count > 0 ? <span className="rounded-full bg-[var(--qf-accent)] px-2 py-0.5 text-[10px] font-bold text-white">{item.unread_count}</span> : null}</button>;
        })}
        {!list.length ? <p className="p-8 text-center text-xs text-[var(--qf-text-muted)]">{emptyList}</p> : null}
      </div>
    </aside>
    <section className={`${selected ? "grid" : "hidden md:grid"} h-full min-h-0 min-w-0 flex-1 grid-rows-[52px_minmax(0,1fr)_auto] overflow-hidden`}>{selected ? <>
      <header className="flex h-[52px] shrink-0 items-center gap-3 border-b border-[var(--qf-border)] px-3 sm:px-5">
        <button onClick={() => setSelected(null)} className="h-9 w-9 cursor-pointer text-xl md:hidden">←</button>
        {selected.kind === "user" ? <Avatar user={selected} /> : <GroupAvatar kind={selected.kind} />}
        <div className="min-w-0">{selected.kind === "user" ? <><b className="block truncate text-sm">{selected.first_name} {selected.last_name}</b><p className={`text-[11px] ${selected.is_online ? "font-semibold text-green-600" : "text-[var(--qf-text-muted)]"}`}>{presence(selected, t, locale)}</p></> : <><b className="block truncate text-sm">{groupName(selected, locale)}</b><p className="text-[11px] text-[var(--qf-text-muted)]">{memberLabel(selected.member_count, t)}{selected.is_member ? ` · ${t.yours}` : ""}</p></>}</div>
      </header>
      <div ref={messagePane} onScroll={(event) => { if (event.currentTarget.scrollTop < 80 && !scrollToBottom.current) void loadOlder(); }} className="relative min-h-0 overflow-y-auto overscroll-contain bg-[var(--qf-background)] px-3 py-2 sm:px-4">{loadingMessages ? <div className="absolute inset-0 flex items-center justify-center bg-[var(--qf-background)]"><BrandLoader label={t.loading} /></div> : <div ref={messageContent} className="flex w-full flex-col gap-1.5">{loadingOlder ? <p className="py-1 text-center text-xs text-[var(--qf-text-muted)]">…</p> : null}{!hasMore && messages.length ? <p className="py-1 text-center text-[10px] text-[var(--qf-text-light)]">—</p> : null}{messages.map((message) => <Bubble key={message.id} message={message} own={message.sender_id === me} showSender={selected.kind !== "user"} t={t} locale={locale} />)}</div>}</div>
      <form onSubmit={send} className="relative shrink-0 border-t border-[var(--qf-border)] bg-white p-2">
        {file ? <div className="mb-2 flex w-full justify-between rounded-lg bg-[var(--qf-accent-soft)] px-3 py-2 text-xs"><span className="truncate">{file.type.startsWith("audio/") ? "🎤" : "📎"} {file.name} · {fileSize(file.size)}</span><button type="button" onClick={() => setFile(null)} className="cursor-pointer">×</button></div> : null}{error ? <p className="mb-2 w-full text-xs text-[var(--qf-danger)]">{error}</p> : null}
        {attachmentMenu ? <div className="absolute bottom-14 left-3 z-20 w-56 overflow-hidden rounded-xl border border-[var(--qf-border)] bg-white py-1.5 shadow-xl"><AttachmentChoice icon="📄" color="bg-violet-600" label={t.document} accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip" onFile={(value) => { setFile(value); setAttachmentMenu(false); }} /><AttachmentChoice icon="🖼" color="bg-blue-500" label={`${t.image} & ${t.video}`} accept="image/*,video/*" onFile={(value) => { setFile(value); setAttachmentMenu(false); }} /><AttachmentChoice icon="🎧" color="bg-orange-500" label={t.voice} accept="audio/*" onFile={(value) => { setFile(value); setAttachmentMenu(false); }} /></div> : null}
        <div className="flex w-full items-end gap-2"><button type="button" onClick={() => setAttachmentMenu((value) => !value)} aria-label="Add attachment" className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full text-2xl font-light text-[var(--qf-text-muted)] hover:bg-[var(--qf-background)]">+</button><textarea rows={1} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); e.currentTarget.form?.requestSubmit(); } }} placeholder={t.message} className="max-h-24 min-h-9 flex-1 resize-none rounded-[18px] border border-[var(--qf-border)] bg-[var(--qf-background)] px-3 py-2 text-[13px] leading-4 outline-none focus:border-[var(--qf-accent)]" />{text.trim() || file ? <button type="submit" disabled={sending || recording} aria-label={t.send} className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full bg-[var(--qf-accent)] text-white disabled:opacity-50">{sending ? "…" : <SendIcon />}</button> : <button type="button" onClick={() => void toggleRecording()} title={recording ? t.stop : t.record} className={`flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full ${recording ? "animate-pulse bg-red-500 text-white" : "text-[var(--qf-text-muted)] hover:bg-[var(--qf-background)]"}`}>{recording ? <span className="text-sm">■</span> : <MicIcon />}</button>}</div>
      </form>
    </> : <div className="m-auto px-6 text-center"><div className="mb-3 text-4xl">💬</div><p className="text-sm text-[var(--qf-text-muted)]">{t.empty}</p></div>}</section>
  </div></main></AppShell>;
}

function memberLabel(count: number, t: typeof copy.en) { return `${count} ${count === 1 ? t.member : t.members}`; }
function Avatar({ user }: { user: ChatUser }) { return <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--qf-accent-soft)] text-xs font-bold text-[var(--qf-accent)]">{user.first_name[0]}{user.last_name[0]}{user.is_online ? <span title="Online" className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white bg-green-500" /> : null}</span>; }
function GroupAvatar({ kind }: { kind: "team" | "department" }) { return <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-base ${kind === "team" ? "bg-teal-100" : "bg-amber-100"}`}>{kind === "team" ? "👥" : "🏢"}</span>; }
function presence(user: ChatUser, t: typeof copy.en, locale: "en" | "de" | "it") { if (user.is_online) return t.online; if (!user.last_seen_at) return (user.role_names?.[locale] ?? roleLevelNames[locale][user.role as keyof typeof roleLevelNames.en] ?? user.role); return `${t.lastSeen} ${formatHotelDateTime(new Date(user.last_seen_at), locale, readHotelTimeZone())}`; }
function fileSize(bytes: number) { return bytes < 1024 ? `${bytes} B` : bytes < 1048576 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1048576).toFixed(1)} MB`; }

function Bubble({ message, own, showSender, t, locale }: { message: Message; own: boolean; showSender: boolean; t: typeof copy.en; locale: "en" | "de" | "it" }) {
  const media = message.type === "IMAGE" || message.type === "VIDEO" || message.type === "VOICE";
  return <div className={`flex w-full ${own ? "justify-end" : "justify-start"}`}><div className={`${media ? "w-[min(440px,92%)]" : "w-fit max-w-[75%]"} overflow-hidden rounded-[10px] text-[13px] leading-4 shadow-sm ${own ? "rounded-br-sm bg-[var(--qf-accent)] text-white" : "rounded-bl-sm border border-[var(--qf-border)] bg-white"}`}>
    {showSender && !own && message.sender_name ? <p className="px-2.5 pt-1 text-[10px] font-bold leading-none text-[var(--qf-accent)]">{message.sender_name}</p> : null}
    {message.attachment_name ? <LazyAttachment message={message} own={own} t={t} /> : null}
    {message.text ? <p className="whitespace-pre-wrap break-words px-2.5 pt-1">{message.text}</p> : null}
    <p className={`px-2.5 pb-1 pt-0.5 text-right text-[9px] leading-none ${own ? "text-white/60" : "text-[var(--qf-text-light)]"}`}>{formatHotelTime(new Date(message.created_at), locale, readHotelTimeZone())}</p>
  </div></div>;
}

function LazyAttachment({ message, own, t }: { message: Message; own: boolean; t: typeof copy.en }) {
  const url = `/api/chat/attachments/${message.id}`;
  const labels = { DOCUMENT: t.document, IMAGE: t.image, VIDEO: t.video, VOICE: t.voice };
  if (message.type === "IMAGE") return <button type="button" onClick={() => window.open(url, "_blank")} className="block w-full cursor-pointer bg-black/5"><span className="sr-only">{t.open}</span><img src={url} loading="lazy" alt={message.attachment_name ?? t.image} className="max-h-[420px] min-h-44 w-full object-contain" /></button>;
  if (message.type === "VIDEO") return <div className="bg-black"><video src={url} controls playsInline preload="metadata" className="max-h-[420px] min-h-52 w-full object-contain" /><p className="truncate bg-black px-3 py-1.5 text-[10px] text-white/70">🎬 {message.attachment_name} · {fileSize(message.attachment_size ?? 0)}</p></div>;
  if (message.type === "VOICE") return <div className={`m-2 rounded-lg p-3 ${own ? "bg-white/10" : "bg-[var(--qf-background)]"}`}><div className="mb-2 flex items-center gap-2 text-xs font-semibold"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--qf-accent)] text-white">🎤</span>{t.voice}</div><audio src={url} controls preload="none" className="h-10 w-full max-w-[300px]" /></div>;
  return <div className={`m-2 rounded-lg border p-3 ${own ? "border-white/20 bg-white/10" : "border-[var(--qf-border)] bg-[var(--qf-background)]"}`}><a href={url} target="_blank" rel="noreferrer" className="flex w-full cursor-pointer items-center gap-3 text-left"><span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-black/10 text-2xl">📄</span><span className="min-w-0"><b className="block text-xs">{labels[message.type as keyof typeof labels]}</b><span className="block max-w-52 truncate text-[10px] opacity-70">{message.attachment_name} · {fileSize(message.attachment_size ?? 0)}</span><span className="text-[10px] font-semibold underline">{t.open}</span></span></a><a href={`${url}?download=1`} className="mt-2 inline-block text-[10px] font-semibold underline">{t.download}</a></div>;
}

function AttachmentChoice({ icon, color, label, accept, onFile }: { icon: string; color: string; label: string; accept: string; onFile: (file: File) => void }) { return <label className="flex cursor-pointer items-center gap-3 px-4 py-3 text-sm transition hover:bg-[var(--qf-background)]"><span className={`flex h-9 w-9 items-center justify-center rounded-full text-base text-white ${color}`}>{icon}</span><span>{label}</span><input type="file" accept={accept} className="sr-only" onChange={(event) => { const selected = event.target.files?.[0]; if (selected) onFile(selected); event.target.value = ""; }} /></label>; }
function MicIcon() { return <svg aria-hidden viewBox="0 0 24 24" className="h-6 w-6 fill-none stroke-current" strokeWidth="2" strokeLinecap="round"><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3M9 21h6" /></svg>; }
function SendIcon() { return <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5 fill-current"><path d="M3.4 20.4 21.8 12 3.4 3.6 3 10l12 2-12 2 .4 6.4Z" /></svg>; }
