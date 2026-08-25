import type { ReactNode } from "react";

type AuthCardProps = { children: ReactNode; title: string; subtitle: string };

export function AuthCard({ children, title, subtitle }: AuthCardProps) {
  return (
    <div className="rounded-[var(--qf-radius)] border border-[var(--qf-border)] bg-[var(--qf-surface)] p-6 shadow-[var(--qf-shadow)] sm:p-8">
      <header className="mb-7">
        <h2 className="text-[26px] font-bold tracking-[-0.02em] text-[var(--qf-text)]">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-[var(--qf-text-muted)]">{subtitle}</p>
      </header>
      {children}
    </div>
  );
}
