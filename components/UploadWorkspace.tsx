import Link from "next/link";
import { useRouter } from "next/router";
import { FormEvent, useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { XMarkIcon } from "@heroicons/react/24/solid";
import Button from "./ui/Button";
import ConfirmDialog, { type ConfirmState } from "./ui/ConfirmDialog";
import Dropzone from "./ui/Dropzone";
import PageHeader from "./ui/PageHeader";
import { useToast } from "./ui/Toast";
import {
  useUploadQueue,
  type UploadMode,
} from "./UploadQueueProvider";
import { invalidateAdminCache } from "../utils/adminCache";
import { formatFileSize, toFaDigits } from "../utils/fa";

const STATUS_LABEL = {
  waiting: "در صف",
  uploading: "در حال ارسال",
  done: "ارسال شد",
  error: "خطا",
} as const;

type Props = {
  mode: UploadMode;
  title: string;
  subtitle: string;
  backHref: string;
  backLabel: string;
  successHint: string;
};

export default function UploadWorkspace({
  mode,
  title,
  subtitle,
  backHref,
  backLabel,
  successHint,
}: Props) {
  const router = useRouter();
  const toast = useToast();
  const reduceMotion = useReducedMotion();
  const {
    uploading,
    overallProgress,
    addFiles,
    cancelItem,
    cancelAll,
    startUpload,
    clearDone,
    itemsFor,
  } = useUploadQueue();

  const items = itemsFor(mode);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successCount, setSuccessCount] = useState(0);
  const [confirm, setConfirm] = useState<ConfirmState>(null);

  function afterSuccessPrimary() {
    setShowSuccess(false);
    if (mode === "admin") {
      invalidateAdminCache("approved");
      void router.push("/admin?tab=approved");
    }
  }

  useEffect(() => {
    function onPaste(e: ClipboardEvent) {
      if (uploading) return;
      const files = Array.from(e.clipboardData?.files || []).filter((f) =>
        f.type.startsWith("image/"),
      );
      if (files.length) {
        const errors = addFiles(files, mode);
        if (errors.length) toast.error(errors.slice(0, 2).join(" · "));
      }
    }
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [uploading, addFiles, mode, toast]);

  function onPick(files: FileList | File[]) {
    setShowSuccess(false);
    const errors = addFiles(files, mode);
    if (errors.length) toast.error(errors.slice(0, 2).join(" · "));
  }

  function askCancelItem(id: string) {
    setConfirm({
      title: "لغو این فایل",
      message: "ارسال این فایل متوقف و از صف حذف شود؟",
      confirmLabel: "لغو و حذف",
      danger: true,
      onConfirm: () => cancelItem(id),
    });
  }

  function askCancelAll() {
    if (items.length === 0) return;
    setConfirm({
      title: "لغو همه آپلودها",
      message: `همهٔ ${toFaDigits(items.length)} فایل لغو و از صف پاک شوند؟`,
      confirmLabel: "لغو همه",
      danger: true,
      onConfirm: () => {
        cancelAll(mode);
        toast.push("آپلود لغو شد");
      },
    });
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (items.length === 0) {
      toast.error("ابتدا حداقل یک تصویر انتخاب کنید");
      return;
    }
    setShowSuccess(false);
    const { ok, fail } = await startUpload(mode);
    if (ok > 0) {
      setSuccessCount(ok);
      setShowSuccess(true);
      window.setTimeout(() => clearDone(), 600);
    }
    if (fail > 0 && ok === 0) {
      toast.error("هیچ فایلی آپلود نشد.");
    } else if (fail > 0) {
      toast.error(`${toFaDigits(fail)} فایل ناموفق بود.`);
    }
  }

  return (
    <main className="af-admin mx-auto min-h-screen max-w-2xl px-3 py-8 text-[var(--af-text)] sm:px-4 sm:py-10">
      <PageHeader
        title={title}
        subtitle={subtitle}
        backHref={backHref}
        backLabel={backLabel}
        trailing={
          items.length > 0 ? (
            <button
              type="button"
              title="لغو همه"
              aria-label="لغو همه"
              onClick={askCancelAll}
              className="af-focusable inline-flex h-10 w-10 items-center justify-center rounded-[var(--af-radius-md)] border border-[var(--af-danger)]/40 bg-[var(--af-danger-soft)] text-[var(--af-danger)] hover:brightness-95"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          ) : undefined
        }
      />

      <form
        onSubmit={onSubmit}
        className="flex flex-col gap-5 pb-[calc(6rem+env(safe-area-inset-bottom))] sm:pb-28"
      >
        <Dropzone
          disabled={uploading}
          onFiles={onPick}
          hint="JPG · PNG · WebP · GIF · تا ۱۰ مگ · ۳۰ فایل"
        />

        <AnimatePresence mode="popLayout">
          {items.length > 0 && (
            <motion.div
              initial={reduceMotion ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="space-y-3"
            >
              <div className="flex items-center justify-between text-xs text-[var(--af-muted)]">
                <span className="fa-num">{toFaDigits(items.length)} فایل در صف</span>
                <button
                  type="button"
                  onClick={askCancelAll}
                  className="af-focusable inline-flex items-center gap-1 rounded-md px-2 py-1 text-[var(--af-danger)] hover:bg-[var(--af-danger-soft)]"
                >
                  <XMarkIcon className="h-3.5 w-3.5" />
                  لغو همه
                </button>
              </div>

              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className="overflow-hidden rounded-[var(--af-radius-md)] bg-[var(--af-surface)] shadow-[var(--af-shadow-sm)]"
                  >
                    <div className="relative aspect-square">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={item.preview}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                      <button
                        type="button"
                        title="لغو"
                        aria-label="لغو"
                        onClick={() => askCancelItem(item.id)}
                        className="af-focusable absolute top-1 left-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-[var(--af-danger)] text-white shadow"
                      >
                        <XMarkIcon className="h-3.5 w-3.5" />
                      </button>
                      <div className="absolute inset-x-0 bottom-0 p-1.5">
                        <div className="mb-0.5 flex items-center justify-between gap-1 text-[9px]">
                          <span
                            className={
                              item.status === "error"
                                ? "text-red-200"
                                : item.status === "done"
                                  ? "text-emerald-200"
                                  : "text-white/85"
                            }
                          >
                            {item.status === "uploading"
                              ? `${toFaDigits(item.progress)}٪`
                              : STATUS_LABEL[item.status]}
                          </span>
                          <span className="truncate text-white/50">
                            {formatFileSize(item.file.size)}
                          </span>
                        </div>
                        <div className="h-1 overflow-hidden rounded-full bg-white/15">
                          <div
                            className={`h-full rounded-full transition-[width] duration-200 ${
                              item.status === "error"
                                ? "bg-red-400"
                                : item.status === "done"
                                  ? "bg-emerald-400"
                                  : "bg-[var(--af-accent)]"
                            }`}
                            style={{
                              width: `${
                                item.status === "done" || item.status === "error"
                                  ? 100
                                  : item.progress
                              }%`,
                            }}
                          />
                        </div>
                      </div>
                    </div>
                    <p className="truncate px-1.5 py-1 text-[10px] text-[var(--af-muted)]">
                      {item.file.name}
                    </p>
                    {item.error && (
                      <p className="fa-num line-clamp-2 px-1.5 pb-1.5 text-[10px] text-[var(--af-danger)]">
                        {toFaDigits(item.error)}
                      </p>
                    )}
                  </div>
                ))}
              </div>

              {uploading && (
                <div className="rounded-[var(--af-radius-md)] border border-[var(--af-border)] bg-[var(--af-surface)] p-3">
                  <div className="mb-2 flex justify-between text-xs text-[var(--af-muted)]">
                    <span>پیشرفت کل</span>
                    <span className="fa-num">{toFaDigits(overallProgress)}٪</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-[var(--af-chip)]">
                    <div
                      className="h-full rounded-full bg-[var(--af-accent)] transition-[width] duration-200"
                      style={{ width: `${overallProgress}%` }}
                    />
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {(items.length > 0 || uploading) && (
          <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--af-border)] bg-[var(--af-surface)]/95 px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-sm sm:static sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
            <div className="mx-auto flex max-w-2xl gap-2">
              <Button
                type="button"
                variant="danger"
                className="shrink-0 !px-3"
                onClick={askCancelAll}
                title="لغو همه"
              >
                <XMarkIcon className="h-5 w-5" />
              </Button>
              <Button
                type="submit"
                disabled={uploading}
                loading={uploading}
                className="w-full"
              >
                {uploading
                  ? `در حال ارسال… ${toFaDigits(overallProgress)}٪`
                  : items.length > 1
                    ? `ارسال ${toFaDigits(items.length)} عکس`
                    : "ارسال عکس"}
              </Button>
            </div>
          </div>
        )}
      </form>

      <AnimatePresence>
        {showSuccess && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              initial={
                reduceMotion ? false : { opacity: 0, y: 20, scale: 0.96 }
              }
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10 }}
              className="w-full max-w-sm rounded-[var(--af-radius-lg)] border border-[var(--af-border)] bg-[var(--af-surface)] p-6 text-center shadow-[var(--af-shadow)]"
            >
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--af-ok-soft)] text-2xl text-[var(--af-ok)]">
                ✓
              </div>
              <h2 className="mb-2 text-xl font-bold">آپلود موفق بود</h2>
              <p className="fa-num mb-6 text-sm leading-6 text-[var(--af-muted)]">
                {toFaDigits(successCount)} عکس ارسال شد. {successHint}
              </p>
              <div className="flex flex-col gap-2">
                <Button type="button" onClick={afterSuccessPrimary}>
                  آپلود بیشتر
                </Button>
                <Link
                  href={backHref}
                  prefetch
                  onClick={() => {
                    if (mode === "admin") invalidateAdminCache("approved");
                  }}
                  className="af-focusable rounded-[var(--af-radius-md)] border border-[var(--af-border)] px-4 py-2.5 text-sm text-[var(--af-muted)] hover:bg-[var(--af-hover)] hover:text-[var(--af-text)]"
                >
                  {backLabel}
                </Link>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <ConfirmDialog state={confirm} onClose={() => setConfirm(null)} />
    </main>
  );
}
