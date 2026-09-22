import Image from "next/image";

export function BrandLoader({ label = "Loading", overlay = false }: { label?: string; overlay?: boolean }) {
  return <div className={overlay ? "fixed inset-0 z-[200] flex flex-col items-center justify-center gap-3 bg-white/75 backdrop-blur-[2px]" : "flex min-h-[calc(100vh-150px)] items-center justify-center"} role="status" aria-live="polite">
    <div className="relative flex h-20 w-20 items-center justify-center">
      <span className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-[var(--qf-accent)] border-r-[var(--qf-accent)]" />
      <span className="absolute inset-[7px] animate-pulse rounded-full bg-white shadow-[var(--qf-shadow)]" />
      <Image src="/recruiting/logo-icon.png" width={44} height={44} alt="" priority unoptimized className="relative h-11 w-11 object-contain" />
    </div>
    <span className={overlay ? "text-sm font-medium text-[var(--qf-text-muted)]" : "sr-only"}>{label}</span>
  </div>;
}
