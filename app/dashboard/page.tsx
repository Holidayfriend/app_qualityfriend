"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { LanguageSwitcher } from "../../components/i18n/language-switcher";
import { useI18n } from "../../components/i18n/i18n-provider";

export default function DashboardPage() {
  const { dictionary, locale } = useI18n();
  const router = useRouter();
  const n = dictionary.navigation;
  const d = dictionary.dashboard;
  const [menuOpen, setMenuOpen] = useState(false);
  const [done, setDone] = useState<number[]>([]);
  const [currentUser, setCurrentUser] = useState<{ first_name: string; last_name: string; role: string; hotel_name_en: string; hotel_name_de: string; hotel_name_it: string } | null>(null);

  useEffect(() => {
    fetch("/api/me").then(async (response) => {
      if (!response.ok) {
        router.replace("/login");
        return;
      }
      setCurrentUser(await response.json());
    }).catch(() => router.replace("/login"));
  }, [router]);

  const fullName = currentUser ? `${currentUser.first_name} ${currentUser.last_name}` : "";
  const initials = currentUser ? `${currentUser.first_name[0] ?? ""}${currentUser.last_name[0] ?? ""}`.toUpperCase() : "";
  const hotelName = currentUser ? currentUser[locale === "de" ? "hotel_name_de" : locale === "it" ? "hotel_name_it" : "hotel_name_en"] : "";
  const greeting = d.greeting.replace(/, Klaus$/, "");

  const groups = [
    { title: n.overview, items: [["🏠", n.dashboard, ""], ["✨", n.aiAssistant, n.new]] },
    { title: n.operations, items: [["🤝", n.handovers, ""], ["✅", n.tasks, "7"], ["🧹", n.housekeeping, ""], ["🔧", n.repairs, "2"], ["📝", n.notes, ""]] },
    { title: n.staff, items: [["📅", n.schedule, ""], ["🔍", n.recruiting, ""], ["📖", n.manuals, ""]] },
    { title: n.strategy, items: [["📊", n.budget, ""], ["🎯", n.revenue, ""]] },
    { title: n.administration, items: [["⚙️", n.settings, ""]] },
  ];

  const tasks = [[d.task1, d.task1Meta], [d.task2, d.task2Meta], [d.task3, d.task3Meta]];

  return (
    <div className="min-h-screen bg-[var(--qf-background)] lg:flex">
      {menuOpen ? <button aria-label="Close menu" className="fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={() => setMenuOpen(false)} /> : null}
      <aside className={`fixed inset-y-0 left-0 z-50 flex w-[220px] flex-col overflow-y-auto bg-[var(--qf-navy)] text-white transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${menuOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex items-center gap-3 border-b border-white/[.07] px-[18px] py-4">
          <div className="rounded-lg bg-white p-1"><Image src="/logo-icon.png" alt="" width={32} height={32} className="h-8 w-8 rounded-md object-contain" /></div>
          <div className="min-w-0"><p className="truncate text-[14px] font-bold">{hotelName || "QualityFriend"}</p><p className="mt-0.5 text-[10.5px] text-white/35">{dictionary.common.brandSubtitle}</p></div>
        </div>
        <nav className="flex-1 py-1">
          {groups.map((group, groupIndex) => (
            <div key={group.title} className="px-2.5 pb-1 pt-3.5">
              <p className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-[1.2px] text-white/30">{group.title}</p>
              {group.items.map(([icon, label, badge], itemIndex) => {
                const active = groupIndex === 0 && itemIndex === 0;
                return <button key={label} type="button" aria-disabled={!active} className={`mb-px flex w-full items-center gap-2 rounded-[7px] px-3 py-[7px] text-left text-[12.5px] transition ${active ? "bg-[var(--qf-accent)] font-semibold text-white" : "cursor-default text-white/60 hover:bg-[var(--qf-navy-hover)] hover:text-white"}`}><span className="w-[17px] text-center text-[13px]">{icon}</span><span className="min-w-0 flex-1">{label}</span>{badge ? <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold text-white ${badge === n.new ? "bg-[#7c3aed]" : badge === "2" ? "bg-[var(--qf-danger)]" : "bg-[#d97706]"}`}>{badge}</span> : null}</button>;
              })}
            </div>
          ))}
        </nav>
        <div className="border-t border-white/[.07] p-2.5">
          <div className="flex items-center gap-2.5 rounded-[7px] px-2.5 py-2">
            <div className="flex h-[30px] w-[30px] items-center justify-center rounded-full bg-[var(--qf-accent)] text-xs font-bold">{initials}</div>
            <div className="min-w-0"><p className="truncate text-[12.5px] font-medium text-white/85">{fullName}</p><p className="text-[10.5px] text-white/35">{currentUser?.role === "USER" ? "User" : n.administrator}</p></div>
          </div>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 flex min-h-14 items-center gap-3 border-b border-[var(--qf-border)] bg-white px-4 lg:px-7">
          <button type="button" onClick={() => setMenuOpen(true)} className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--qf-border)] text-lg lg:hidden" aria-label="Open menu">☰</button>
          <div className="min-w-0"><p className="truncate text-[16px] font-bold">{greeting}{currentUser ? `, ${currentUser.first_name}` : ""}</p><p className="text-[11px] text-[var(--qf-text-muted)] sm:hidden">{d.date}</p></div>
          <p className="hidden text-[13px] text-[var(--qf-text-muted)] sm:block">{d.date}</p>
          <div className="ml-auto flex items-center gap-2">
            <div className="hidden xl:block"><LanguageSwitcher /></div>
            <button type="button" className="hidden h-9 items-center gap-1.5 rounded-[7px] bg-[#7c3aed] px-3.5 text-[13px] font-semibold text-white md:flex">⚡ {d.report}</button>
            <button type="button" className="hidden h-9 items-center rounded-[7px] bg-[var(--qf-accent)] px-3.5 text-[13px] font-semibold text-white sm:flex">+ {d.addTask}</button>
            <button type="button" aria-label="Notifications" className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--qf-border)] bg-white">🔔<span className="absolute right-1 top-1 h-2 w-2 rounded-full border-2 border-white bg-[var(--qf-danger)]" /></button>
          </div>
        </header>

        <main className="p-4 sm:p-5 lg:p-7">
          <section className="mb-[18px] flex flex-col gap-3 rounded-[var(--qf-radius)] border border-[#8b5cf64d] bg-gradient-to-br from-[#1e1b4b] to-[#312e81] px-5 py-4 text-white sm:flex-row sm:items-center">
            <span className="text-[22px]">✨</span><div className="flex-1"><h2 className="text-[13.5px] font-bold">{d.analysisTitle}</h2><p className="mt-1 text-[12.5px] leading-5 text-white/75">{d.analysisBody}</p></div><button type="button" className="self-start whitespace-nowrap rounded-[7px] border border-white/20 bg-white/15 px-3.5 py-2 text-[12.5px] font-semibold sm:self-center">{d.discuss} →</button>
          </section>

          <section className="mb-[22px] grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
            <Kpi label={d.occupancy} value="87" suffix="%" meta={<><Chip color="green">↑ +4%</Chip> {d.vsWeek}</>} />
            <Kpi label={d.arrivals} value="10" suffix=" / 6" meta={d.checkin} />
            <Kpi label={d.roomsReady} value="9" suffix="/12" meta={<><Chip color="red">{d.open}</Chip> {d.express}</>} />
            <Kpi label={d.rating} value="4.9" suffix="/5" meta={<Chip color="blue">{d.reviews}</Chip>} />
          </section>

          <section className="grid items-start gap-[18px] xl:grid-cols-[minmax(0,1fr)_380px]">
            <Card title={`✅ ${d.myTasks}`} action={`${d.showAll} →`}>
              {tasks.map(([title, meta], index) => (
                <button key={title} type="button" onClick={() => setDone((current) => current.includes(index) ? current.filter((item) => item !== index) : [...current, index])} className="flex w-full items-center gap-3 border-b border-[var(--qf-border)] py-3 text-left last:border-0">
                  <span className={`flex h-[19px] w-[19px] shrink-0 items-center justify-center rounded-[5px] border-2 text-[11px] ${done.includes(index) ? "border-[#16a34a] bg-[#16a34a] text-white" : "border-[var(--qf-border)]"}`}>{done.includes(index) ? "✓" : ""}</span>
                  <span className="min-w-0 flex-1"><span className={`block text-[13.5px] font-medium ${done.includes(index) ? "text-[var(--qf-text-light)] line-through" : ""}`}>{title}</span><span className="mt-0.5 block text-xs text-[var(--qf-text-muted)]">{meta}</span></span>
                </button>
              ))}
            </Card>

            <div className="space-y-[18px]">
              <div className="flex items-center gap-3.5 rounded-[var(--qf-radius)] bg-gradient-to-br from-[var(--qf-navy)] to-[var(--qf-navy-hover)] px-5 py-3.5 text-white"><span className="text-4xl">⛅</span><div><p className="text-2xl font-bold">18°</p><p className="text-xs text-white/60">{d.weather}</p></div><div className="ml-auto text-right text-[11px] leading-5 text-white/55">{d.rain}<br />{d.wind}<br />{d.uv}</div></div>
              <Card title={`🧹 ${n.housekeeping}`} action={`${d.showAll} →`}>
                <div className="mb-3 grid grid-cols-4 gap-2"><Status value="3" label={d.dirty} tone="red" /><Status value="2" label={d.cleaning} tone="amber" /><Status value="6" label={d.ready} tone="green" /><Status value="3" label={d.inspected} tone="blue" /></div><p className="text-[12.5px] leading-5 text-[var(--qf-text-muted)]">⚡ {d.hkNote}</p>
              </Card>
              <Card title={`📅 ${d.onDuty}`} action={`${d.roster} →`}>
                <p className="mb-2 text-[13px] text-[var(--qf-text-muted)]">{d.teamSummary}</p><div className="flex flex-wrap gap-1.5"><Staff name="Maria R. 07–15" /><Staff name="Thomas K. 15–23" blue /><Staff name="Sabine M. 08–16" /><Staff name="Luca B. 11–22" /><Staff name={`Zorah A. 🏖 ${d.vacation}`} red /></div>
              </Card>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}

function Card({ title, action, children }: { title: string; action: string; children: React.ReactNode }) { return <section className="overflow-hidden rounded-[var(--qf-radius)] border border-[var(--qf-border)] bg-white shadow-[var(--qf-shadow)]"><header className="flex items-center justify-between border-b border-[var(--qf-border)] px-5 py-3.5"><h2 className="text-[14px] font-bold">{title}</h2><button type="button" className="text-[12.5px] font-semibold text-[var(--qf-accent)]">{action}</button></header><div className="px-5 py-4">{children}</div></section>; }
function Kpi({ label, value, suffix, meta }: { label: string; value: string; suffix: string; meta: React.ReactNode }) { return <article className="rounded-[var(--qf-radius)] border border-[var(--qf-border)] bg-white px-5 py-[18px] shadow-[var(--qf-shadow)]"><p className="mb-2 text-[11px] font-semibold uppercase tracking-[.6px] text-[var(--qf-text-light)]">{label}</p><p className="text-[28px] font-bold leading-none">{value}<span className="text-[15px] text-[var(--qf-text-muted)]">{suffix}</span></p><div className="mt-2 flex items-center gap-1 text-xs text-[var(--qf-text-muted)]">{meta}</div></article>; }
function Chip({ children, color }: { children: React.ReactNode; color: "green" | "red" | "blue" }) { const colors = { green: "bg-[#dcfce7] text-[#16a34a]", red: "bg-[#fee2e2] text-[#dc2626]", blue: "bg-[#dbeafe] text-[#2563eb]" }; return <span className={`rounded-[5px] px-2 py-0.5 text-[11px] font-semibold ${colors[color]}`}>{children}</span>; }
function Status({ value, label, tone }: { value: string; label: string; tone: "red" | "amber" | "green" | "blue" }) { const colors = { red: "bg-[#fee2e2] text-[#dc2626]", amber: "bg-[#fef3c7] text-[#d97706]", green: "bg-[#dcfce7] text-[#16a34a]", blue: "bg-[#dbeafe] text-[#2563eb]" }; return <div className={`rounded-lg p-2 text-center ${colors[tone]}`}><p className="text-xl font-bold">{value}</p><p className="truncate text-[10px] sm:text-[11px]">{label}</p></div>; }
function Staff({ name, blue = false, red = false }: { name: string; blue?: boolean; red?: boolean }) { return <span className={`rounded-[5px] px-2.5 py-1 text-xs font-semibold ${red ? "bg-[#fee2e2] text-[#dc2626]" : blue ? "bg-[#dbeafe] text-[#2563eb]" : "bg-[var(--qf-accent-soft)] text-[var(--qf-accent)]"}`}>{name}</span>; }
