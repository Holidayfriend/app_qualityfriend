import { forwardRef, type ButtonHTMLAttributes } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  fullWidth?: boolean;
  variant?: "primary" | "secondary" | "danger";
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button({ children, className = "", fullWidth = false, variant = "primary", type = "button", ...props }, ref) {
  const base = "inline-flex h-11 items-center justify-center rounded-[7px] px-5 text-[13px] font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--qf-accent)] disabled:cursor-not-allowed disabled:opacity-60";
  const variants = {
    primary: "border border-[var(--qf-accent)] bg-[var(--qf-accent)] text-white hover:border-[var(--qf-accent-hover)] hover:bg-[var(--qf-accent-hover)]",
    secondary: "border border-[var(--qf-border)] bg-white text-[var(--qf-text-muted)] hover:border-[var(--qf-accent)] hover:text-[var(--qf-accent)]",
    danger: "border border-[var(--qf-danger)] bg-[var(--qf-danger)] text-white hover:border-[#b91c1c] hover:bg-[#b91c1c]",
  };

  return <button ref={ref} type={type} className={`${base} ${variants[variant]} ${fullWidth ? "w-full" : ""} ${className}`} {...props}>{children}</button>;
});
