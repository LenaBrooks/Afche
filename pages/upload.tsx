import type { NextPage } from "next";
import Head from "next/head";
import Link from "next/link";
import {
  AnimatePresence,
  motion,
  useReducedMotion,
} from "framer-motion";
import { FormEvent, useMemo, useRef, useState } from "react";
import { toFaDigits } from "../utils/fa";
import { snappySpring, softSpring } from "../utils/motion";

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

function uploadOne(
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

const UploadPage: NextPage = () => {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successCount, setSuccessCount] = useState(0);
  const [bannerError, setBannerError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const reduceMotion = useReducedMotion();

  const overallProgress = useMemo(() => {
    if (items.length === 0) return 0;
    const sum = items.reduce((acc, item) => {
      if (item.status === "done") return acc + 100;
      if (item.status === "error") return acc + 100;
      return acc + item.progress;
    }, 0);
    return Math.round(sum / items.length);
  }, [items]);

  function clearQueue() {
    if (
      !window.confirm(
        `همهٔ ${toFaDigits(items.length)} فایل از صف حذف شود؟`,
      )
    ) {
      return;
    }
    setItems((prev) => {
      prev.forEach((p) => URL.revokeObjectURL(p.preview));
      return [];
    });
  }

  function addFiles(list: FileList | File[]) {
    setBannerError("");
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
      const merged = [...prev, ...next].slice(0, MAX_FILES);
      if (prev.length + next.length > MAX_FILES) {
        errors.push(
          `حداکثر ${toFaDigits(MAX_FILES)} فایل می‌توانید انتخاب کنید`,
        );
      }
      return merged;
    });

    if (errors.length) setBannerError(errors.slice(0, 3).join(" · "));
    if (inputRef.current) inputRef.current.value = "";
  }

  function removeItem(id: string) {
    if (!window.confirm("این فایل از صف حذف شود؟")) return;
    setItems((prev) => {
      const target = prev.find((p) => p.id === id);
      if (target) URL.revokeObjectURL(target.preview);
      return prev.filter((p) => p.id !== id);
    });
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (items.length === 0) {
      setBannerError("ابتدا حداقل یک تصویر انتخاب کنید");
      return;
    }

    setLoading(true);
    setBannerError("");
    setShowSuccess(false);
    let ok = 0;
    let fail = 0;

    for (const item of items) {
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
      // Clear only successful items after a short beat so user sees green states
      setTimeout(() => {
        setItems((prev) => {
          prev
            .filter((p) => p.status === "done")
            .forEach((p) => URL.revokeObjectURL(p.preview));
          return prev.filter((p) => p.status !== "done");
        });
      }, 600);
    }

    if (fail > 0 && ok === 0) {
      setBannerError("هیچ فایلی آپلود نشد. خطاها را بررسی کنید.");
    } else if (fail > 0) {
      setBannerError(
        `${toFaDigits(fail)} فایل ناموفق بود. بقیه ارسال شدند.`,
      );
    }
  }

  return (
    <>
      <Head>
        <title>آپلود عکس</title>
      </Head>
      <main className="relative mx-auto flex min-h-screen max-w-2xl flex-col overflow-hidden px-4 py-12 text-white">
        {!reduceMotion && (
          <>
            <motion.div
              className="pointer-events-none absolute -top-20 right-0 h-72 w-72 rounded-full bg-[#e8c58c]/15 blur-3xl"
              animate={{ x: [0, -40, 0], y: [0, 30, 0], scale: [1, 1.2, 1] }}
              transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
            />
            <motion.div
              className="pointer-events-none absolute bottom-10 left-0 h-64 w-64 rounded-full bg-sky-400/10 blur-3xl"
              animate={{ x: [0, 30, 0], y: [0, -25, 0], scale: [1, 1.15, 1] }}
              transition={{ duration: 11, repeat: Infinity, ease: "easeInOut" }}
            />
            {Array.from({ length: 12 }).map((_, i) => (
              <motion.span
                key={i}
                className="pointer-events-none absolute h-1.5 w-1.5 rounded-full bg-white/30"
                style={{
                  top: `${10 + ((i * 17) % 80)}%`,
                  left: `${8 + ((i * 23) % 84)}%`,
                }}
                animate={{
                  y: [0, -18, 0],
                  opacity: [0.15, 0.7, 0.15],
                  scale: [1, 1.6, 1],
                }}
                transition={{
                  duration: 3 + (i % 4),
                  repeat: Infinity,
                  delay: i * 0.2,
                  ease: "easeInOut",
                }}
              />
            ))}
          </>
        )}

        <motion.div
          initial={{ opacity: 0, y: 40, rotateX: 8 }}
          animate={{ opacity: 1, y: 0, rotateX: 0 }}
          transition={softSpring}
          className="relative"
          style={{ perspective: 1000 }}
        >
          <motion.h1
            className="mb-2 text-3xl font-bold"
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ ...softSpring, delay: 0.05 }}
          >
            آپلود عکس
          </motion.h1>
          <motion.p
            className="mb-8 text-sm text-white/60"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ ...softSpring, delay: 0.12 }}
          >
            تا {toFaDigits(MAX_FILES)} عکس را یکجا انتخاب کنید. بعد از تأیید مدیر
            در گالری دیده می‌شوند.
          </motion.p>

          <form onSubmit={onSubmit} className="flex flex-col gap-5">
            <motion.label
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              whileHover={
                reduceMotion
                  ? undefined
                  : {
                      scale: 1.02,
                      borderColor: "rgba(232,197,140,0.55)",
                    }
              }
              whileTap={reduceMotion ? undefined : { scale: 0.98 }}
              transition={snappySpring}
              className="relative flex cursor-pointer flex-col items-center justify-center gap-3 overflow-hidden rounded-3xl border border-dashed border-white/30 bg-white/[0.04] px-4 py-14 text-center backdrop-blur-md"
            >
              <motion.div
                className="absolute inset-0 bg-gradient-to-br from-[#e8c58c]/10 via-transparent to-sky-400/10"
                animate={
                  reduceMotion
                    ? undefined
                    : { opacity: [0.3, 0.7, 0.3], scale: [1, 1.05, 1] }
                }
                transition={{ duration: 4, repeat: Infinity }}
              />
              <motion.span
                className="relative text-lg font-semibold"
                animate={reduceMotion ? undefined : { y: [0, -4, 0] }}
                transition={{ duration: 2.4, repeat: Infinity }}
              >
                انتخاب چند عکس
              </motion.span>
              <span className="relative text-xs text-white/50">
                JPEG، PNG، WebP، GIF · هر فایل حداکثر ۱۰ مگابایت · تا{" "}
                {toFaDigits(MAX_FILES)} فایل
              </span>
              <input
                ref={inputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                multiple
                disabled={loading}
                onChange={(e) => {
                  if (e.target.files?.length) addFiles(e.target.files);
                }}
              />
            </motion.label>

            <AnimatePresence mode="popLayout">
              {items.length > 0 && (
                <motion.div
                  layout
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-3"
                >
                  <div className="flex items-center justify-between text-xs text-white/60">
                    <span>{toFaDigits(items.length)} فایل آماده</span>
                    <button
                      type="button"
                      disabled={loading}
                      onClick={clearQueue}
                      className="text-white/70 hover:text-white disabled:opacity-40"
                    >
                      پاک کردن همه
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    <AnimatePresence mode="popLayout">
                      {items.map((item, index) => (
                        <motion.div
                          key={item.id}
                          layout
                          initial={{ opacity: 0, scale: 0.7, rotate: -6 }}
                          animate={{ opacity: 1, scale: 1, rotate: 0 }}
                          exit={{ opacity: 0, scale: 0.6, y: 20 }}
                          transition={{ ...snappySpring, delay: index * 0.04 }}
                          whileHover={
                            reduceMotion ? undefined : { y: -4, scale: 1.03 }
                          }
                          className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/40"
                        >
                          <div className="relative aspect-[3/2]">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={item.preview}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />

                            {item.status === "uploading" && (
                              <motion.div
                                className="absolute inset-0 bg-[#e8c58c]/20"
                                animate={{ opacity: [0.15, 0.4, 0.15] }}
                                transition={{ duration: 1.2, repeat: Infinity }}
                              />
                            )}

                            <div className="absolute inset-x-0 bottom-0 p-2">
                              <div className="mb-1 flex justify-between text-[10px] text-white/80">
                                <span>
                                  {item.status === "waiting" && "در صف"}
                                  {item.status === "uploading" &&
                                    `${toFaDigits(item.progress)}٪`}
                                  {item.status === "done" && "ارسال شد"}
                                  {item.status === "error" && "خطا"}
                                </span>
                              </div>
                              <div className="h-1.5 overflow-hidden rounded-full bg-white/15">
                                <motion.div
                                  className={`h-full rounded-full ${
                                    item.status === "error"
                                      ? "bg-red-400"
                                      : item.status === "done"
                                        ? "bg-emerald-400"
                                        : "bg-gradient-to-l from-white to-[#e8c58c]"
                                  }`}
                                  animate={{
                                    width: `${
                                      item.status === "done"
                                        ? 100
                                        : item.status === "error"
                                          ? 100
                                          : item.progress
                                    }%`,
                                  }}
                                  transition={{ duration: 0.2 }}
                                />
                              </div>
                              {item.error && (
                                <p className="mt-1 line-clamp-2 text-[10px] text-red-200">
                                  {toFaDigits(item.error)}
                                </p>
                              )}
                            </div>

                            {!loading && item.status !== "uploading" && (
                              <motion.button
                                type="button"
                                onClick={() => removeItem(item.id)}
                                whileTap={{ scale: 0.9 }}
                                className="absolute top-2 left-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] text-white"
                              >
                                حذف
                              </motion.button>
                            )}
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>

                  {loading && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="rounded-2xl border border-white/10 bg-white/5 p-3"
                    >
                      <div className="mb-2 flex justify-between text-xs text-white/70">
                        <span>پیشرفت کل</span>
                        <span>{toFaDigits(overallProgress)}٪</span>
                      </div>
                      <div className="h-2.5 overflow-hidden rounded-full bg-white/10">
                        <motion.div
                          className="h-full rounded-full bg-gradient-to-l from-white via-[#e8c58c] to-white"
                          animate={{ width: `${overallProgress}%` }}
                          transition={{ ease: "easeOut", duration: 0.25 }}
                        />
                      </div>
                    </motion.div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {bannerError && (
                <motion.p
                  key="err"
                  role="alert"
                  initial={{ opacity: 0, y: 10, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200"
                >
                  {toFaDigits(bannerError)}
                </motion.p>
              )}
            </AnimatePresence>

            <motion.button
              type="submit"
              disabled={loading || items.length === 0}
              whileHover={
                reduceMotion || loading || items.length === 0
                  ? undefined
                  : { scale: 1.03, y: -3 }
              }
              whileTap={
                reduceMotion || loading || items.length === 0
                  ? undefined
                  : { scale: 0.97 }
              }
              animate={
                reduceMotion || loading || items.length === 0
                  ? undefined
                  : {
                      boxShadow: [
                        "0 0 0 0 rgba(232,197,140,0.0)",
                        "0 0 40px 0 rgba(232,197,140,0.35)",
                        "0 0 0 0 rgba(232,197,140,0.0)",
                      ],
                    }
              }
              transition={{
                boxShadow: { duration: 2.4, repeat: Infinity },
                ...snappySpring,
              }}
              className="rounded-2xl border border-white bg-white px-4 py-3 text-sm font-bold text-black disabled:opacity-50"
            >
              {loading
                ? `در حال ارسال… ${toFaDigits(overallProgress)}٪`
                : items.length > 1
                  ? `ارسال ${toFaDigits(items.length)} عکس`
                  : "ارسال عکس"}
            </motion.button>
          </form>

          <Link
            href="/"
            className="mt-8 inline-block text-sm text-white/60 transition hover:text-white"
          >
            بازگشت به گالری ←
          </Link>
        </motion.div>

        <AnimatePresence>
          {showSuccess && (
            <motion.div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-md"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {!reduceMotion &&
                Array.from({ length: 24 }).map((_, i) => (
                  <motion.span
                    key={i}
                    className="pointer-events-none absolute h-2 w-2 rounded-full"
                    style={{
                      background:
                        i % 3 === 0
                          ? "#e8c58c"
                          : i % 3 === 1
                            ? "#fff"
                            : "#7dd3fc",
                      left: "50%",
                      top: "45%",
                    }}
                    initial={{ opacity: 1, x: 0, y: 0, scale: 1 }}
                    animate={{
                      opacity: 0,
                      x: (Math.random() - 0.5) * 420,
                      y: (Math.random() - 0.5) * 360,
                      scale: 0,
                    }}
                    transition={{ duration: 1.1, ease: "easeOut" }}
                  />
                ))}

              <motion.div
                initial={{ opacity: 0, scale: 0.6, y: 40, rotate: -4 }}
                animate={{ opacity: 1, scale: 1, y: 0, rotate: 0 }}
                exit={{ opacity: 0, scale: 0.85, y: 20 }}
                transition={softSpring}
                className="relative w-full max-w-sm rounded-3xl border border-white/15 bg-[#121212] p-6 text-center shadow-2xl"
              >
                <motion.div
                  className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-400/20 text-3xl text-emerald-300"
                  initial={{ scale: 0 }}
                  animate={{ scale: [0, 1.2, 1] }}
                  transition={snappySpring}
                >
                  ✓
                </motion.div>
                <h2 className="mb-2 text-xl font-bold">آپلود موفق بود</h2>
                <p className="mb-6 text-sm text-white/70">
                  {toFaDigits(successCount)} عکس ارسال شد و در صف تأیید مدیر
                  قرار گرفت. بعد از تأیید، در گالری نمایش داده می‌شود.
                </p>
                <div className="flex flex-col gap-2">
                  <motion.button
                    type="button"
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => setShowSuccess(false)}
                    className="rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-black"
                  >
                    عالی، ادامه می‌دم
                  </motion.button>
                  <Link
                    href="/admin/login"
                    className="rounded-xl border border-white/20 px-4 py-2.5 text-sm text-white/80 hover:bg-white/5"
                  >
                    رفتن به پنل مدیر
                  </Link>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </>
  );
};

export default UploadPage;
