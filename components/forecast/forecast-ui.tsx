"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { AppShell } from "../dashboard/app-shell";
import { useI18n } from "../i18n/i18n-provider";
import { moduleNavigationMessages } from "../../lib/i18n/dictionaries";
import { forecastMessages, type ForecastMessages } from "../../lib/i18n/forecast-messages";

export function useForecast() {
  const { locale } = useI18n();
  return forecastMessages[locale];
}

export function ForecastShell({ activeItem, children }: { activeItem: "revenue" | "competitors" | "budget"; children: ReactNode }) {
  const t = useForecast();
  const { locale, dictionary } = useI18n();
  const tabs = [
    { id: "revenue", href: "/revenue", label: `✨ ${dictionary.navigation.revenue}` },
    { id: "competitors", href: "/competitors", label: `🏆 ${moduleNavigationMessages[locale].competitors}` },
    { id: "budget", href: "/budget", label: `📊 ${dictionary.navigation.budget}` },
  ] as const;
  return (
    <AppShell activeItem={activeItem} pageTitle={t.title}>
      <main className="w-full p-4 pb-24 sm:p-5 lg:px-7 lg:py-6">
        <nav className="mb-3.5 flex flex-wrap gap-2" aria-label={t.title}>
          {tabs.map((tab) => (
            <Link
              key={tab.id}
              href={tab.href}
              className={`rounded-full border px-3 py-[5px] text-[12px] font-semibold ${tab.id === activeItem ? "border-[var(--qf-accent)] bg-[var(--qf-accent)] text-white" : "border-[var(--qf-border)] bg-white text-[var(--qf-text-muted)]"}`}
            >
              {tab.label}
            </Link>
          ))}
        </nav>
        {children}
      </main>
    </AppShell>
  );
}

export function AiBanner({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-[18px] flex items-center gap-3.5 rounded-[10px] border border-[rgba(139,92,246,.3)] bg-[linear-gradient(135deg,#1e1b4b,#312e81)] px-5 py-3.5 text-white">
      <span className="text-[20px]">✨</span>
      <div className="min-w-0 flex-1">
        <h2 className="text-[13.5px] font-bold">{title}</h2>
        <p className="mt-[3px] text-[12.5px] leading-[1.5] text-white/80">{children}</p>
      </div>
    </section>
  );
}

export function Kpi({ label, value, suffix, sub, accent }: { label: string; value: string; suffix?: string; sub: ReactNode; accent?: boolean }) {
  return (
    <article className="rounded-[10px] border border-[var(--qf-border)] bg-white px-5 py-[18px] shadow-[var(--qf-shadow)]">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-[.6px] text-[var(--qf-text-light)]">{label}</p>
      <p className={`text-[28px] font-bold leading-none ${accent ? "text-[var(--qf-accent)]" : ""}`}>
        {value}
        {suffix ? <span className="text-[15px] font-bold text-[var(--qf-text-muted)]">{suffix}</span> : null}
      </p>
      <div className="mt-1.5 flex items-center gap-[5px] text-[12px] text-[var(--qf-text-muted)]">{sub}</div>
    </article>
  );
}

const chipTone = {
  green: "bg-[#DCFCE7] text-[#16A34A]",
  red: "bg-[#FEE2E2] text-[#DC2626]",
  amber: "bg-[#FEF3C7] text-[#D97706]",
  blue: "bg-[#DBEAFE] text-[#2563EB]",
} as const;

export function Chip({ tone, children }: { tone: keyof typeof chipTone; children: ReactNode }) {
  return <span className={`rounded-[5px] px-2 py-0.5 text-[11px] font-semibold ${chipTone[tone]}`}>{children}</span>;
}

export function Card({ title, action, children, flush }: { title: string; action?: ReactNode; children: ReactNode; flush?: boolean }) {
  return (
    <section className="overflow-hidden rounded-[10px] border border-[var(--qf-border)] bg-white shadow-[var(--qf-shadow)]">
      <header className="flex items-center justify-between gap-3 border-b border-[var(--qf-border)] px-5 py-3.5">
        <h2 className="text-[14px] font-bold">{title}</h2>
        {action ? <span className="text-[12.5px] font-semibold text-[var(--qf-accent)]">{action}</span> : null}
      </header>
      <div className={flush ? "overflow-x-auto" : "px-5 py-4"}>{children}</div>
    </section>
  );
}

export function DataTable({ headers, children }: { headers: Array<{ label: string; align?: "left" | "center" | "right" }>; children: ReactNode }) {
  return (
    <table className="w-full min-w-[720px] border-collapse text-[13px]">
      <thead>
        <tr>
          {headers.map((header) => (
            <th
              key={header.label}
              className={`border-b border-[var(--qf-border)] bg-[#F9F8F6] px-3 py-2 text-[11px] font-semibold uppercase tracking-[.5px] text-[var(--qf-text-light)] ${header.align === "center" ? "text-center" : header.align === "right" ? "text-right" : "text-left"}`}
            >
              {header.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>{children}</tbody>
    </table>
  );
}

export function Td({ children, align, muted, strong }: { children: ReactNode; align?: "left" | "center" | "right"; muted?: boolean; strong?: boolean }) {
  return (
    <td className={`border-b border-[var(--qf-border)] px-3 py-[9px] group-hover:bg-[#FAFAF8] ${align === "center" ? "text-center" : align === "right" ? "text-right" : "text-left"} ${muted ? "text-[var(--qf-text-light)]" : ""} ${strong ? "font-bold" : ""}`}>
      {children}
    </td>
  );
}

export type RecommendationCopy = ForecastMessages["recommendations"];
export type CompetitorCopy = ForecastMessages["competitors"];
export type DetailsCopy = ForecastMessages["details"];
