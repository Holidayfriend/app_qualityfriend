"use client";

import { useRouter } from "next/navigation";
import { AppShell } from "../../components/dashboard/app-shell";
import { useI18n } from "../../components/i18n/i18n-provider";
import { settingsPageMessages } from "../../lib/i18n/dictionaries";

export default function SettingsPage() {
  const { dictionary, locale } = useI18n();
  const router = useRouter();
  const s = dictionary.settings;
  const pageMessages = settingsPageMessages[locale];
  const sections = [
    { title: `👤 ${s.usersTeams}`, items: [["👤", s.manageUsers, s.manageUsersDescription, ""], ["🏢", pageMessages.departmentsTeams, pageMessages.departmentsTeamsDescription, "/settings/departments"], ["🔑", s.roles, s.rolesDescription, ""]] },
    { title: `🧠 ${s.aiKnowledge}`, items: [["📚", s.knowledge, s.knowledgeDescription, ""], ["🤖", s.training, s.trainingDescription, ""]] },
    { title: `⚙️ ${s.general}`, wide: true, items: [["🌐", s.defaultLanguage, s.defaultLanguageDescription, ""], ["🗑️", s.recycleBin, s.recycleBinDescription, "/settings/recycle-bin"], ["📋", s.activityLog, s.activityLogDescription, "/settings/activity-log"]] },
  ];
  return <AppShell activeItem="settings"><main className="p-4 sm:p-5 lg:p-7"><div className="grid gap-[18px] lg:grid-cols-2">{sections.map((section) => <section key={section.title} className={`overflow-hidden rounded-[var(--qf-radius)] border border-[var(--qf-border)] bg-white shadow-[var(--qf-shadow)] ${section.wide ? "lg:col-span-2" : ""}`}><header className="border-b border-[var(--qf-border)] px-5 py-3.5"><h2 className="text-[14px] font-bold">{section.title}</h2></header>{section.items.map(([icon, title, description, path]) => <button key={title} type="button" onClick={() => path && router.push(path)} className="flex w-full cursor-pointer items-start gap-3.5 border-b border-[var(--qf-border)] px-5 py-3.5 text-left transition last:border-0 hover:bg-[var(--qf-background)]"><span className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-lg bg-[var(--qf-accent-soft)] text-[17px]">{icon}</span><span><span className="block text-[13.5px] font-bold">{title}</span><span className="mt-0.5 block text-xs text-[var(--qf-text-muted)]">{description}</span></span></button>)}</section>)}</div></main></AppShell>;
}
