import Link from "next/link";
import { useRouter } from "next/router";
import { XMarkIcon } from "@heroicons/react/24/solid";
import { useState } from "react";
import ConfirmDialog, { type ConfirmState } from "./ui/ConfirmDialog";
import { useUploadQueue } from "./UploadQueueProvider";
import { toFaDigits } from "../utils/fa";

export default function UploadFloatingBar() {
  const router = useRouter();
  const { uploading, activeCount, overallProgress, items, cancelAll } =
    useUploadQueue();
  const [confirm, setConfirm] = useState<ConfirmState>(null);

  const onUploadPage =
    router.pathname === "/upload" || router.pathname === "/admin/upload";
  if (!uploading && activeCount === 0) return null;
  if (onUploadPage) return null;

  const hasAdmin = items.some(
    (i) =>
      i.mode === "admin" &&
      (i.status === "waiting" || i.status === "uploading"),
  );
  const href = hasAdmin ? "/admin/upload" : "/upload";

  return (
    <>
      <div className="fixed inset-x-0 bottom-0 z-[85] border-t border-[var(--af-border)] bg-[var(--af-surface)]/95 px-3 py-2.5 pb-[max(0.65rem,env(safe-area-inset-bottom))] shadow-[var(--af-shadow)] backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-[var(--af-accent)]/30 border-t-[var(--af-accent)]" />
          <div className="min-w-0 flex-1">
            <p className="fa-num truncate text-sm text-[var(--af-text)]">
              در حال ارسال {toFaDigits(activeCount)} فایل ·{" "}
              {toFaDigits(overallProgress)}٪
            </p>
            <div className="mt-1 h-1 overflow-hidden rounded-full bg-[var(--af-chip)]">
              <div
                className="h-full rounded-full bg-[var(--af-accent)] transition-[width]"
                style={{ width: `${overallProgress}%` }}
              />
            </div>
          </div>
          <Link
            href={href}
            prefetch
            className="af-focusable shrink-0 rounded-[var(--af-radius-md)] border border-[var(--af-border)] px-3 py-1.5 text-xs font-semibold text-[var(--af-text)] hover:bg-[var(--af-hover)]"
          >
            مشاهده
          </Link>
          <button
            type="button"
            title="لغو همه"
            aria-label="لغو همه"
            onClick={() =>
              setConfirm({
                title: "لغو آپلود",
                message: "همه ارسال‌های در حال انجام لغو شوند؟",
                confirmLabel: "لغو همه",
                danger: true,
                onConfirm: () => cancelAll(),
              })
            }
            className="af-focusable inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--af-radius-md)] bg-[var(--af-danger)] text-white"
          >
            <XMarkIcon className="h-4 w-4" />
          </button>
        </div>
      </div>
      <ConfirmDialog state={confirm} onClose={() => setConfirm(null)} />
    </>
  );
}
