import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { AnimatePresence, motion } from "framer-motion";

type ToastKind = "ok" | "error" | "info";

type ToastItem = {
  id: string;
  kind: ToastKind;
  message: string;
};

type ToastApi = {
  push: (message: string, kind?: ToastKind) => void;
  success: (message: string) => void;
  error: (message: string) => void;
};

const ToastContext = createContext<ToastApi | null>(null);

const kindClass: Record<ToastKind, string> = {
  ok: "bg-[var(--af-ok-soft)] text-[var(--af-ok)] shadow-[0_0_24px_-6px_rgba(52,211,153,0.45)]",
  error:
    "bg-[var(--af-danger-soft)] text-[var(--af-danger)] shadow-[0_0_24px_-6px_rgba(248,113,113,0.4)]",
  info: "bg-[var(--af-surface-2)] text-[var(--af-text)] shadow-[var(--af-shadow)]",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const push = useCallback((message: string, kind: ToastKind = "info") => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setItems((prev) => [...prev.slice(-3), { id, kind, message }]);
    window.setTimeout(() => {
      setItems((prev) => prev.filter((t) => t.id !== id));
    }, 3200);
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      push,
      success: (message) => push(message, "ok"),
      error: (message) => push(message, "error"),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[90] flex flex-col items-center gap-2 px-4">
        <AnimatePresence>
          {items.map((t) => (
            <motion.div
              key={t.id}
              role="status"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              className={`fa-num pointer-events-auto max-w-md rounded-[var(--af-radius-md)] px-4 py-2.5 text-sm backdrop-blur-sm ${kindClass[t.kind]}`}
            >
              {t.message}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    return {
      push: () => {},
      success: () => {},
      error: () => {},
    } as ToastApi;
  }
  return ctx;
}
