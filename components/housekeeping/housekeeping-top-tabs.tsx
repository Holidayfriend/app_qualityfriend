"use client";

import Link from "next/link";
import type { HousekeepingMessages } from "../../lib/i18n/dictionaries";

export function HousekeepingTopTabs({active,t,canAdmin}:{active:"board"|"schedule"|"report"|"settings";t:HousekeepingMessages;canAdmin:boolean}){const tabs=([["board","/housekeeping","🧹",t.housekeeping],["schedule","/housekeeping/schedule","🗓️",t.dailyPlans],["report","/housekeeping/report","📋",t.report],["settings","/housekeeping/settings","⚙️",t.settings]] as const).filter(([id])=>id==="board"||canAdmin);if(tabs.length<2)return null;return <nav className="mb-[18px] flex gap-2 overflow-x-auto" aria-label={t.housekeeping}>{tabs.map(([id,href,icon,label])=><Link key={id} href={href} aria-current={active===id?"page":undefined} className={`inline-flex min-h-[42px] shrink-0 items-center gap-2 rounded-[8px] border px-[18px] py-[10px] text-[13px] font-semibold ${active===id?"border-[var(--qf-accent)] bg-[var(--qf-accent)] text-white":"border-[var(--qf-border)] bg-white text-[var(--qf-text-muted)] hover:border-[var(--qf-accent)]"}`}><span aria-hidden>{icon}</span>{label}</Link>)}</nav>}
