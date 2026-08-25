import type { InputHTMLAttributes } from "react";

type InputProps = InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string; error?: string };

export function Input({ id, label, hint, error, className = "", ...props }: InputProps) {
  const errorId = id ? `${id}-error` : undefined;
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-[13px] font-semibold text-[var(--qf-text)]">{label}</label>
      <input id={id} aria-invalid={Boolean(error)} aria-describedby={error ? errorId : undefined} className={`h-11 w-full rounded-lg border bg-white px-3.5 text-sm text-[var(--qf-text)] outline-none transition placeholder:text-[var(--qf-text-light)] ${error ? "border-[var(--qf-danger)] focus:border-[var(--qf-danger)] focus:ring-3 focus:ring-[#fee2e2]" : "border-[var(--qf-border)] hover:border-[#d8d4cc] focus:border-[var(--qf-accent)] focus:ring-3 focus:ring-[var(--qf-accent-soft)]"} ${className}`} {...props} />
      {error ? <p id={errorId} role="alert" className="text-[11px] font-medium text-[var(--qf-danger)]">{error}</p> : hint ? <p className="text-[11px] text-[var(--qf-text-muted)]">{hint}</p> : null}
    </div>
  );
}
