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
  return <ToastContext.Provider value={showToast}>{children}<div className="pointer-events-none fixed bottom-5 right-5 z-[100] flex w-[calc(100%-2.5rem)] max-w-sm flex-col gap-3 print:hidden">{toasts.map(toast => <ToastItem key={toast.id} toast={toast} dismiss={dismiss} closeLabel={toastMessages[locale].dismiss}/>)}</div></ToastContext.Provider>;
}

function ToastItem({ toast, dismiss, closeLabel }: { toast: Toast; dismiss: (id: number) => void; closeLabel: string }) {
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (paused) return;
    const timer = window.setTimeout(() => dismiss(toast.id), 6000);
    return () => window.clearTimeout(timer);
  }, [toast.id, dismiss, paused]);
  const tone = toast.tone ?? "info";
  return <div role={tone === "error" ? "alert" : "status"} onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocus={() => setPaused(true)} onBlur={() => setPaused(false)} className={`pointer-events-auto flex items-start gap-3 rounded-xl border bg-white p-4 text-sm shadow-xl ${tone === "error" ? "border-red-200 text-red-800" : tone === "success" ? "border-emerald-200 text-emerald-800" : "border-blue-200 text-blue-800"}`}><span aria-hidden="true" className="font-bold">{tone === "error" ? "!" : tone === "success" ? "✓" : "i"}</span><p className="min-w-0 flex-1 break-words">{toast.message}</p><button type="button" aria-label={closeLabel} onClick={() => dismiss(toast.id)} className="cursor-pointer rounded px-1 focus-visible:outline-2">×</button></div>;
}

export function useToast() {
  const showToast = useContext(ToastContext);
  if (!showToast) throw new Error("useToast must be used inside ToastProvider");
  return showToast;
}
