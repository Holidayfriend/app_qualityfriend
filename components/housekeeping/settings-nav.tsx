"use client";

import Link from "next/link";
import type { HousekeepingMessages } from "../../lib/i18n/housekeeping-messages";

export type HousekeepingSettingsSection="floors"|"categories"|"rooms"|"extras";

export function HousekeepingSettingsNav({active,t}:{active:HousekeepingSettingsSection;t:HousekeepingMessages}){
  const items=[
    ["floors","/housekeeping/settings/floors",t.floors],
    ["categories","/housekeeping/settings/categories",t.categories],
    ["rooms","/housekeeping/settings/rooms",t.rooms],
    ["extras","/housekeeping/settings/extras",t.extraJobs],
  ] as const;
  return <nav className="mb-[14px] flex flex-wrap gap-2" aria-label={t.settings}>{items.map(([id,href,label])=><Link key={id} href={href} className={`rounded-full border px-3 py-[5px] text-[12px] font-semibold ${active===id?"border-[var(--qf-accent)] bg-[var(--qf-accent)] text-white":"border-[var(--qf-border)] bg-white text-[var(--qf-text-muted)]"}`}>{label}</Link>)}</nav>;
}
