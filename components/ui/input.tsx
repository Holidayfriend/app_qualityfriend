import type { InputHTMLAttributes } from "react";

type InputProps = InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string };

export function Input({ id, label, hint, className = "", ...props }: InputProps) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-[13px] font-semibold text-[var(--qf-text)]">{label}</label>
      <input id={id} className={`h-11 w-full rounded-lg border border-[var(--qf-border)] bg-white px-3.5 text-sm text-[var(--qf-text)] outline-none transition placeholder:text-[var(--qf-text-light)] hover:border-[#d8d4cc] focus:border-[var(--qf-accent)] focus:ring-3 focus:ring-[var(--qf-accent-soft)] ${className}`} {...props} />
      {hint ? <p className="text-[11px] text-[var(--qf-text-muted)]">{hint}</p> : null}
    </div>
  );
}
