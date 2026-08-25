"use client";

import type { InputHTMLAttributes } from "react";
import { useState } from "react";

type PasswordInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  label: string;
  showLabel?: string;
  hideLabel?: string;
  error?: string;
};

export function PasswordInput({ id, label, showLabel = "Show password", hideLabel = "Hide password", error, className = "", ...props }: PasswordInputProps) {
  const [visible, setVisible] = useState(false);
  const errorId = id ? `${id}-error` : undefined;

  return (
    <div className="space-y-1.5">
      {label ? <label htmlFor={id} className="block text-[13px] font-semibold text-[var(--qf-text)]">{label}</label> : null}
      <div className="relative">
        <input id={id} type={visible ? "text" : "password"} aria-invalid={Boolean(error)} aria-describedby={error ? errorId : undefined} className={`h-11 w-full rounded-lg border bg-white px-3.5 pr-11 text-sm text-[var(--qf-text)] outline-none transition placeholder:text-[var(--qf-text-light)] ${error ? "border-[var(--qf-danger)] focus:border-[var(--qf-danger)] focus:ring-3 focus:ring-[#fee2e2]" : "border-[var(--qf-border)] hover:border-[#d8d4cc] focus:border-[var(--qf-accent)] focus:ring-3 focus:ring-[var(--qf-accent-soft)]"} ${className}`} {...props} />
        <button type="button" onClick={() => setVisible((current) => !current)} aria-label={visible ? hideLabel : showLabel} aria-pressed={visible} className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-lg text-[var(--qf-text-muted)] transition hover:text-[var(--qf-accent)] focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-[var(--qf-accent)]">
          {visible ? (
            <svg viewBox="0 0 24 24" aria-hidden="true" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3l18 18" /><path d="M10.6 10.7a2 2 0 002.7 2.7" /><path d="M9.9 4.2A10.8 10.8 0 0112 4c5.5 0 9 5 9 5a15.5 15.5 0 01-2.2 2.8" /><path d="M6.2 6.2C4.2 7.5 3 9 3 9s3.5 5 9 5c1 0 2-.2 2.8-.5" /></svg>
          ) : (
            <svg viewBox="0 0 24 24" aria-hidden="true" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12s3.5-5 9-5 9 5 9 5-3.5 5-9 5-9-5-9-5z" /><circle cx="12" cy="12" r="2.5" /></svg>
          )}
        </button>
      </div>
      {error ? <p id={errorId} role="alert" className="text-[11px] font-medium text-[var(--qf-danger)]">{error}</p> : null}
    </div>
  );
}
