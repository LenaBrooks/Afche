import { useEffect } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import Button from "./Button";

export type ConfirmState = {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
} | null;

type Props = {
  state: ConfirmState;
  onClose: () => void;
};

export default function ConfirmDialog({ state, onClose }: Props) {
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (!state) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state, onClose]);

  return (
    <AnimatePresence>
      {state && (
        <motion.div
          className="fixed inset-0 z-[80] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.15 }}
        >
          <button
            type="button"
            aria-label="بستن"
            className="absolute inset-0 bg-black/80"
            onClick={onClose}
          />
          <motion.div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="af-confirm-title"
            aria-describedby="af-confirm-desc"
            initial={reduceMotion ? false : { opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduceMotion ? undefined : { opacity: 0, y: 8, scale: 0.98 }}
            className="relative z-10 w-full max-w-sm rounded-[var(--af-radius-lg)] border border-[var(--af-border)] bg-[var(--af-surface)] p-5 shadow-[var(--af-shadow)]"
          >
            <h2
              id="af-confirm-title"
              className="mb-2 text-lg font-semibold text-[var(--af-text)]"
            >
              {state.title}
            </h2>
            <p
              id="af-confirm-desc"
              className="fa-num mb-5 text-sm leading-6 text-[var(--af-muted)]"
            >
              {state.message}
            </p>
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="ghost" onClick={onClose}>
                {state.cancelLabel || "لغو"}
              </Button>
              <Button
                variant={state.danger ? "danger" : "primary"}
                onClick={() => {
                  state.onConfirm();
                  onClose();
                }}
              >
                {state.confirmLabel || "تأیید"}
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
