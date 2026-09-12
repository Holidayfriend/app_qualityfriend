"use client";

import Link from "next/link";
import {AppShell} from "../dashboard/app-shell";
import {useI18n} from "../i18n/i18n-provider";
import {housekeepingMessages} from "../../lib/i18n/dictionaries";
import {HousekeepingSettingsNav,type HousekeepingSettingsSection} from "./settings-nav";
import {CategoriesSettings,ExtraJobsSettings,FloorsSettings,RoomsSettings} from "./settings-sections";

export function HousekeepingSettingsPage({section="floors"}:{section?:HousekeepingSettingsSection}){
  const {locale}=useI18n();
  const t=housekeepingMessages[locale];
  const tabs=[["/housekeeping","🧹",t.housekeeping],["/housekeeping/schedule","🗓️",t.dailyPlans],["/housekeeping/settings","⚙️",t.settings]] as const;
  return <AppShell activeItem="housekeeping" pageTitle={t.housekeeping}><main className="w-full p-4 pb-24 sm:p-5 lg:px-7 lg:py-6"><nav className="mb-[18px] flex gap-2 overflow-x-auto">{tabs.map(([href,icon,label])=><Link key={href} href={href} className={`inline-flex min-h-[42px] shrink-0 items-center gap-2 rounded-[8px] border px-[18px] py-[10px] text-[13px] font-semibold ${href==="/housekeeping/settings"?"border-[var(--qf-accent)] bg-[var(--qf-accent)] text-white":"border-[var(--qf-border)] bg-white text-[var(--qf-text-muted)]"}`}><span>{icon}</span>{label}</Link>)}</nav><HousekeepingSettingsNav active={section} t={t}/>{section==="floors"?<FloorsSettings t={t}/>:null}{section==="categories"?<CategoriesSettings t={t}/>:null}{section==="rooms"?<RoomsSettings t={t}/>:null}{section==="extras"?<ExtraJobsSettings t={t}/>:null}</main></AppShell>;
}
