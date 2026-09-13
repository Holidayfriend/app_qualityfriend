"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { HousekeepingMessages, Locale } from "../../lib/i18n/dictionaries";

type Room = { id: string; number: string; name: string | null; category: string | null; floor: string | null };

export function DatabaseRoomsSettings({ t, locale }: { t: HousekeepingMessages; locale: Locale }) {
  const [rooms, setRooms] = useState<Room[]>([]);

  useEffect(() => {
    let active = true;
    fetch(`/api/housekeeping/rooms?locale=${locale}`, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Unable to load rooms.");
        return response.json() as Promise<{ rooms: Room[] }>;
      })
      .then((data) => { if (active) setRooms(data.rooms); })
      .catch(() => { if (active) setRooms([]); });
    return () => { active = false; };
  }, [locale]);

  return <><div className="mb-[10px] flex justify-end"><Link href="/housekeeping/settings/rooms/new" className="inline-flex min-h-[34px] items-center rounded-[7px] bg-[var(--qf-accent)] px-[14px] text-[12px] font-semibold text-white">+ {t.addRoom}</Link></div><section className="overflow-x-auto rounded-[10px] border border-[var(--qf-border)] bg-white shadow-[var(--qf-shadow)]"><table className="w-full min-w-[650px] border-collapse text-left text-[13px]"><thead><tr className="bg-[#f9f8f6] text-[11px] font-semibold uppercase tracking-[.5px] text-[var(--qf-text-light)]"><th className="px-3 py-2">{t.room}</th><th className="px-3 py-2">{t.category}</th><th className="px-3 py-2">{t.floor}</th><th className="px-3 py-2 text-right">{t.actions}</th></tr></thead><tbody>{rooms.map((room) => <tr key={room.id} className="border-t border-[var(--qf-border)] hover:bg-[#fafaf8]"><td className="px-3 py-[9px] font-semibold">{room.name || `RN_${room.number}`} ({room.number})</td><td className="px-3 py-[9px]">{room.category || "—"}</td><td className="px-3 py-[9px]">{room.floor || "—"}</td><td className="px-3 py-[9px] text-right"><Link href={`/housekeeping/settings/rooms/new?edit=${room.id}`} title={t.edit} aria-label={`${t.edit}: ${room.number}`} className="inline-flex h-8 w-8 items-center justify-center rounded-[7px] border border-[var(--qf-border)] text-[13px]">✏️</Link></td></tr>)}</tbody></table></section></>;
}
