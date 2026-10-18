"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AppShell } from "../dashboard/app-shell";
import { useI18n } from "../i18n/i18n-provider";
import { mcpPortalMessages } from "../../lib/i18n/dictionaries";

const tabDefinitions = [
  { key: "dashboard", href: "/settings/mcp-portal", icon: "📊" },
  { key: "newChat", href: "/settings/mcp-portal/new-chat", icon: "✨" },
  { key: "chatHistory", href: "/settings/mcp-portal/chat-history", icon: "🕘" },
  { key: "promptLibrary", href: "/settings/mcp-portal/prompt-library", icon: "📚" },
  { key: "categories", href: "/settings/mcp-portal/categories", icon: "🏷️" },
  { key: "personalSettings", href: "/settings/mcp-portal/personal-settings", icon: "⚙️" },
] as const;

export type McpPortalPage = (typeof tabDefinitions)[number]["key"];

export function McpPortalShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { dictionary, locale } = useI18n();
  const text = mcpPortalMessages[locale];

  return (
    <AppShell activeItem="settings" pageTitle={text.title}>
      <main className="w-full p-4 pb-24 sm:p-5 lg:px-7 lg:py-6">
        <Link
          href="/settings"
          className="mb-4 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-[var(--qf-text-muted)] hover:text-[var(--qf-accent)]"
        >
          <span aria-hidden>←</span> {dictionary.navigation.settings}
        </Link>

        <nav className="mb-[18px] flex gap-2 overflow-x-auto pb-1" aria-label={text.title}>
          {tabDefinitions.map((tab) => {
            const active = pathname === tab.href || (tab.key !== "dashboard" && pathname.startsWith(`${tab.href}/`));
            return (
              <Link
                key={tab.key}
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={`inline-flex min-h-[42px] shrink-0 items-center gap-2 rounded-[8px] border px-[18px] py-[10px] text-[13px] font-semibold transition ${
                  active
                    ? "border-[var(--qf-accent)] bg-[var(--qf-accent)] text-white"
                    : "border-[var(--qf-border)] bg-white text-[var(--qf-text-muted)] hover:border-[var(--qf-accent)] hover:text-[var(--qf-accent)]"
                }`}
              >
                <span aria-hidden>{tab.icon}</span>
                {text[tab.key]}
              </Link>
            );
          })}
        </nav>

        {children}
      </main>
    </AppShell>
  );
}

export function McpPortalPlaceholder({ page }: { page: McpPortalPage }) {
  const { locale } = useI18n();
  const text = mcpPortalMessages[locale];
  const tab = tabDefinitions.find((item) => item.key === page)!;

  return (
    <section className="min-h-[280px] rounded-[var(--qf-radius)] border border-[var(--qf-border)] bg-white p-6 shadow-[var(--qf-shadow)] sm:p-8">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--qf-accent-soft)] text-2xl" aria-hidden>
        {tab.icon}
      </div>
      <h2 className="mt-4 text-lg font-bold text-[var(--qf-text)]">{text[page]}</h2>
      <p className="mt-2 text-sm text-[var(--qf-text-muted)]">{text.placeholder}</p>
    </section>
  );
}
