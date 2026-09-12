"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useI18n } from "../i18n/i18n-provider";
import { toastMessages } from "../../lib/i18n/dictionaries";

type ToastInput = { message: string; tone?: "success" | "error" | "info" };
type Toast = ToastInput & { id: number };
const ToastContext = createContext<((toast: ToastInput) => void) | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);
  const { locale } = useI18n();
  const dismiss = useCallback((id: number) => setToasts(items => items.filter(item => item.id !== id)), []);
  const showToast = useCallback((toast: ToastInput) => {
    const id = ++nextId.current;
    setToasts(items => [...items.slice(-3), { ...toast, id }]);
  }, []);
  return <ToastContext.Provider value={showToast}>{children}<div className="pointer-events-none fixed top-5 right-5 z-[100] flex w-[calc(100%-2.5rem)] max-w-sm flex-col gap-3 print:hidden">{toasts.map(toast => <ToastItem key={toast.id} toast={toast} dismiss={dismiss} closeLabel={toastMessages[locale].dismiss}/>)}</div></ToastContext.Provider>;
}

function ToastItem({ toast, dismiss, closeLabel }: { toast: Toast; dismiss: (id: number) => void; closeLabel: string }) {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const remaining = useRef(6000);
  const progress = useRef<HTMLDivElement>(null);
  const paused = hovered || focused;
  useEffect(() => {
    if (paused) return;
    let previous = performance.now();
    let frame: number;
    const tick = (now: number) => {
      remaining.current = Math.max(0, remaining.current - (now - previous));
      previous = now;
      if (progress.current) progress.current.style.transform = `scaleX(${remaining.current / 6000})`;
      if (remaining.current === 0) dismiss(toast.id);
      else frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [toast.id, dismiss, paused]);
  const tone = toast.tone ?? "info";
  return <div role={tone === "error" ? "alert" : "status"} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} onFocus={() => setFocused(true)} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false); }} className={`pointer-events-auto relative flex items-start gap-3 overflow-hidden rounded-xl border bg-white p-4 text-sm shadow-xl ${tone === "error" ? "border-red-200 text-red-800" : tone === "success" ? "border-emerald-200 text-emerald-800" : "border-blue-200 text-blue-800"}`}><span aria-hidden="true" className="font-bold">{tone === "error" ? "!" : tone === "success" ? "✓" : "i"}</span><p className="min-w-0 flex-1 break-words font-bold">{toast.message}</p><button type="button" aria-label={closeLabel} onClick={() => dismiss(toast.id)} className="cursor-pointer rounded px-1 focus-visible:outline-2">×</button><div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-1 bg-current/10"><div ref={progress} className="h-full origin-left bg-current"/></div></div>;
}

export function useToast() {
  const showToast = useContext(ToastContext);
  if (!showToast) throw new Error("useToast must be used inside ToastProvider");
  return showToast;
}
