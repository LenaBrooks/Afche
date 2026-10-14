import { ButtonHTMLAttributes, forwardRef } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  tone?: "neutral" | "ok" | "danger" | "warn";
};

const tones = {
  neutral: "bg-white/12 text-white hover:bg-white/20",
  ok: "bg-emerald-500 text-black hover:bg-emerald-400",
  danger: "bg-red-500 text-white hover:bg-red-400",
  warn: "bg-amber-500 text-black hover:bg-amber-400",
};

const IconButton = forwardRef<HTMLButtonElement, Props>(function IconButton(
  { label, tone = "neutral", className = "", children, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      title={label}
      aria-label={label}
      className={`af-focusable inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--af-radius-md)] transition disabled:opacity-40 ${tones[tone]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
});

export default IconButton;
