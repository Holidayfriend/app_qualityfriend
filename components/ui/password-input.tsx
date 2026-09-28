"use client";

import type { InputHTMLAttributes } from "react";
import { useState } from "react";

type PasswordStrength = "low" | "medium" | "strong";

type PasswordInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  label: string;
  showLabel?: string;
  hideLabel?: string;
  error?: string;
  requiredMark?: boolean;
  strength?: { low: string; medium: string; strong: string };
};

export function passwordStrength(password: string): PasswordStrength | null {
  if (!password) return null;
  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((pattern) => pattern.test(password)).length;
  if (password.length >= 12 && classes >= 3) return "strong";
  if (password.length >= 8 && classes >= 2) return "medium";
  return "low";
}

export function PasswordInput({ id, label, showLabel = "Show password", hideLabel = "Hide password", error, requiredMark = false, strength, className = "", onChange, defaultValue, ...props }: PasswordInputProps) {
  const [visible, setVisible] = useState(false);
  const [value, setValue] = useState(String(defaultValue ?? ""));
  const errorId = id ? `${id}-error` : undefined;
  const strengthId = id ? `${id}-strength` : undefined;
  const level = strength ? passwordStrength(typeof props.value === "string" ? props.value : value) : null;
  const describedBy = [error ? errorId : null, level ? strengthId : null].filter(Boolean).join(" ") || undefined;
  const filled = level === "strong" ? 3 : level === "medium" ? 2 : level === "low" ? 1 : 0;
  const barColor = level === "strong" ? "bg-green-600" : level === "medium" ? "bg-amber-500" : "bg-red-500";
  const textColor = level === "strong" ? "text-green-700" : level === "medium" ? "text-amber-700" : "text-red-600";

  return (
    <div className="space-y-1.5">
      {label ? <label htmlFor={id} className="block text-[13px] font-semibold text-[var(--qf-text)]">{label}{requiredMark ? <span aria-hidden="true" className="text-[var(--qf-danger)]"> *</span> : null}</label> : null}
      <div className="relative">
        <input {...props} id={id} type={visible ? "text" : "password"} defaultValue={props.value === undefined ? defaultValue : undefined} aria-required={requiredMark || undefined} aria-invalid={Boolean(error)} aria-describedby={describedBy} onChange={(event) => { setValue(event.target.value); onChange?.(event); }} className={`h-11 w-full rounded-lg border bg-white px-3.5 pr-11 text-sm text-[var(--qf-text)] outline-none transition placeholder:text-[var(--qf-text-light)] ${error ? "border-[var(--qf-danger)] focus:border-[var(--qf-danger)] focus:ring-3 focus:ring-[#fee2e2]" : "border-[var(--qf-border)] hover:border-[#d8d4cc] focus:border-[var(--qf-accent)] focus:ring-3 focus:ring-[var(--qf-accent-soft)]"} ${className}`} />
        <button type="button" onClick={() => setVisible((current) => !current)} aria-label={visible ? hideLabel : showLabel} aria-pressed={visible} className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-lg text-[var(--qf-text-muted)] transition hover:text-[var(--qf-accent)] focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-[var(--qf-accent)]">
          {visible ? (
            <svg viewBox="0 0 24 24" aria-hidden="true" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3l18 18" /><path d="M10.6 10.7a2 2 0 002.7 2.7" /><path d="M9.9 4.2A10.8 10.8 0 0112 4c5.5 0 9 5 9 5a15.5 15.5 0 01-2.2 2.8" /><path d="M6.2 6.2C4.2 7.5 3 9 3 9s3.5 5 9 5c1 0 2-.2 2.8-.5" /></svg>
          ) : (
            <svg viewBox="0 0 24 24" aria-hidden="true" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12s3.5-5 9-5 9 5 9 5-3.5 5-9 5-9-5-9-5z" /><circle cx="12" cy="12" r="2.5" /></svg>
          )}
        </button>
      </div>
      {strength && level ? (
        <div id={strengthId} className="space-y-1">
          <div className="flex gap-1" aria-hidden="true">
            {[0, 1, 2].map((index) => <span key={index} className={`h-1 flex-1 rounded-full ${index < filled ? barColor : "bg-[var(--qf-border)]"}`} />)}
          </div>
          <p role="status" className={`text-[11px] font-semibold ${textColor}`}>{strength[level]}</p>
        </div>
      ) : null}
      {error ? <p id={errorId} role="alert" className="text-[11px] font-medium text-[var(--qf-danger)]">{error}</p> : null}
    </div>
  );
}
