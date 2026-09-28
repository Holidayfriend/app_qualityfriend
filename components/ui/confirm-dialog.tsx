"use client";

import { useEffect, useRef } from "react";
import { Button } from "./button";

export function ConfirmDialog({ open, title, message, confirmLabel, cancelLabel, pending = false, onConfirm, onCancel }: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  pending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) cancelRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape" && !pending) onCancel();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, pending, onCancel]);

  if (!open) return null;
  return <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/45 p-4" onMouseDown={(event) => event.target === event.currentTarget && !pending && onCancel()}>
    <div role="alertdialog" aria-modal="true" aria-labelledby="confirm-dialog-title" aria-describedby="confirm-dialog-message" className="w-full max-w-[420px] overflow-hidden rounded-xl bg-white shadow-2xl">
      <header className="flex items-center justify-between border-b border-[var(--qf-border)] px-5 py-4">
        <h2 id="confirm-dialog-title" className="text-[15px] font-bold">{title}</h2>
        <button type="button" onClick={onCancel} disabled={pending} className="h-7 w-7 cursor-pointer rounded-md hover:bg-[var(--qf-background)] disabled:cursor-not-allowed">×</button>
      </header>
      <p id="confirm-dialog-message" className="px-5 py-5 text-sm leading-relaxed text-[var(--qf-text)]">{message}</p>
      <footer className="flex justify-end gap-2.5 border-t border-[var(--qf-border)] px-5 py-4">
        <Button ref={cancelRef} type="button" variant="secondary" onClick={onCancel} disabled={pending}>{cancelLabel}</Button>
        <Button type="button" variant="danger" onClick={onConfirm} disabled={pending}>{confirmLabel}</Button>
      </footer>
    </div>
  </div>;
}
