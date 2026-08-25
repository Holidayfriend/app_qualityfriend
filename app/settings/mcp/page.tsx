"use client";

import { useRouter } from "next/navigation";
import { AppShell } from "../../../components/dashboard/app-shell";
import { useI18n } from "../../../components/i18n/i18n-provider";
import { mcpSettingsMessages } from "../../../lib/i18n/dictionaries";

export default function McpPage() {
  const { dictionary, locale } = useI18n();
  const router = useRouter();
  const labels = mcpSettingsMessages[locale];
  return <AppShell activeItem="settings"><main className="p-4 sm:p-5 lg:p-7"><button type="button" onClick={() => router.push("/settings")} className="mb-3.5 cursor-pointer text-[12.5px] font-semibold text-[var(--qf-text-muted)] hover:text-[var(--qf-accent)]">← {dictionary.navigation.settings}</button><section className="flex min-h-[calc(100vh-160px)] items-center justify-center rounded-[var(--qf-radius)] border border-[var(--qf-border)] bg-white shadow-[var(--qf-shadow)]"><div className="text-center"><div className="mb-3 text-3xl">🔌</div><h1 className="text-sm font-bold">{labels.title}</h1><p className="mt-1 text-xs text-[var(--qf-text-muted)]">{dictionary.common.underDevelopment}</p></div></section></main></AppShell>;
}
