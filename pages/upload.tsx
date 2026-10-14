import type { NextPage } from "next";
import Head from "next/head";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { FormEvent, useEffect, useMemo, useState } from "react";
import Button from "../components/ui/Button";
import ConfirmDialog, {
  type ConfirmState,
} from "../components/ui/ConfirmDialog";
import Dropzone from "../components/ui/Dropzone";
import PageHeader from "../components/ui/PageHeader";
import { useToast } from "../components/ui/Toast";
import { formatFileSize, toFaDigits } from "../utils/fa";

const MAX_BYTES = 10 * 1024 * 1024;
const MAX_FILES = 10;
const ALLOWED = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/jpg",
]);

type QueueItem = {
  id: string;
  file: File;
  preview: string;
  status: "waiting" | "uploading" | "done" | "error";
  progress: number;
  error?: string;
};

type UploadConfig = {
  cloudName: string;
  folder: string;
  uploadPreset: string | null;
  direct: boolean;
};

let cachedUploadConfig: UploadConfig | null = null;

async function getUploadConfig(): Promise<UploadConfig> {
  if (cachedUploadConfig) return cachedUploadConfig;
  const res = await fetch("/api/upload/config");
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || "پیکربندی آپلود در دسترس نیست");
  }
  cachedUploadConfig = data as UploadConfig;
  return cachedUploadConfig;
}

function uploadViaServer(
  file: File,
  onProgress: (percent: number) => void,
): Promise<{ message?: string }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/upload");
    xhr.responseType = "json";
    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) return;
      onProgress(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onload = () => {
      const data = xhr.response || {};
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(data);
        return;
      }
      reject(new Error(data.error || "آپلود ناموفق بود"));
    };
    xhr.onerror = () => reject(new Error("خطای شبکه. دوباره تلاش کنید."));
    xhr.onabort = () => reject(new Error("آپلود لغو شد"));
    const body = new FormData();
    body.append("file", file);
    xhr.send(body);
  });
}

function uploadDirectToCloudinary(
  file: File,
  config: UploadConfig,
  onProgress: (percent: number) => void,
): Promise<{ message?: string }> {
  return new Promise((resolve, reject) => {
    if (!config.uploadPreset) {
      reject(new Error("آپلود مستقیم نیاز به Upload Preset دارد"));
      return;
    }
    const xhr = new XMLHttpRequest();
    xhr.open(
      "POST",
      `https://api.cloudinary.com/v1_1/${config.cloudName}/image/upload`,
    );
    xhr.responseType = "json";
    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) return;
      onProgress(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onload = () => {
      const data = xhr.response || {};
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve({ message: "آپلود شد" });
        return;
      }
      const msg =
        data?.error?.message || data?.error || "آپلود به Cloudinary ناموفق بود";
      reject(new Error(typeof msg === "string" ? msg : "آپلود ناموفق بود"));
    };
    xhr.onerror = () => reject(new Error("خطای شبکه. دوباره تلاش کنید."));
    xhr.onabort = () => reject(new Error("آپلود لغو شد"));
    const body = new FormData();
    body.append("file", file);
    body.append("upload_preset", config.uploadPreset);
    body.append("folder", config.folder);
    body.append("tags", "pending");
    const original = file.name.replace(/[|=]/g, "_") || "photo";
    body.append("context", `original_filename=${original}`);
    xhr.send(body);
  });
}

async function uploadOne(
  file: File,
  onProgress: (percent: number) => void,
): Promise<{ message?: string }> {
  try {
    const config = await getUploadConfig();
    if (config.direct && config.uploadPreset) {
      return uploadDirectToCloudinary(file, config, onProgress);
    }
  } catch {
    /* fall through */
  }
  return uploadViaServer(file, onProgress);
}

const STATUS_LABEL: Record<QueueItem["status"], string> = {
  waiting: "در صف",
  uploading: "در حال ارسال",
  done: "ارسال شد",
  error: "خطا",
};

const UploadPage: NextPage = () => {
  const toast = useToast();
  const [items, setItems] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successCount, setSuccessCount] = useState(0);
  const [confirm, setConfirm] = useState<ConfirmState>(null);
  const reduceMotion = useReducedMotion();

  const overallProgress = useMemo(() => {
    if (items.length === 0) return 0;
    const sum = items.reduce((acc, item) => {
      if (item.status === "done" || item.status === "error") return acc + 100;
      return acc + item.progress;
    }, 0);
    return Math.round(sum / items.length);
  }, [items]);

  useEffect(() => {
    function onPaste(e: ClipboardEvent) {
      if (loading) return;
      const files = Array.from(e.clipboardData?.files || []).filter((f) =>
        f.type.startsWith("image/"),
      );
      if (files.length) addFiles(files);
    }
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, items.length]);

  function clearQueue() {
    setConfirm({
      title: "پاک کردن صف",
      message: `همهٔ ${toFaDigits(items.length)} فایل از صف حذف شود؟`,
      confirmLabel: "پاک کردن",
      danger: true,
      onConfirm: () => {
        setItems((prev) => {
          prev.forEach((p) => URL.revokeObjectURL(p.preview));
          return [];
        });
      },
    });
  }

  function addFiles(list: FileList | File[]) {
    setShowSuccess(false);
    const incoming = Array.from(list);
    const next: QueueItem[] = [];
    const errors: string[] = [];

    for (const file of incoming) {
      if (!ALLOWED.has(file.type)) {
        errors.push(`${file.name}: فرمت مجاز نیست`);
        continue;
      }
      if (file.size > MAX_BYTES) {
        errors.push(`${file.name}: بیشتر از ۱۰ مگابایت`);
        continue;
      }
      next.push({
        id: `${file.name}-${file.size}-${file.lastModified}-${Math.random()}`,
        file,
        preview: URL.createObjectURL(file),
        status: "waiting",
        progress: 0,
      });
    }

    setItems((prev) => {
      const room = MAX_FILES - prev.length;
      if (next.length > room) {
        errors.push(
          `حداکثر ${toFaDigits(MAX_FILES)} فایل می‌توانید انتخاب کنید`,
        );
      }
      const accepted = next.slice(0, Math.max(0, room));
      return [...prev, ...accepted];
    });

    if (errors.length) toast.error(errors.slice(0, 2).join(" · "));
  }

  function removeItem(id: string) {
    setConfirm({
      title: "حذف از صف",
      message: "این فایل از صف حذف شود؟",
      confirmLabel: "حذف",
      danger: true,
      onConfirm: () => {
        setItems((prev) => {
          const target = prev.find((p) => p.id === id);
          if (target) URL.revokeObjectURL(target.preview);
          return prev.filter((p) => p.id !== id);
        });
      },
    });
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (items.length === 0) {
      toast.error("ابتدا حداقل یک تصویر انتخاب کنید");
      return;
    }

    setLoading(true);
    setShowSuccess(false);
    let ok = 0;
    let fail = 0;
    const snapshot = [...items];

    for (const item of snapshot) {
      if (item.status === "done") {
        ok += 1;
        continue;
      }

      setItems((prev) =>
        prev.map((p) =>
          p.id === item.id
            ? { ...p, status: "uploading", progress: 0, error: undefined }
            : p,
        ),
      );

      try {
        await uploadOne(item.file, (percent) => {
          setItems((prev) =>
            prev.map((p) =>
              p.id === item.id ? { ...p, progress: percent } : p,
            ),
          );
        });
        ok += 1;
        setItems((prev) =>
          prev.map((p) =>
            p.id === item.id ? { ...p, status: "done", progress: 100 } : p,
          ),
        );
      } catch (err: any) {
        fail += 1;
        setItems((prev) =>
          prev.map((p) =>
            p.id === item.id
              ? {
                  ...p,
                  status: "error",
                  progress: 0,
                  error: err.message || "ناموفق",
                }
              : p,
          ),
        );
      }
    }

    setLoading(false);

    if (ok > 0) {
      setSuccessCount(ok);
      setShowSuccess(true);
      setTimeout(() => {
        setItems((prev) => {
          prev
            .filter((p) => p.status === "done")
            .forEach((p) => URL.revokeObjectURL(p.preview));
          return prev.filter((p) => p.status !== "done");
        });
      }, 500);
    }

    if (fail > 0 && ok === 0) {
      toast.error("هیچ فایلی آپلود نشد. خطاها را بررسی کنید.");
    } else if (fail > 0) {
      toast.error(`${toFaDigits(fail)} فایل ناموفق بود. بقیه ارسال شدند.`);
    }
  }

  return (
    <>
      <Head>
        <title>آپلود عکس</title>
      </Head>
      <main className="mx-auto min-h-screen max-w-2xl px-3 py-8 text-[var(--af-text)] sm:px-4 sm:py-10">
        <PageHeader
          title="آپلود عکس"
          subtitle="عکس‌ها بعد از تأیید مدیر در گالری منتشر می‌شوند."
        />

        <form
          onSubmit={onSubmit}
          className="flex flex-col gap-5 pb-[calc(6rem+env(safe-area-inset-bottom))] sm:pb-28"
        >
          <Dropzone
            disabled={loading}
            onFiles={addFiles}
            hint={`JPEG، PNG، WebP، GIF · هر فایل حداکثر ۱۰ مگابایت · تا ${toFaDigits(MAX_FILES)} فایل · می‌توانید Paste هم کنید`}
          />

          <div className="flex flex-wrap gap-2">
            {["JPEG / PNG / WebP / GIF", "حداکثر ۱۰ مگابایت", `تا ${toFaDigits(MAX_FILES)} فایل`].map(
              (chip) => (
                <span
                  key={chip}
                  className="rounded-full border border-[var(--af-border)] bg-[var(--af-surface)] px-2.5 py-1 text-[11px] text-[var(--af-muted)]"
                >
                  {chip}
                </span>
              ),
            )}
          </div>

          <div aria-live="polite" className="sr-only">
            {loading
              ? `در حال ارسال ${toFaDigits(overallProgress)} درصد`
              : `${toFaDigits(items.length)} فایل در صف`}
          </div>

          <AnimatePresence mode="popLayout">
            {items.length > 0 && (
              <motion.div
                initial={reduceMotion ? false : { opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="space-y-3"
              >
                <div className="flex items-center justify-between text-xs text-[var(--af-muted)]">
                  <span>{toFaDigits(items.length)} فایل در صف</span>
                  <button
                    type="button"
                    disabled={loading}
                    onClick={clearQueue}
                    className="af-focusable rounded-md px-2 py-1 hover:text-[var(--af-text)] disabled:opacity-40"
                  >
                    پاک کردن همه
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {items.map((item) => (
                    <div
                      key={item.id}
                      className="overflow-hidden rounded-[var(--af-radius-md)] border border-[var(--af-border)] bg-[var(--af-surface)]"
                    >
                      <div className="relative aspect-[3/2]">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={item.preview}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent" />
                        {!loading && item.status !== "uploading" && (
                          <button
                            type="button"
                            onClick={() => removeItem(item.id)}
                            className="af-focusable absolute top-2 left-2 rounded-full bg-black/65 px-2 py-1 text-[10px] text-white"
                          >
                            حذف
                          </button>
                        )}
                        <div className="absolute inset-x-0 bottom-0 p-2.5">
                          <div className="mb-1 flex items-center justify-between gap-2 text-[10px]">
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
                            <span className="text-white/55">
                              {formatFileSize(item.file.size)}
                            </span>
                          </div>
                          <div className="h-1.5 overflow-hidden rounded-full bg-white/15">
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
                                  item.status === "done" ||
                                  item.status === "error"
                                    ? 100
                                    : item.progress
                                }%`,
                              }}
                            />
                          </div>
                        </div>
                      </div>
                      <div className="space-y-1 px-3 py-2">
                        <p className="truncate text-sm font-medium">
                          {item.file.name}
                        </p>
                        {item.error && (
                          <p className="line-clamp-2 text-[11px] text-red-200">
                            {toFaDigits(item.error)}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {loading && (
                  <div className="rounded-[var(--af-radius-md)] border border-[var(--af-border)] bg-[var(--af-surface)] p-3">
                    <div className="mb-2 flex justify-between text-xs text-[var(--af-muted)]">
                      <span>پیشرفت کل</span>
                      <span>{toFaDigits(overallProgress)}٪</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-white/10">
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

          <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--af-border)] bg-[var(--af-bg)]/95 px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-sm sm:static sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
            <div className="mx-auto flex max-w-2xl gap-3">
              <Button
                type="submit"
                disabled={loading || items.length === 0}
                loading={loading}
                className="w-full"
              >
                {loading
                  ? `در حال ارسال… ${toFaDigits(overallProgress)}٪`
                  : items.length > 1
                    ? `ارسال ${toFaDigits(items.length)} عکس`
                    : "ارسال عکس"}
              </Button>
            </div>
          </div>
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
                initial={reduceMotion ? false : { opacity: 0, y: 20, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10 }}
                className="w-full max-w-sm rounded-[var(--af-radius-lg)] border border-[var(--af-border)] bg-[var(--af-surface)] p-6 text-center shadow-[var(--af-shadow)]"
              >
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--af-ok-soft)] text-2xl text-[var(--af-ok)]">
                  ✓
                </div>
                <h2 className="mb-2 text-xl font-bold">آپلود موفق بود</h2>
                <p className="mb-6 text-sm leading-6 text-[var(--af-muted)]">
                  {toFaDigits(successCount)} عکس ارسال شد و در صف تأیید مدیر قرار
                  گرفت.
                </p>
                <div className="flex flex-col gap-2">
                  <Button type="button" onClick={() => setShowSuccess(false)}>
                    آپلود بیشتر
                  </Button>
                  <Link
                    href="/"
                    prefetch
                    className="af-focusable rounded-[var(--af-radius-md)] border border-[var(--af-border)] px-4 py-2.5 text-sm text-[var(--af-muted)] hover:bg-[var(--af-hover)] hover:text-[var(--af-text)]"
                  >
                    بازگشت به گالری
                  </Link>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <ConfirmDialog state={confirm} onClose={() => setConfirm(null)} />
      </main>
    </>
  );
};

export default UploadPage;
