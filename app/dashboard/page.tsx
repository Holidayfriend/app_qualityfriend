"use client";

import { AppShell } from "../../components/dashboard/app-shell";
import { useI18n } from "../../components/i18n/i18n-provider";

export default function DashboardPage() {
  const { dictionary } = useI18n();
  return <AppShell activeItem="dashboard"><main className="flex min-h-[calc(100vh-56px)] items-center justify-center p-6"><div className="text-center"><p className="text-sm font-bold">{dictionary.navigation.dashboard}</p><p className="mt-1 text-xs text-[var(--qf-text-muted)]">{dictionary.common.underDevelopment}</p></div></main></AppShell>;
}
