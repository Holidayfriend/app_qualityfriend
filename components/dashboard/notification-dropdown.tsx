"use client";

import { useEffect, useId, useRef, useState } from "react";

// Sample notifications from the client reference, weihrerhof-system (9).html.
const notifications = [
  { icon: "📨", background: "#FEF3C7", title: "Neue Bewerbung: Lena Huber", detail: "vor 2 Std. · Restaurant/Service", destination: "recruiting" },
  { icon: "🔥", background: "#FEE2E2", title: "Express-Reparatur: Zi. 48", detail: "vor 4 Std. · Dringend", destination: "repairs" },
  { icon: "🏖", background: "#DCFCE7", title: "Urlaubsanfrage: Thomas Gruber", detail: "vor 1 Tag · wartet auf Genehmigung", destination: "schedule" },
];

export function NotificationDropdown({ onNavigate }: { onNavigate: (destination: string) => void }) {
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    function dismissOutside(event: PointerEvent) {
      if (event.target instanceof Node && !container.current?.contains(event.target)) setOpen(false);
    }
    function dismissEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        trigger.current?.focus();
      }
    }
    document.addEventListener("pointerdown", dismissOutside);
    document.addEventListener("keydown", dismissEscape);
    return () => {
      document.removeEventListener("pointerdown", dismissOutside);
      document.removeEventListener("keydown", dismissEscape);
    };
  }, [open]);

  return <div ref={container} className="relative" onBlur={(event) => {
    if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
  }}>
    <button ref={trigger} type="button" aria-label="Notifications" aria-expanded={open} aria-controls={panelId} onClick={() => setOpen(!open)} className="relative flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-[var(--qf-border)] bg-white" style={{ fontSize: 16 }}>
      🔔<span className="absolute right-[5px] top-[5px] h-2 w-2 rounded-full border-2 border-white bg-[var(--qf-danger)]" />
    </button>
    {open && <section id={panelId} aria-label="Benachrichtigungen" className="absolute right-0 top-[44px] z-[100] w-[320px] max-w-[calc(100vw-32px)] overflow-hidden rounded-[10px] border border-[var(--qf-border)] bg-white text-[var(--qf-text)] shadow-[0_12px_32px_rgba(0,0,0,.15)]" style={{ lineHeight: "normal" }}>
      <div className="border-b border-[var(--qf-border)] px-4 py-3 text-[13px] font-bold">Benachrichtigungen</div>
      <div className="py-1.5">
        {notifications.map((notification) => <button key={notification.destination} type="button" onClick={() => { setOpen(false); onNavigate(notification.destination); }} className="flex w-full cursor-pointer items-start gap-3 border-b border-[var(--qf-border)] px-4 py-2.5 text-left last:border-b-0">
          <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ background: notification.background, fontSize: 15 }}>{notification.icon}</span>
          <span>
            <span className="block text-[13.5px] font-semibold leading-[1.3]">{notification.title}</span>
            <span className="mt-0.5 block text-[12px] text-[var(--qf-text-muted)]">{notification.detail}</span>
          </span>
        </button>)}
      </div>
    </section>}
  </div>;
}
