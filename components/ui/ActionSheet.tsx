import { useEffect } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

export type ActionSheetItem = {
  id: string;
  label: string;
  tone?: "default" | "ok" | "danger" | "warn";
  onClick: () => void;
};

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  actions: ActionSheetItem[];
};

const toneClass: Record<NonNullable<ActionSheetItem["tone"]>, string> = {
  default:
    "bg-[var(--af-surface-2)] text-[var(--af-text)] hover:bg-[var(--af-hover-strong)]",
  ok: "bg-[var(--af-ok-soft)] text-[var(--af-ok)] hover:brightness-95",
  danger: "bg-[var(--af-danger-soft)] text-[var(--af-danger)] hover:brightness-95",
  warn: "bg-[var(--af-warn-soft)] text-[var(--af-warn)] hover:brightness-95",
};

export default function ActionSheet({
  open,
  onClose,
  title,
  subtitle,
  actions,
}: Props) {
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[75] flex items-end justify-center sm:items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.15 }}
        >
          <button
            type="button"
            aria-label="بستن"
            className="absolute inset-0 bg-black/70"
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="af-sheet-title"
            initial={
              reduceMotion ? false : { y: 40, opacity: 0.8, scale: 0.98 }
            }
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={reduceMotion ? undefined : { y: 24, opacity: 0 }}
            transition={{ type: "spring", stiffness: 420, damping: 36 }}
            className="relative z-10 w-full max-w-lg rounded-t-[1.25rem] border border-[var(--af-border)] bg-[var(--af-surface)] p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-[var(--af-shadow)] sm:rounded-[var(--af-radius-lg)] sm:p-5"
          >
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-[var(--af-chip)] sm:hidden" />
            <h2
              id="af-sheet-title"
              className="truncate text-base font-semibold text-[var(--af-text)]"
            >
              {title}
            </h2>
            {subtitle && (
              <p className="fa-num mt-1 truncate text-xs text-[var(--af-muted)]">
                {subtitle}
              </p>
            )}
            <div className="mt-4 flex flex-col gap-2">
              {actions.map((action) => (
                <button
                  key={action.id}
                  type="button"
                  onClick={() => {
                    action.onClick();
                    onClose();
                  }}
                  className={`af-focusable flex min-h-12 w-full items-center justify-center rounded-[var(--af-radius-md)] px-4 text-sm font-medium transition ${
                    toneClass[action.tone || "default"]
                  }`}
                >
                  {action.label}
                </button>
              ))}
              <button
                type="button"
                onClick={onClose}
                className="af-focusable mt-1 flex min-h-11 w-full items-center justify-center rounded-[var(--af-radius-md)] border border-[var(--af-border)] text-sm text-[var(--af-muted)] hover:bg-[var(--af-hover)] hover:text-[var(--af-text)]"
              >
                بستن
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
