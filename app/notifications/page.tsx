"use client";

import { AppShell } from "../../components/dashboard/app-shell";
import { NotificationDropdown } from "../../components/dashboard/notification-dropdown";
import { useI18n } from "../../components/i18n/i18n-provider";
import { notificationMessages } from "../../lib/i18n/dictionaries";

export default function NotificationsPage() {
  const { locale } = useI18n();
  const t = notificationMessages[locale];

  return <AppShell activeItem="notifications" pageTitle={t.title}>
    <main className="mx-auto w-full max-w-5xl p-4 lg:p-7">
      <h1 className="mb-5 text-2xl font-bold">{t.title}</h1>
      <NotificationDropdown fullPage />
    </main>
  </AppShell>;
}
