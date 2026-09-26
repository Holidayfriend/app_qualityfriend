"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { AppShell } from "../../components/dashboard/app-shell";
import { useI18n } from "../../components/i18n/i18n-provider";

const copy = {
  de: {
    page: "KI-Assistent",
    list: "KI-Assistenten",
    settings: "Einstellungen",
    connected: "Verbunden mit deinen Betriebsdaten · Weihrerhof",
    placeholder: "Frage stellen, Aufgabe beschreiben...",
    send: "Senden",
    thinking: "Suche in den Hoteldaten…",
    loading: "Unterhaltung wird geladen…",
    failed: "Die Antwort konnte nicht geladen werden.",
    manualsHello: "Ich beantworte Fragen aus euren Handbüchern. Frag zum Beispiel nach einem Ablauf oder einer Richtlinie.",
    recruitingHello: "Ich helfe mit Stellenanzeigen, Bewerbungen und Lebensläufen. Frag z. B. nach der Anzahl Bewerbungen oder nach der Erfahrung einer Person (mit Namen).",
    scheduleHello: "Ich sehe euren Dienstplan, Urlaub und Tauschanfragen. Frag z. B. wer diese Woche arbeitet, wo Lücken sind oder wie ihr Urlaub abdecken könnt.",
    generalHello: "Guten Morgen! Ich antworte aus Dienstplan, Handbüchern, Recruiting, Housekeeping (Zimmer, Reservierungen, Checklisten) und Reparaturen — für die Bereiche, die du öffnen darfst.",
    demo: "(Demo-Antwort) Ich habe deine Anfrage erhalten: „{text}“. Im echten System würde hier die KI-Antwort basierend auf euren Betriebsdaten erscheinen.",
    assistants: [
      ["✨", "Allgemeiner Assistent", "Fragen, Analysen, Ideen", "general"],
      ["📝", "Übergabe schreiben", "Schichtübergabe generieren", "handover"],
      ["⭐", "Rezension beantworten", "TripAdvisor / Google", "review"],
      ["📊", "Budget-Analyse", "Zahlen erklären & forecasen", "budget"],
      ["🔍", "Recruiting-Hilfe", "Stellenanzeigen & Interviews", "recruiting"],
      ["📖", "Handbücher", "Dokumente & Abläufe", "manuals"],
      ["📅", "Dienstplan optimieren", "Schichten & Urlaubsplanung", "schedule"],
    ],
  },
  en: {
    page: "AI Assistant",
    list: "AI Assistants",
    settings: "Settings",
    connected: "Connected to your operational data · Weihrerhof",
    placeholder: "Ask a question, describe a task...",
    send: "Send",
    thinking: "Searching hotel data…",
    loading: "Loading conversation…",
    failed: "The answer could not be loaded.",
    manualsHello: "I answer from your hotel manuals. Ask about a procedure or policy.",
    recruitingHello: "I help with job ads, applications, and CVs. Ask for application counts, or name a candidate to check experience.",
    scheduleHello: "I can see your roster, time off, and swap requests. Ask who works this week, where coverage is thin, or how to cover vacation.",
    generalHello: "Good morning! I can answer from the roster, handbooks, recruiting, housekeeping (rooms, reservations, checklists), and repairs — for the areas you can open.",
    demo: "(Demo response) I received your request: “{text}”. In the real system, the AI response based on your operational data would appear here.",
    assistants: [
      ["✨", "General Assistant", "Questions, analyses, ideas", "general"],
      ["📝", "Write a handover", "Generate a shift handover", "handover"],
      ["⭐", "Reply to a review", "TripAdvisor / Google", "review"],
      ["📊", "Budget analysis", "Explain numbers & forecast", "budget"],
      ["🔍", "Recruiting help", "Job ads & interviews", "recruiting"],
      ["📖", "Manuals", "Documents & procedures", "manuals"],
      ["📅", "Optimize schedule", "Shifts & vacation planning", "schedule"],
    ],
  },
  it: {
    page: "Assistente IA",
    list: "Assistenti IA",
    settings: "Impostazioni",
    connected: "Collegato ai dati operativi · Weihrerhof",
    placeholder: "Fai una domanda, descrivi un'attività...",
    send: "Invia",
    thinking: "Cerco nei dati dell’hotel…",
    loading: "Caricamento conversazione…",
    failed: "Impossibile caricare la risposta.",
    manualsHello: "Rispondo usando i vostri manuali. Chiedi una procedura o una policy.",
    recruitingHello: "Aiuto con annunci, candidature e CV. Chiedi i numeri o indica un candidato per l’esperienza.",
    scheduleHello: "Vedo i turni, ferie e richieste di scambio. Chiedi chi lavora questa settimana, dove manca copertura o come coprire le ferie.",
    generalHello: "Buongiorno! Rispondo da turni, manuali, recruiting, housekeeping (camere, prenotazioni, checklist) e riparazioni — per le aree che puoi aprire.",
    demo: "(Risposta demo) Ho ricevuto la richiesta: “{text}”. Nel sistema reale apparirebbe qui la risposta IA basata sui dati operativi.",
    assistants: [
      ["✨", "Assistente generale", "Domande, analisi, idee", "general"],
      ["📝", "Scrivi una consegna", "Genera consegna del turno", "handover"],
      ["⭐", "Rispondi a una recensione", "TripAdvisor / Google", "review"],
      ["📊", "Analisi budget", "Spiega dati e previsioni", "budget"],
      ["🔍", "Aiuto recruiting", "Annunci e colloqui", "recruiting"],
      ["📖", "Manuali", "Documenti e procedure", "manuals"],
      ["📅", "Ottimizza turni", "Turni e ferie", "schedule"],
    ],
  },
} as const;

type Message = { side: "ai" | "user"; body: string; time: string };

function now(locale: string) {
  return new Date().toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
}

function clock(value: string | undefined, locale: string) {
  if (!value) return now(locale);
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? now(locale) : date.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
}

function starter(id: string, locale: "en" | "de" | "it", t: (typeof copy)[typeof locale]): Message[] {
  if (id === "manuals") return [{ side: "ai", time: now(locale), body: t.manualsHello }];
  if (id === "recruiting") return [{ side: "ai", time: now(locale), body: t.recruitingHello }];
  if (id === "schedule") return [{ side: "ai", time: now(locale), body: t.scheduleHello }];
  if (id === "general") return [{ side: "ai", time: now(locale), body: t.generalHello }];
  return [];
}

export default function Page() {
  const { locale } = useI18n();
  const t = copy[locale];
  const [input, setInput] = useState("");
  const [selected, setSelected] = useState(0);
  const [busy, setBusy] = useState(false);
  const [loadingThread, setLoadingThread] = useState(true);
  const box = useRef<HTMLDivElement>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const assistant = t.assistants[selected];
  const assistantKey = assistant[3];
  const liveMode = assistantKey === "manuals" || assistantKey === "recruiting" || assistantKey === "schedule" || assistantKey === "general";

  useEffect(() => { if (box.current) box.current.scrollTop = box.current.scrollHeight; }, [messages, busy, loadingThread]);

  useEffect(() => {
    let cancelled = false;
    setLoadingThread(true);
    setMessages([]);
    fetch(`/api/ai/conversations?assistant=${assistantKey}`, { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (cancelled) return;
        const stored = Array.isArray(data.messages)
          ? data.messages.flatMap((item: { role?: string; content?: string; createdAt?: string }) => {
              if ((item?.role !== "user" && item?.role !== "assistant") || typeof item.content !== "string") return [];
              return [{ side: item.role === "user" ? "user" as const : "ai" as const, body: item.content, time: clock(item.createdAt, locale) }];
            })
          : [];
        setMessages(stored.length ? stored : starter(assistantKey, locale, copy[locale]));
      })
      .catch(() => {
        if (!cancelled) setMessages(starter(assistantKey, locale, copy[locale]));
      })
      .finally(() => {
        if (!cancelled) setLoadingThread(false);
      });
    return () => { cancelled = true; };
  }, [assistantKey, locale]);

  function pick(index: number) {
    setSelected(index);
    setInput("");
  }

  async function send(event: FormEvent) {
    event.preventDefault();
    const text = input.trim();
    if (!text || busy || loadingThread) return;
    const time = now(locale);
    setInput("");
    setMessages((current) => [...current, { side: "user", body: text, time }]);
    setBusy(true);
    try {
      const response = await fetch("/api/ai/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assistant: assistantKey, message: text, locale }),
      });
      const data = await response.json();
      setMessages((current) => [...current, { side: "ai", body: response.ok && typeof data.answer === "string" ? data.answer : t.failed, time: now(locale) }]);
    } catch {
      setMessages((current) => [...current, { side: "ai", body: t.failed, time: now(locale) }]);
    } finally {
      setBusy(false);
    }
  }

  return <AppShell activeItem="ai" pageTitle={t.page}>
    <main className="flex h-[calc(100vh-56px)] overflow-hidden bg-[var(--qf-background)]">
      <aside className="hidden w-[260px] shrink-0 overflow-y-auto border-r border-[var(--qf-border)] md:block">
        <h2 className="border-b border-[var(--qf-border)] px-4 py-3 text-[12px] font-bold uppercase tracking-[.5px] text-[var(--qf-text-muted)]">{t.list}</h2>
        {t.assistants.map((item, index) => <button key={item[3]} type="button" onClick={() => pick(index)} className={`block w-full cursor-pointer border-b border-[var(--qf-border)] px-4 py-3 text-left ${selected === index ? "border-l-[3px] border-l-[var(--qf-accent)] bg-[var(--qf-accent-soft)]" : "hover:bg-[var(--qf-background)]"}`}>
          <span className="mb-1 block text-[20px]">{item[0]}</span>
          <strong className="block text-[13px] font-semibold">{item[1]}</strong>
          <span className="mt-0.5 block text-[12px] text-[var(--qf-text-muted)]">{item[2]}</span>
        </button>)}
      </aside>
      <section className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex items-center gap-3 border-b border-[var(--qf-border)] bg-white px-5 py-[14px]">
          <span className="text-[24px]">{assistant[0]}</span>
          <div>
            <h1 className="text-[15px] font-bold">{assistant[1]}</h1>
            <p className="text-[12px] text-[var(--qf-text-muted)]">{t.connected}</p>
          </div>
          <Link href="/settings" className="ml-auto inline-flex items-center gap-1.5 rounded-[7px] border border-[var(--qf-border)] px-[14px] py-[7px] text-[12px] font-semibold text-[var(--qf-text-muted)]">⚙️ {t.settings}</Link>
        </header>
        <div ref={box} className="flex flex-1 flex-col gap-[14px] overflow-y-auto p-5">
          {messages.map((message, index) => <div key={`${message.time}-${index}`} className={`flex max-w-[70%] flex-col gap-1 max-md:max-w-[90%] ${message.side === "user" ? "self-end items-end" : "self-start"}`}>
            <div className={`whitespace-pre-line rounded-[12px] px-[14px] py-[10px] text-[13.5px] leading-[1.55] ${message.side === "user" ? "rounded-br-[2px] bg-[var(--qf-accent)] text-white" : "rounded-bl-[2px] border border-[var(--qf-border)] bg-white"}`}>{message.body}</div>
            <time className="text-[11px] text-[var(--qf-text-light)]">{message.time}</time>
          </div>)}
          {loadingThread ? <p className="text-[12px] text-[var(--qf-text-muted)]">{t.loading}</p> : null}
          {busy ? <p className="text-[12px] text-[var(--qf-text-muted)]">{liveMode ? t.thinking : t.loading}</p> : null}
        </div>
        <form onSubmit={(event) => void send(event)} className="flex gap-[10px] border-t border-[var(--qf-border)] bg-white px-5 py-[14px]">
          <input value={input} onChange={(event) => setInput(event.target.value)} className="min-w-0 flex-1 rounded-[8px] border border-[var(--qf-border)] px-[14px] py-[10px] text-[14px] outline-none focus:border-[var(--qf-accent)]" placeholder={t.placeholder} />
          <button type="submit" disabled={busy || loadingThread} className="rounded-[8px] bg-[var(--qf-accent)] px-[18px] py-[10px] text-[13px] font-semibold text-white disabled:opacity-50">{t.send} ↑</button>
        </form>
      </section>
    </main>
  </AppShell>;
}
