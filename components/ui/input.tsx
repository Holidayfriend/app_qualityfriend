"use client";

import { useState, type ChangeEvent, type InputHTMLAttributes } from "react";

type InputProps = InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string; error?: string };

export function Input({ id, label, hint, error, className = "", ...props }: InputProps) {
  if (["Hotel logo", "Hotellogo", "Logo dell'hotel"].includes(label)) return <HotelLogoInput label={label} value={typeof props.value === "string" ? props.value : ""} onChange={props.onChange} />;
  const errorId = id ? `${id}-error` : undefined;
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-[13px] font-semibold text-[var(--qf-text)]">{label}</label>
      <input id={id} aria-invalid={Boolean(error)} aria-describedby={error ? errorId : undefined} className={`h-11 w-full rounded-lg border bg-white px-3.5 text-sm text-[var(--qf-text)] outline-none transition placeholder:text-[var(--qf-text-light)] ${error ? "border-[var(--qf-danger)] focus:border-[var(--qf-danger)] focus:ring-3 focus:ring-[#fee2e2]" : "border-[var(--qf-border)] hover:border-[#d8d4cc] focus:border-[var(--qf-accent)] focus:ring-3 focus:ring-[var(--qf-accent-soft)]"} ${className}`} {...props} />
      {error ? <p id={errorId} role="alert" className="text-[11px] font-medium text-[var(--qf-danger)]">{error}</p> : hint ? <p className="text-[11px] text-[var(--qf-text-muted)]">{hint}</p> : null}
    </div>
  );
}

function HotelLogoInput({ label, value, onChange }: { label: string; value: string; onChange?: InputHTMLAttributes<HTMLInputElement>["onChange"] }) {
  const [preview, setPreview] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const copy = label === "Hotellogo" ? { choose: "Bild auswählen", hint: "PNG, JPG, WebP oder GIF. Maximal 5 MB.", invalid: "Wählen Sie ein gültiges Bild unter 5 MB.", uploading: "Wird hochgeladen..." } : label === "Logo dell'hotel" ? { choose: "Scegli immagine", hint: "PNG, JPG, WebP o GIF. Massimo 5 MB.", invalid: "Scegli un'immagine valida inferiore a 5 MB.", uploading: "Caricamento..." } : { choose: "Choose image", hint: "PNG, JPG, WebP or GIF. Maximum 5 MB.", invalid: "Choose a valid image smaller than 5 MB.", uploading: "Uploading..." };

  async function select(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp", "image/gif"].includes(file.type) || file.size > 5 * 1024 * 1024) { setError(copy.invalid); return; }
    setError("");
    setPreview(URL.createObjectURL(file));
    setUploading(true);
    try {
      const form = new FormData();
      form.append("logo", file);
      const response = await fetch("/api/settings/account/logo", { method: "POST", body: form });
      const result = await response.json();
      if (!response.ok) throw new Error();
      onChange?.({ target: { value: result.logoUrl }, currentTarget: { value: result.logoUrl } } as ChangeEvent<HTMLInputElement>);
    } catch { setError(copy.invalid); }
    finally { setUploading(false); }
  }

  return <div className="space-y-1.5"><p className="text-[13px] font-semibold text-[var(--qf-text)]">{label}</p><div className="flex items-center gap-3"><div role="img" aria-label={label} className="h-16 w-16 shrink-0 rounded-lg border border-[var(--qf-border)] bg-white bg-contain bg-center bg-no-repeat" style={{ backgroundImage: `url(${preview || value || "/logo-icon.png"})` }} /><label className={`inline-flex h-10 items-center rounded-lg border border-[var(--qf-border)] bg-white px-4 text-xs font-semibold transition ${uploading ? "cursor-wait opacity-60" : "cursor-pointer hover:border-[var(--qf-accent)] hover:text-[var(--qf-accent)]"}`}>{uploading ? copy.uploading : copy.choose}<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" disabled={uploading} className="sr-only" onChange={select} /></label></div><p className="text-[11px] text-[var(--qf-text-muted)]">{copy.hint}</p>{error ? <p role="alert" className="text-[11px] font-medium text-[var(--qf-danger)]">{error}</p> : null}</div>;
}
