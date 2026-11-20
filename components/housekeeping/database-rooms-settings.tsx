"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { HousekeepingMessages, Locale } from "../../lib/i18n/dictionaries";

import { BrandLoader } from "../ui/brand-loader";
import { ConfirmDialog } from "../ui/confirm-dialog";
import { requestMessages } from "../../lib/i18n/dictionaries";

type Room = { id: string; number: string; name: string | null; category: string | null; floor: string | null };

export function DatabaseRoomsSettings({ t, locale }: { t: HousekeepingMessages; locale: Locale }) {
  const labels = {
    en: { remove: "Delete", confirm: "Delete this room?", message: "{name} will leave the room list.", cancel: "Cancel", failed: "Unable to delete the room. Please try again." },
    de: { remove: "Löschen", confirm: "Dieses Zimmer löschen?", message: "{name} verschwindet aus der Zimmerliste.", cancel: "Abbrechen", failed: "Zimmer konnte nicht gelöscht werden. Bitte erneut versuchen." },
    it: { remove: "Elimina", confirm: "Eliminare questa camera?", message: "{name} esce dall'elenco delle camere.", cancel: "Annulla", failed: "Impossibile eliminare la camera. Riprova." },
  }[locale];
  const [pendingDelete, setPendingDelete] = useState<Room | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [loadedLocale, setLoadedLocale] = useState<Locale | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);

  async function deleteRoom() {
    if (!pendingDelete || deleting) return;
    setDeleting(true);
    setError("");
    try {
      const response = await fetch(`/api/housekeeping/rooms/${pendingDelete.id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Delete failed");
      setRooms((current) => current.filter((item) => item.id !== pendingDelete.id));
      setPendingDelete(null);
    } catch {
      setError(labels.failed);
    } finally {
      setDeleting(false);
    }
  }

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

  const dialog = pendingDelete ? <ConfirmDialog open title={labels.confirm} message={labels.message.replace("{name}", `${pendingDelete.name || `RN_${pendingDelete.number}`} (${pendingDelete.number})`)} confirmLabel={labels.remove} cancelLabel={labels.cancel} pending={deleting} onConfirm={() => void deleteRoom()} onCancel={() => { if (!deleting) setPendingDelete(null); }} /> : null;

  return <>
    {dialog}
    {error ? <p role="alert" className="mb-3 text-sm text-red-600">{error}</p> : null}
    <div className="mb-[10px] flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <h2 className="text-[14px] font-bold">{t.room} ({rooms.length})</h2>
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
          <button type="button" onClick={() => setPendingDelete(room)} aria-label={`${labels.remove}: ${room.number}`} className="inline-flex h-10 items-center justify-center rounded-[8px] border border-red-200 px-3 text-[12px] font-semibold text-red-600 hover:bg-red-50">{labels.remove}</button>
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
        <tbody>{rooms.map((room) => <tr key={room.id} className="border-t border-[var(--qf-border)] hover:bg-[#fafaf8]"><td className="px-3 py-[9px] font-semibold">{room.name || `RN_${room.number}`} ({room.number})</td><td className="px-3 py-[9px]">{room.category || "—"}</td><td className="px-3 py-[9px]">{room.floor || "—"}</td><td className="px-3 py-[9px] text-right"><div className="inline-flex items-center gap-2"><Link href={`/housekeeping/settings/rooms/new?edit=${room.id}`} title={t.edit} aria-label={`${t.edit}: ${room.number}`} className="inline-flex h-8 w-8 items-center justify-center rounded-[7px] border border-[var(--qf-border)] text-[13px]">✏️</Link><button type="button" onClick={() => setPendingDelete(room)} aria-label={`${labels.remove}: ${room.number}`} className="inline-flex h-8 items-center justify-center rounded-[7px] border border-red-200 px-3 text-[12px] font-semibold text-red-600 hover:bg-red-50">{labels.remove}</button></div></td></tr>)}</tbody>
      </table>
    </section>
  </>;
}
