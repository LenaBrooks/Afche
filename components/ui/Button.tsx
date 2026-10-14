import { ButtonHTMLAttributes, forwardRef } from "react";

type Variant = "primary" | "ghost" | "danger" | "soft" | "warn";

const variants: Record<Variant, string> = {
  primary:
    "border border-[var(--af-inverse)] bg-[var(--af-inverse)] text-[var(--af-inverse-text)] hover:opacity-90 disabled:hover:opacity-100",
  ghost:
    "border border-[var(--af-border)] bg-transparent text-[var(--af-text)] hover:bg-[var(--af-hover)]",
  danger:
    "border border-transparent bg-[var(--af-danger)] text-white hover:brightness-110",
  soft:
    "border border-[var(--af-border)] bg-[var(--af-surface)] text-[var(--af-text)] shadow-[var(--af-shadow-sm)] hover:border-[var(--af-border-strong)] hover:bg-[var(--af-hover)]",
  warn:
    "border border-transparent bg-[var(--af-warn)] text-white hover:brightness-110",
};

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: "sm" | "md";
  loading?: boolean;
};

const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  {
    variant = "primary",
    size = "md",
    loading,
    className = "",
    children,
    disabled,
    ...rest
  },
  ref,
) {
  const sizing =
    size === "sm" ? "px-3 py-1.5 text-xs" : "px-4 py-2.5 text-sm";
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={`af-focusable inline-flex items-center justify-center gap-2 rounded-[var(--af-radius-md)] font-semibold transition disabled:opacity-45 ${sizing} ${variants[variant]} ${className}`}
      {...rest}
    >
      {loading && (
        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
      )}
      {children}
    </button>
  );
});

export default Button;
