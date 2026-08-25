import Image from "next/image";
import type { ReactNode } from "react";

type AuthShellProps = { children: ReactNode; eyebrow: string; title: string; description: string; brandSubtitle?: string; wide?: boolean };

export function AuthShell({ children, eyebrow, title, description, brandSubtitle = "Hotel Operations", wide = false }: AuthShellProps) {
  return (
    <main className="grid min-h-screen lg:grid-cols-[minmax(360px,0.9fr)_minmax(520px,1.1fr)]">
      <section className="relative hidden overflow-hidden bg-[var(--qf-navy)] px-12 py-10 text-white lg:flex lg:flex-col lg:justify-between xl:px-16">
        <div className="absolute -right-28 -top-28 h-80 w-80 rounded-full border border-white/10" />
        <div className="absolute -right-8 -top-8 h-44 w-44 rounded-full border border-[var(--qf-accent)]/30" />
        <div className="relative flex items-center gap-3">
          <div className="rounded-xl bg-white p-1.5 shadow-lg">
            <Image src="/logo-icon.png" alt="QualityFriend" width={40} height={40} className="h-10 w-10 rounded-lg object-contain" priority />
          </div>
          <div><p className="text-[15px] font-bold">QualityFriend</p><p className="mt-0.5 text-[11px] text-white/40">{brandSubtitle}</p></div>
        </div>
        <div className="relative max-w-md pb-10">
          <div className="mb-6 h-1 w-12 rounded-full bg-[var(--qf-accent)]" />
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--qf-accent)]">{eyebrow}</p>
          <h1 className="mt-4 text-4xl font-bold leading-tight xl:text-[42px]">{title}</h1>
          <p className="mt-5 max-w-sm text-[15px] leading-7 text-white/55">{description}</p>
        </div>
        <p className="relative text-[11px] text-white/30">© 2026 QualityFriend</p>
      </section>
      <section className="flex min-h-screen items-center justify-center bg-[var(--qf-background)] px-5 py-10 sm:px-8">
        <div className={`w-full ${wide ? "max-w-[680px]" : "max-w-[430px]"}`}>
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <div className="rounded-xl bg-white p-1 shadow-[var(--qf-shadow)]"><Image src="/logo-icon.png" alt="QualityFriend" width={38} height={38} className="h-[38px] w-[38px] rounded-lg object-contain" priority /></div>
            <div><p className="text-[15px] font-bold">QualityFriend</p><p className="text-[11px] text-[var(--qf-text-muted)]">{brandSubtitle}</p></div>
          </div>
          {children}
        </div>
      </section>
    </main>
  );
}
