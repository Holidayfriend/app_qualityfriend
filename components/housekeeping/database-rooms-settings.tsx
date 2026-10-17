"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { HousekeepingMessages, Locale } from "../../lib/i18n/dictionaries";

import { BrandLoader } from "../ui/brand-loader";
import { requestMessages } from "../../lib/i18n/dictionaries";

type Room = { id: string; number: string; name: string | null; category: string | null; floor: string | null };

export function DatabaseRoomsSettings({ t, locale }: { t: HousekeepingMessages; locale: Locale }) {
  const [loadedLocale, setLoadedLocale] = useState<Locale | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);

  useEffect(() => {
    let active = true;
    fetch(`/api/housekeeping/rooms?locale=${locale}`, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Unable to load rooms.");
        return response.json() as Promise<{ rooms: Room[] }>;
      })
      .then((data) => { if (active) setRooms(data.rooms); })
      .catch(() => { if (active) setRooms([]); })
      .finally(() => { if (active) setLoadedLocale(locale); });
    return () => { active = false; };
  }, [locale]);

  if (loadedLocale !== locale) return <BrandLoader label={requestMessages[locale].loading} />;

  return <>
    <div className="mb-[10px] flex justify-end">
      <Link href="/housekeeping/settings/rooms/new" className="inline-flex min-h-[42px] w-full items-center justify-center rounded-[7px] bg-[var(--qf-accent)] px-[14px] text-[12px] font-semibold text-white sm:min-h-[34px] sm:w-auto">+ {t.addRoom}</Link>
    </div>

    <div className="grid gap-3 md:hidden">
      {rooms.map((room) => <article key={room.id} className="overflow-hidden rounded-[12px] border border-[var(--qf-border)] bg-white p-4 shadow-[var(--qf-shadow)]">
        <div className="flex items-center gap-3">
          <span aria-hidden className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] bg-[var(--qf-accent-soft)] text-[20px]">🛏️</span>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-[13.5px] font-bold">{room.name || `RN_${room.number}`}</h2>
            <p className="mt-0.5 text-[11px] text-[var(--qf-text-muted)]">{t.room} {room.number}</p>
          </div>
          <Link href={`/housekeeping/settings/rooms/new?edit=${room.id}`} title={t.edit} aria-label={`${t.edit}: ${room.number}`} className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[8px] border border-[var(--qf-border)] text-[15px] text-[var(--qf-accent)]">✏️</Link>
        </div>
        <dl className="mt-3 grid grid-cols-2 gap-2 border-t border-[var(--qf-border)] pt-3">
          <div className="min-w-0 rounded-[8px] bg-[var(--qf-background)] px-3 py-2">
            <dt className="text-[9.5px] font-bold uppercase tracking-[.4px] text-[var(--qf-text-light)]">{t.category}</dt>
            <dd className="mt-1 truncate text-[11.5px] font-semibold">{room.category || "—"}</dd>
          </div>
          <div className="min-w-0 rounded-[8px] bg-[var(--qf-background)] px-3 py-2">
            <dt className="text-[9.5px] font-bold uppercase tracking-[.4px] text-[var(--qf-text-light)]">{t.floor}</dt>
            <dd className="mt-1 truncate text-[11.5px] font-semibold">{room.floor || "—"}</dd>
          </div>
        </dl>
      </article>)}
    </div>

    <section className="hidden overflow-x-auto rounded-[10px] border border-[var(--qf-border)] bg-white shadow-[var(--qf-shadow)] md:block">
      <table className="w-full min-w-[650px] border-collapse text-left text-[13px]">
        <thead><tr className="bg-[#f9f8f6] text-[11px] font-semibold uppercase tracking-[.5px] text-[var(--qf-text-light)]"><th className="px-3 py-2">{t.room}</th><th className="px-3 py-2">{t.category}</th><th className="px-3 py-2">{t.floor}</th><th className="px-3 py-2 text-right">{t.actions}</th></tr></thead>
        <tbody>{rooms.map((room) => <tr key={room.id} className="border-t border-[var(--qf-border)] hover:bg-[#fafaf8]"><td className="px-3 py-[9px] font-semibold">{room.name || `RN_${room.number}`} ({room.number})</td><td className="px-3 py-[9px]">{room.category || "—"}</td><td className="px-3 py-[9px]">{room.floor || "—"}</td><td className="px-3 py-[9px] text-right"><Link href={`/housekeeping/settings/rooms/new?edit=${room.id}`} title={t.edit} aria-label={`${t.edit}: ${room.number}`} className="inline-flex h-8 w-8 items-center justify-center rounded-[7px] border border-[var(--qf-border)] text-[13px]">✏️</Link></td></tr>)}</tbody>
      </table>
    </section>
  </>;
}
