import type { ButtonHTMLAttributes } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  fullWidth?: boolean;
  variant?: "primary" | "secondary";
};

export function Button({ children, className = "", fullWidth = false, variant = "primary", type = "button", ...props }: ButtonProps) {
  const base = "inline-flex h-11 items-center justify-center rounded-[7px] px-5 text-[13px] font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--qf-accent)] disabled:cursor-not-allowed disabled:opacity-60";
  const variants = {
    primary: "border border-[var(--qf-accent)] bg-[var(--qf-accent)] text-white hover:border-[var(--qf-accent-hover)] hover:bg-[var(--qf-accent-hover)]",
    secondary: "border border-[var(--qf-border)] bg-white text-[var(--qf-text-muted)] hover:border-[var(--qf-accent)] hover:text-[var(--qf-accent)]",
  };

  return <button type={type} className={`${base} ${variants[variant]} ${fullWidth ? "w-full" : ""} ${className}`} {...props}>{children}</button>;
}
