"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { LanguageSwitcher } from "../i18n/language-switcher";
import { useI18n } from "../i18n/i18n-provider";
import { roleLevelNames } from "../../lib/i18n/dictionaries";

type AppShellProps = { activeItem: "dashboard" | "settings"; children: ReactNode };

export function AppShell({ activeItem, children }: AppShellProps) {
  const { dictionary, locale, setLocale } = useI18n();
  const router = useRouter();
  const n = dictionary.navigation;
  const d = dictionary.dashboard;
  const [menuOpen, setMenuOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(activeItem);
  const [currentUser, setCurrentUser] = useState<{ first_name: string; last_name: string; role: string; language: "EN" | "DE" | "IT"; hotel_name_en: string; hotel_name_de: string; hotel_name_it: string } | null>(null);

  useEffect(() => {
    fetch("/api/me").then(async (response) => {
      if (!response.ok) return router.replace("/login");
      const user = await response.json();
      setCurrentUser(user);
      setLocale(user.language.toLowerCase());
    }).catch(() => router.replace("/login"));
  }, [router, setLocale]);

  const fullName = currentUser ? `${currentUser.first_name} ${currentUser.last_name}` : "";
  const initials = currentUser ? `${currentUser.first_name[0] ?? ""}${currentUser.last_name[0] ?? ""}`.toUpperCase() : "";
  const hotelName = currentUser ? currentUser[locale === "de" ? "hotel_name_de" : locale === "it" ? "hotel_name_it" : "hotel_name_en"] : "";
  const greeting = d.greeting.replace(/, Klaus$/, "");
  const roleName = currentUser ? roleLevelNames[locale][currentUser.role as keyof typeof roleLevelNames.en] ?? currentUser.role : "";
  const groups = [
    { title: n.overview, items: [["dashboard", "🏠", n.dashboard, ""], ["ai", "✨", n.aiAssistant, n.new]] },
    { title: n.operations, items: [["handovers", "🤝", n.handovers, ""], ["tasks", "✅", n.tasks, "7"], ["housekeeping", "🧹", n.housekeeping, ""], ["repairs", "🔧", n.repairs, "2"], ["notes", "📝", n.notes, ""]] },
    { title: n.staff, items: [["schedule", "📅", n.schedule, ""], ["recruiting", "🔍", n.recruiting, ""], ["manuals", "📖", n.manuals, ""]] },
    { title: n.strategy, items: [["budget", "📊", n.budget, ""], ["revenue", "🎯", n.revenue, ""]] },
    { title: n.administration, items: [["settings", "⚙️", n.settings, ""]] },
  ];

  function navigate(id: string) {
    setSelectedItem(id);
    setMenuOpen(false);
    if (id === "settings") router.push("/settings");
    else router.push("/dashboard");
  }

  return <div className="min-h-screen bg-[var(--qf-background)] lg:flex">
    {menuOpen ? <button aria-label="Close menu" className="fixed inset-0 z-40 cursor-pointer bg-black/40 lg:hidden" onClick={() => setMenuOpen(false)} /> : null}
    <aside className={`fixed inset-y-0 left-0 z-50 flex w-[220px] flex-col overflow-y-auto bg-[var(--qf-navy)] text-white transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${menuOpen ? "translate-x-0" : "-translate-x-full"}`}>
      <div className="flex items-center gap-3 border-b border-white/[.07] px-[18px] py-4"><div className="rounded-lg bg-white p-1"><Image src="/logo-icon.png" alt="" width={32} height={32} className="h-8 w-8 rounded-md object-contain" /></div><div className="min-w-0"><p className="truncate text-[13px] font-bold">{hotelName || "QualityFriend"}</p><p className="mt-0.5 text-[10px] text-white/35">{dictionary.common.brandSubtitle}</p></div></div>
      <nav className="flex-1 py-1">{groups.map((group) => <div key={group.title} className="px-2.5 pb-1 pt-3.5"><p className="px-2 pb-1.5 text-[9px] font-semibold uppercase tracking-[1.1px] text-white/30">{group.title}</p>{group.items.map(([id, icon, label, badge]) => { const active = selectedItem === id; return <button key={id} type="button" onClick={() => navigate(id)} className={`mb-px flex w-full cursor-pointer items-center gap-2 rounded-[6px] px-2.5 py-1.5 text-left text-[11.5px] leading-4 transition ${active ? "bg-[var(--qf-accent)] font-semibold text-white" : "text-white/60 hover:bg-[var(--qf-navy-hover)] hover:text-white"}`}><span className="w-4 text-center text-[12px]">{icon}</span><span className="min-w-0 flex-1">{label}</span>{badge ? <span className={`rounded-full px-1.5 py-px text-[8px] font-bold text-white ${badge === n.new ? "bg-[#7c3aed]" : badge === "2" ? "bg-[var(--qf-danger)]" : "bg-[#d97706]"}`}>{badge}</span> : null}</button>; })}</div>)}</nav>
      <div className="border-t border-white/[.07] p-2.5"><div className="flex items-center gap-2.5 rounded-[7px] px-2.5 py-2"><div className="flex h-[30px] w-[30px] items-center justify-center rounded-full bg-[var(--qf-accent)] text-xs font-bold">{initials}</div><div className="min-w-0"><p className="truncate text-[11.5px] font-medium text-white/85">{fullName}</p><p className="text-[9.5px] text-white/35">{roleName}</p></div></div></div>
    </aside>
    <div className="min-w-0 flex-1"><header className="sticky top-0 z-30 flex min-h-14 items-center gap-3 border-b border-[var(--qf-border)] bg-white px-4 lg:px-7"><button type="button" onClick={() => setMenuOpen(true)} className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-[var(--qf-border)] text-lg lg:hidden" aria-label="Open menu">☰</button><div className="min-w-0"><p className="truncate text-[16px] font-bold">{greeting}{currentUser ? `, ${currentUser.first_name}` : ""}</p><p className="text-[11px] text-[var(--qf-text-muted)] sm:hidden">{d.date}</p></div><p className="hidden text-[13px] text-[var(--qf-text-muted)] sm:block">{d.date}</p><div className="ml-auto flex items-center gap-2"><div className="hidden xl:block"><LanguageSwitcher iconOnly /></div><button type="button" className="hidden h-9 cursor-pointer items-center gap-1.5 rounded-[7px] bg-[#7c3aed] px-3.5 text-[13px] font-semibold text-white md:flex">⚡ {d.report}</button><button type="button" className="hidden h-9 cursor-pointer items-center rounded-[7px] bg-[var(--qf-accent)] px-3.5 text-[13px] font-semibold text-white sm:flex">+ {d.addTask}</button><button type="button" aria-label="Notifications" className="relative flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-[var(--qf-border)] bg-white">🔔<span className="absolute right-1 top-1 h-2 w-2 rounded-full border-2 border-white bg-[var(--qf-danger)]" /></button></div></header>{children}</div>
  </div>;
}
