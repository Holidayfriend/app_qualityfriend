import Image from "next/image";

export function BrandLoader({ label = "Loading", overlay = false }: { label?: string; overlay?: boolean }) {
  return <div className={overlay ? "fixed inset-0 z-[200] flex items-center justify-center bg-white/75 backdrop-blur-[2px]" : "flex min-h-[calc(100vh-150px)] items-center justify-center"} role="status" aria-live="polite">
    <div className="relative flex h-20 w-20 items-center justify-center">
      <span className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-[var(--qf-accent)] border-r-[var(--qf-accent)]" />
      <span className="absolute inset-[7px] animate-pulse rounded-full bg-white shadow-[var(--qf-shadow)]" />
      <Image src="/logo-icon.png" width={44} height={44} alt="" priority className="relative h-11 w-11 object-contain" />
      <span className="sr-only">{label}</span>
    </div>
  </div>;
}
