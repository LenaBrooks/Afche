import type { GetServerSideProps, NextPage } from "next";
import Head from "next/head";
import Link from "next/link";
import {
  CheckIcon,
  ChevronDownIcon,
  EyeIcon,
  EyeSlashIcon,
  Squares2X2Icon,
  TrashIcon,
  XMarkIcon,
} from "@heroicons/react/24/solid";
import { ListBulletIcon } from "@heroicons/react/24/outline";
import { AnimatePresence, motion } from "framer-motion";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  getAdminCache,
  invalidateAdminCache,
  setAdminCache,
  type AdminPhoto,
} from "../../utils/adminCache";
import { isAuthenticated } from "../../utils/auth";
import {
  formatFileSize,
  formatJalaliDate,
  toFaDigits,
} from "../../utils/fa";
import { softSpring } from "../../utils/motion";
import { lightboxUrl } from "../../utils/cloudinaryUrl";

type Tab = "pending" | "approved" | "hidden";
type ViewMode = "grid" | "list";
type SortKey =
  | "date-desc"
  | "date-asc"
  | "size-desc"
  | "size-asc"
  | "name-asc"
  | "name-desc";

const TABS: { id: Tab; label: string }[] = [
  { id: "pending", label: "در انتظار" },
  { id: "approved", label: "منتشرشده" },
  { id: "hidden", label: "متوقف‌شده" },
];

const SORT_OPTIONS: { id: SortKey; label: string }[] = [
  { id: "date-desc", label: "جدیدترین" },
  { id: "date-asc", label: "قدیمی‌ترین" },
  { id: "size-desc", label: "بزرگ‌ترین حجم" },
  { id: "size-asc", label: "کوچک‌ترین حجم" },
  { id: "name-asc", label: "نام (الف → ی)" },
  { id: "name-desc", label: "نام (ی → الف)" },
];

const ACTION_LABELS: Record<string, string> = {
  approve: "تأیید و انتشار",
  reject: "رد و حذف",
  hide: "توقف انتشار",
  unhide: "انتشار مجدد",
  delete: "حذف",
};

function fullUrl(photo: AdminPhoto) {
  return lightboxUrl(photo.public_id, photo.format);
}

/** Client-cache tabs that may go stale after an action on `fromTab`. */
function relatedTabs(fromTab: Tab, action: string): Tab[] {
  const tabs = new Set<Tab>([fromTab]);
  if (action === "approve") tabs.add("approved");
  if (action === "hide") tabs.add("hidden");
  if (action === "unhide") {
    tabs.add("approved");
    tabs.add("hidden");
  }
  if (action === "delete" || action === "reject") {
    tabs.add("pending");
    tabs.add("approved");
    tabs.add("hidden");
  }
  return Array.from(tabs);
}

function photoDate(photo: AdminPhoto) {
  return photo.approved_at || photo.created_at || "";
}

function sortPhotos(list: AdminPhoto[], sort: SortKey) {
  const next = [...list];
  next.sort((a, b) => {
    switch (sort) {
      case "size-desc":
        return (b.bytes || 0) - (a.bytes || 0);
      case "size-asc":
        return (a.bytes || 0) - (b.bytes || 0);
      case "name-asc":
        return a.filename.localeCompare(b.filename, "fa");
      case "name-desc":
        return b.filename.localeCompare(a.filename, "fa");
      case "date-asc":
        return (
          new Date(photoDate(a) || 0).getTime() -
          new Date(photoDate(b) || 0).getTime()
        );
      case "date-desc":
      default:
        return (
          new Date(photoDate(b) || 0).getTime() -
          new Date(photoDate(a) || 0).getTime()
        );
    }
  });
  return next;
}

const AdminPanel: NextPage = () => {
  const [tab, setTab] = useState<Tab>("pending");
  const [photos, setPhotos] = useState<AdminPhoto[]>(
    () => getAdminCache("pending") || [],
  );
  const [loading, setLoading] = useState(() => !getAdminCache("pending"));
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [sortKey, setSortKey] = useState<SortKey>("date-desc");
  const [sortOpen, setSortOpen] = useState(false);
  const [query, setQuery] = useState("");
  const sortRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!sortOpen) return;
    function onDoc(e: MouseEvent) {
      if (!sortRef.current?.contains(e.target as Node)) setSortOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setSortOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [sortOpen]);

  const load = useCallback(async (status: Tab, opts?: { silent?: boolean }) => {
    const cached = getAdminCache(status);
    const silent = opts?.silent || Boolean(cached);

    if (cached) {
      setPhotos(cached);
      setLoading(false);
    } else if (!silent) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }

    setError("");
    try {
      const res = await fetch(`/api/admin/photos?status=${status}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "بارگذاری ناموفق بود");
      }
      const data = await res.json();
      const list = data.photos || [];
      setAdminCache(status, list);
      setPhotos(list);
      setSelected(new Set());
    } catch (e: any) {
      if (!cached) {
        setError(e.message || "بارگذاری ناموفق بود");
        setPhotos([]);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const cached = getAdminCache(tab);
    if (cached) {
      setPhotos(cached);
      setLoading(false);
      setSelected(new Set());
      load(tab, { silent: true });
    } else {
      load(tab);
    }
  }, [tab, load]);

  // Prefetch other tabs while idle so switching feels instant
  useEffect(() => {
    const others = TABS.map((t) => t.id).filter((id) => id !== tab);
    let cancelled = false;
    const run = () => {
      others.forEach((status) => {
        if (cancelled || getAdminCache(status)) return;
        fetch(`/api/admin/photos?status=${status}`)
          .then((res) => (res.ok ? res.json() : null))
          .then((data) => {
            if (!cancelled && data?.photos) setAdminCache(status, data.photos);
          })
          .catch(() => {});
      });
    };
    const ric = (window as any).requestIdleCallback as
      | undefined
      | ((cb: () => void) => number);
    const id = ric ? ric(run) : window.setTimeout(run, 400);
    return () => {
      cancelled = true;
      if (ric && typeof (window as any).cancelIdleCallback === "function") {
        (window as any).cancelIdleCallback(id);
      } else {
        clearTimeout(id);
      }
    };
  }, [tab]);

  const visiblePhotos = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? photos.filter(
          (p) =>
            p.filename.toLowerCase().includes(q) ||
            p.public_id.toLowerCase().includes(q),
        )
      : photos;
    return sortPhotos(filtered, sortKey);
  }, [photos, query, sortKey]);

  useEffect(() => {
    if (previewIndex === null) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setPreviewIndex(null);
      if (e.key === "ArrowLeft" && previewIndex! < visiblePhotos.length - 1) {
        setPreviewIndex(previewIndex! + 1);
      }
      if (e.key === "ArrowRight" && previewIndex! > 0) {
        setPreviewIndex(previewIndex! - 1);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [previewIndex, visiblePhotos.length]);

  useEffect(() => {
    if (previewIndex !== null && previewIndex >= visiblePhotos.length) {
      setPreviewIndex(visiblePhotos.length > 0 ? visiblePhotos.length - 1 : null);
    }
  }, [visiblePhotos.length, previewIndex]);

  const allSelected = useMemo(
    () =>
      visiblePhotos.length > 0 &&
      visiblePhotos.every((p) => selected.has(p.public_id)),
    [visiblePhotos, selected],
  );

  const totalBytes = useMemo(
    () => visiblePhotos.reduce((sum, p) => sum + (p.bytes || 0), 0),
    [visiblePhotos],
  );

  const previewPhoto =
    previewIndex !== null ? visiblePhotos[previewIndex] : undefined;

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (allSelected) {
      setSelected(new Set());
      return;
    }
    setSelected(new Set(visiblePhotos.map((p) => p.public_id)));
  }

  function confirmDestructive(action: string, count: number) {
    if (action !== "delete" && action !== "reject") return true;
    const label =
      action === "reject"
        ? "رد و حذف دائمی"
        : "حذف دائمی";
    return window.confirm(
      `${label} ${toFaDigits(count)} عکس؟ این کار قابل بازگشت نیست.`,
    );
  }

  function applyOptimisticRemoval(ids: string[], action: string) {
    const remove = new Set(ids);
    setPhotos((prev) => {
      const next = prev.filter((p) => !remove.has(p.public_id));
      setAdminCache(tab, next);
      return next;
    });
    setSelected((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.delete(id));
      return next;
    });
    setPreviewIndex(null);
    for (const t of relatedTabs(tab, action)) {
      if (t !== tab) invalidateAdminCache(t);
    }
  }

  async function runAction(publicId: string, action: string) {
    if (!confirmDestructive(action, 1)) return;
    setBusyId(publicId);
    setError("");
    setSuccess("");
    try {
      const res = await fetch(
        `/api/admin/photos/${publicId
          .split("/")
          .map(encodeURIComponent)
          .join("/")}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        },
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "عملیات ناموفق بود");
      }
      setSuccess(`${ACTION_LABELS[action] || "انجام شد"} — ${toFaDigits(1)} عکس`);
      applyOptimisticRemoval([publicId], action);
    } catch (e: any) {
      setError(e.message || "عملیات ناموفق بود");
    } finally {
      setBusyId(null);
    }
  }

  async function runBulk(action: string, ids?: string[]) {
    const publicIds = ids || Array.from(selected);
    if (publicIds.length === 0) {
      setError("هیچ عکسی انتخاب نشده است");
      return;
    }
    if (!confirmDestructive(action, publicIds.length)) return;
    setBulkBusy(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch("/api/admin/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, publicIds }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "عملیات گروهی ناموفق بود");
      }
      const label = ACTION_LABELS[action] || "انجام شد";
      setSuccess(
        data.failed
          ? `${label}: ${toFaDigits(data.processed)} موفق، ${toFaDigits(data.failed)} ناموفق`
          : `${label}: ${toFaDigits(data.processed)} عکس`,
      );
      applyOptimisticRemoval(publicIds, action);
      if (data.failed) {
        invalidateAdminCache(tab);
        await load(tab, { silent: true });
      }
    } catch (e: any) {
      setError(e.message || "عملیات گروهی ناموفق بود");
    } finally {
      setBulkBusy(false);
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/admin/login";
  }

  const busy = bulkBusy || busyId !== null;

  function iconBtn(
    label: string,
    onClick: () => void,
    className: string,
    children: ReactNode,
  ) {
    return (
      <button
        type="button"
        title={label}
        aria-label={label}
        disabled={busy}
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        className={`inline-flex h-8 w-8 items-center justify-center rounded-lg disabled:opacity-40 ${className}`}
      >
        {children}
      </button>
    );
  }

  /** سه دکمه آیکونی پایین کارت / ردیف */
  function renderCardIcons(photo: AdminPhoto, index: number) {
    const eye = iconBtn(
      "مشاهده",
      () => setPreviewIndex(index),
      "bg-white/15 text-white hover:bg-white/25",
      <EyeIcon className="h-4 w-4" />,
    );

    if (tab === "pending") {
      return (
        <>
          {iconBtn(
            "تأیید",
            () => runAction(photo.public_id, "approve"),
            "bg-emerald-500 text-black hover:bg-emerald-400",
            <CheckIcon className="h-4 w-4" />,
          )}
          {iconBtn(
            "رد",
            () => runAction(photo.public_id, "reject"),
            "bg-red-500 text-white hover:bg-red-400",
            <XMarkIcon className="h-4 w-4" />,
          )}
          {eye}
        </>
      );
    }

    if (tab === "approved") {
      return (
        <>
          {iconBtn(
            "توقف انتشار",
            () => runAction(photo.public_id, "hide"),
            "bg-amber-500 text-black hover:bg-amber-400",
            <EyeSlashIcon className="h-4 w-4" />,
          )}
          {iconBtn(
            "حذف",
            () => runAction(photo.public_id, "delete"),
            "bg-red-500 text-white hover:bg-red-400",
            <TrashIcon className="h-4 w-4" />,
          )}
          {eye}
        </>
      );
    }

    return (
      <>
        {iconBtn(
          "انتشار مجدد",
          () => runAction(photo.public_id, "unhide"),
          "bg-emerald-500 text-black hover:bg-emerald-400",
          <CheckIcon className="h-4 w-4" />,
        )}
        {iconBtn(
          "حذف",
          () => runAction(photo.public_id, "delete"),
          "bg-red-500 text-white hover:bg-red-400",
          <TrashIcon className="h-4 w-4" />,
        )}
        {eye}
      </>
    );
  }

  /** دکمه‌های متنی فقط داخل لایت‌باکس */
  function renderPreviewActions(photo: AdminPhoto) {
    const cls =
      "rounded px-2.5 py-1.5 text-xs font-medium disabled:opacity-50";
    return (
      <>
        {tab === "pending" && (
          <>
            <button
              disabled={busy}
              onClick={() => runAction(photo.public_id, "approve")}
              className={`${cls} bg-emerald-500/90 text-black`}
            >
              تأیید
            </button>
            <button
              disabled={busy}
              onClick={() => runAction(photo.public_id, "reject")}
              className={`${cls} bg-red-500/80`}
            >
              رد
            </button>
          </>
        )}
        {tab === "approved" && (
          <>
            <button
              disabled={busy}
              onClick={() => runAction(photo.public_id, "hide")}
              className={`${cls} bg-amber-500/90 text-black`}
            >
              توقف
            </button>
            <button
              disabled={busy}
              onClick={() => runAction(photo.public_id, "delete")}
              className={`${cls} bg-red-500/80`}
            >
              حذف
            </button>
          </>
        )}
        {tab === "hidden" && (
          <>
            <button
              disabled={busy}
              onClick={() => runAction(photo.public_id, "unhide")}
              className={`${cls} bg-emerald-500/90 text-black`}
            >
              انتشار
            </button>
            <button
              disabled={busy}
              onClick={() => runAction(photo.public_id, "delete")}
              className={`${cls} bg-red-500/80`}
            >
              حذف
            </button>
          </>
        )}
      </>
    );
  }

  return (
    <>
      <Head>
        <title>پنل مدیریت عکس‌ها</title>
      </Head>
      <main className="mx-auto min-h-screen max-w-6xl px-4 py-8 text-white">
        <motion.div
          className="mb-6 flex flex-wrap items-center justify-between gap-4"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={softSpring}
        >
          <div>
            <h1 className="text-2xl font-semibold">مدیریت عکس‌ها</h1>
            <p className="text-sm text-white/60">
              کلیک روی عکس = انتخاب · آیکون چشم = مشاهده
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => load(tab)}
              disabled={loading || refreshing}
              className="rounded-xl border border-white/30 px-3 py-2 text-sm hover:bg-white/10 disabled:opacity-50"
            >
              تازه‌سازی
            </button>
            <Link
              href="/"
              prefetch
              className="rounded-xl border border-white/30 px-3 py-2 text-sm hover:bg-white/10"
            >
              گالری
            </Link>
            <button
              onClick={logout}
              className="rounded-xl border border-white/30 px-3 py-2 text-sm hover:bg-white/10"
            >
              خروج
            </button>
          </div>
        </motion.div>

        <motion.div
          className="mb-4 flex flex-wrap gap-2 border-b border-white/10 pb-2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.05 }}
        >
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => {
                setSuccess("");
                setPreviewIndex(null);
                setQuery("");
                setTab(t.id);
              }}
              className={`relative rounded-xl px-3 py-2 text-sm ${
                tab === t.id ? "text-black" : "text-white/70 hover:bg-white/10"
              }`}
            >
              {tab === t.id && (
                <motion.span
                  layoutId="admin-tab"
                  className="absolute inset-0 rounded-xl bg-white"
                  transition={{ type: "spring", stiffness: 400, damping: 34 }}
                />
              )}
              <span className="relative z-10">{t.label}</span>
            </button>
          ))}
        </motion.div>

        {!loading && photos.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 space-y-3 rounded-2xl border border-white/10 bg-white/5 p-3"
          >
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="search"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPreviewIndex(null);
                }}
                placeholder="جستجو نام فایل…"
                className="min-w-[12rem] flex-1 rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm outline-none placeholder:text-white/35 focus:border-white/40"
              />
              <div className="relative flex items-center gap-2 text-sm" ref={sortRef}>
                <span className="whitespace-nowrap text-white/70">مرتب‌سازی</span>
                <button
                  type="button"
                  aria-haspopup="listbox"
                  aria-expanded={sortOpen}
                  onClick={() => setSortOpen((o) => !o)}
                  className="inline-flex min-w-[10.5rem] items-center justify-between gap-2 rounded-xl border border-white/15 bg-[#141414] px-3 py-2 text-white outline-none hover:border-white/30"
                >
                  <span>
                    {SORT_OPTIONS.find((o) => o.id === sortKey)?.label}
                  </span>
                  <ChevronDownIcon
                    className={`h-4 w-4 text-white/50 transition ${
                      sortOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>
                {sortOpen && (
                  <ul
                    role="listbox"
                    className="absolute top-[calc(100%+6px)] right-0 z-40 min-w-[12rem] overflow-hidden rounded-xl border border-white/15 bg-[#1a1a1a] py-1 shadow-2xl shadow-black/60"
                  >
                    {SORT_OPTIONS.map((opt) => {
                      const active = opt.id === sortKey;
                      return (
                        <li key={opt.id} role="option" aria-selected={active}>
                          <button
                            type="button"
                            onClick={() => {
                              setSortKey(opt.id);
                              setSortOpen(false);
                            }}
                            className={`flex w-full items-center justify-between gap-3 px-3 py-2.5 text-right text-sm transition ${
                              active
                                ? "bg-white/15 text-white"
                                : "text-white/75 hover:bg-white/10 hover:text-white"
                            }`}
                          >
                            {opt.label}
                            {active && (
                              <CheckIcon className="h-4 w-4 shrink-0 text-emerald-400" />
                            )}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
              <div className="flex overflow-hidden rounded-xl border border-white/15">
                <button
                  type="button"
                  title="شبکه‌ای"
                  aria-label="نمای شبکه‌ای"
                  onClick={() => setViewMode("grid")}
                  className={`inline-flex h-9 w-9 items-center justify-center ${
                    viewMode === "grid"
                      ? "bg-white text-black"
                      : "bg-black/30 text-white/70 hover:bg-white/10"
                  }`}
                >
                  <Squares2X2Icon className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  title="لیستی"
                  aria-label="نمای لیستی"
                  onClick={() => setViewMode("list")}
                  className={`inline-flex h-9 w-9 items-center justify-center ${
                    viewMode === "list"
                      ? "bg-white text-black"
                      : "bg-black/30 text-white/70 hover:bg-white/10"
                  }`}
                >
                  <ListBulletIcon className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  disabled={busy}
                  className="h-4 w-4 accent-white"
                />
                انتخاب همه ({toFaDigits(visiblePhotos.length)})
              </label>
              <span className="text-xs text-white/50">
                {toFaDigits(selected.size)} انتخاب‌شده · مجموع حجم{" "}
                {formatFileSize(totalBytes)}
              </span>
              <div className="mr-auto flex flex-wrap gap-2">
                {tab === "pending" && (
                  <>
                    <button
                      disabled={busy || selected.size === 0}
                      onClick={() => runBulk("approve")}
                      className="rounded-lg bg-emerald-500/90 px-3 py-1.5 text-xs font-medium text-black disabled:opacity-50"
                    >
                      تأیید انتخاب‌شده‌ها
                    </button>
                    <button
                      disabled={busy || visiblePhotos.length === 0}
                      onClick={() =>
                        runBulk(
                          "approve",
                          visiblePhotos.map((p) => p.public_id),
                        )
                      }
                      className="rounded-lg border border-emerald-400/50 px-3 py-1.5 text-xs font-medium text-emerald-200 disabled:opacity-50"
                    >
                      تأیید همه
                    </button>
                    <button
                      disabled={busy || selected.size === 0}
                      onClick={() => runBulk("reject")}
                      className="rounded-lg bg-red-500/80 px-3 py-1.5 text-xs font-medium disabled:opacity-50"
                    >
                      رد انتخاب‌شده‌ها
                    </button>
                  </>
                )}
                {tab === "approved" && (
                  <>
                    <button
                      disabled={busy || selected.size === 0}
                      onClick={() => runBulk("hide")}
                      className="rounded-lg bg-amber-500/90 px-3 py-1.5 text-xs font-medium text-black disabled:opacity-50"
                    >
                      توقف انتخاب‌شده‌ها
                    </button>
                    <button
                      disabled={busy || selected.size === 0}
                      onClick={() => runBulk("delete")}
                      className="rounded-lg bg-red-500/80 px-3 py-1.5 text-xs font-medium disabled:opacity-50"
                    >
                      حذف انتخاب‌شده‌ها
                    </button>
                  </>
                )}
                {tab === "hidden" && (
                  <>
                    <button
                      disabled={busy || selected.size === 0}
                      onClick={() => runBulk("unhide")}
                      className="rounded-lg bg-emerald-500/90 px-3 py-1.5 text-xs font-medium text-black disabled:opacity-50"
                    >
                      انتشار انتخاب‌شده‌ها
                    </button>
                    <button
                      disabled={busy || selected.size === 0}
                      onClick={() => runBulk("delete")}
                      className="rounded-lg bg-red-500/80 px-3 py-1.5 text-xs font-medium disabled:opacity-50"
                    >
                      حذف انتخاب‌شده‌ها
                    </button>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {refreshing && (
          <p className="mb-3 text-xs text-white/40">در حال به‌روزرسانی…</p>
        )}

        <AnimatePresence mode="wait">
          {error && (
            <motion.p
              key="err"
              role="alert"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mb-4 rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-200"
            >
              {toFaDigits(error)}
            </motion.p>
          )}
        </AnimatePresence>
        <AnimatePresence mode="wait">
          {success && (
            <motion.p
              key="ok"
              role="status"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="mb-4 rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200"
            >
              {toFaDigits(success)}
            </motion.p>
          )}
        </AnimatePresence>

        {bulkBusy && (
          <p className="mb-4 text-sm text-white/70">در حال انجام عملیات گروهی…</p>
        )}

        {loading ? (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
            {Array.from({ length: 12 }).map((_, i) => (
              <div
                key={i}
                className="aspect-[3/2] animate-pulse rounded-lg bg-white/10"
              />
            ))}
          </div>
        ) : photos.length === 0 ? (
          <p className="text-white/60">در این بخش عکسی نیست.</p>
        ) : visiblePhotos.length === 0 ? (
          <p className="text-white/60">نتیجه‌ای برای جستجو پیدا نشد.</p>
        ) : viewMode === "list" ? (
          <div
            key={`${tab}-list`}
            className="overflow-hidden rounded-xl border border-white/10"
          >
            <div className="hidden grid-cols-[3.5rem_minmax(0,1fr)_7rem_9rem_auto] gap-3 border-b border-white/10 bg-white/5 px-3 py-2 text-xs text-white/45 sm:grid">
              <span />
              <span>نام</span>
              <span>حجم</span>
              <span>تاریخ</span>
              <span>عملیات</span>
            </div>
            {visiblePhotos.map((photo, index) => {
              const isSelected = selected.has(photo.public_id);
              const dateLabel = formatJalaliDate(photoDate(photo));
              return (
                <div
                  key={photo.public_id}
                  role="button"
                  tabIndex={0}
                  onClick={() => !busy && toggleOne(photo.public_id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      if (!busy) toggleOne(photo.public_id);
                    }
                  }}
                  className={`relative grid cursor-pointer grid-cols-[3.5rem_minmax(0,1fr)] items-center gap-3 border-b border-white/5 px-3 py-2 sm:grid-cols-[3.5rem_minmax(0,1fr)_7rem_9rem_auto] ${
                    isSelected ? "bg-emerald-500/10" : "hover:bg-white/[0.04]"
                  }`}
                >
                  <div className="relative h-12 w-14 shrink-0 overflow-hidden rounded-md border border-white/10">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photo.url}
                      alt=""
                      className="h-full w-full object-cover"
                      loading="lazy"
                      decoding="async"
                    />
                    {isSelected && (
                      <span className="absolute inset-0 flex items-center justify-center bg-emerald-500/35">
                        <CheckIcon className="h-5 w-5 text-white" />
                      </span>
                    )}
                  </div>

                  <div className="min-w-0 text-right">
                    <p className="truncate text-sm font-medium text-white">
                      {photo.filename}
                    </p>
                    <p className="truncate text-[11px] text-white/40 sm:hidden">
                      {formatFileSize(photo.bytes)}
                      {dateLabel ? ` · ${dateLabel}` : ""}
                    </p>
                  </div>

                  <p className="hidden text-sm text-white/70 sm:block">
                    {formatFileSize(photo.bytes)}
                  </p>
                  <p className="hidden text-sm text-white/70 sm:block">
                    {dateLabel || "—"}
                  </p>

                  <div
                    className="col-span-full flex flex-wrap gap-1.5 sm:col-span-1 sm:justify-end"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {renderCardIcons(photo, index)}
                  </div>

                  {(busyId === photo.public_id ||
                    (bulkBusy && isSelected)) && (
                    <div className="pointer-events-none absolute inset-0 bg-black/40" />
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div
            key={`${tab}-grid`}
            className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7"
          >
            {visiblePhotos.map((photo, index) => {
              const isSelected = selected.has(photo.public_id);
              return (
                <div
                  key={photo.public_id}
                  className={`group relative overflow-hidden rounded-xl border bg-white/5 ${
                    isSelected
                      ? "border-emerald-400 ring-1 ring-emerald-400/50"
                      : "border-white/10"
                  }`}
                >
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => toggleOne(photo.public_id)}
                    className="relative block aspect-[3/2] w-full cursor-pointer"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photo.url}
                      alt="پیش‌نمایش عکس"
                      className="absolute inset-0 h-full w-full object-cover"
                      loading="lazy"
                      decoding="async"
                    />
                    {isSelected && (
                      <span className="absolute top-1.5 right-1.5 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-black shadow">
                        <CheckIcon className="h-4 w-4" />
                      </span>
                    )}
                    {(busyId === photo.public_id ||
                      (bulkBusy && isSelected)) && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/55 text-[10px]">
                        …
                      </div>
                    )}
                  </button>

                  <div className="space-y-1.5 p-1.5">
                    <p className="truncate text-[10px] text-white/55">
                      {photo.filename}
                    </p>
                    <p className="text-[10px] text-white/40">
                      {formatFileSize(photo.bytes)}
                    </p>
                    <div className="flex items-center justify-center gap-1.5">
                      {renderCardIcons(photo, index)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Lightbox — کنترل‌ها ثابت؛ فقط پوسته یک‌بار انیمیت می‌شود */}
      <AnimatePresence>
        {previewPhoto && previewIndex !== null && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
          >
            <button
              type="button"
              aria-label="بستن"
              className="absolute inset-0 bg-black/85"
              onClick={() => setPreviewIndex(null)}
            />

            <motion.div
              className="relative z-10 w-full max-w-5xl"
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.2 }}
            >
              <div className="relative aspect-[3/2] overflow-hidden rounded-2xl border border-white/15 bg-black shadow-2xl">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={fullUrl(previewPhoto)}
                  alt="نمایش بزرگ"
                  className="absolute inset-0 h-full w-full object-cover"
                  decoding="async"
                  fetchPriority="high"
                />

                {previewIndex > 0 && (
                  <button
                    type="button"
                    onClick={() => setPreviewIndex(previewIndex - 1)}
                    className="absolute top-1/2 right-3 z-30 -translate-y-1/2 rounded-full bg-black/60 p-3 text-white hover:bg-black/80"
                  >
                    ›
                  </button>
                )}
                {previewIndex < visiblePhotos.length - 1 && (
                  <button
                    type="button"
                    onClick={() => setPreviewIndex(previewIndex + 1)}
                    className="absolute top-1/2 left-3 z-30 -translate-y-1/2 rounded-full bg-black/60 p-3 text-white hover:bg-black/80"
                  >
                    ‹
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setPreviewIndex(null)}
                  className="absolute top-3 left-3 z-30 rounded-full bg-black/60 px-3 py-1.5 text-sm text-white hover:bg-black/80"
                >
                  بستن
                </button>

                <div className="absolute bottom-0 inset-x-0 z-30 bg-gradient-to-t from-black/85 to-transparent p-4">
                  <p className="mb-1 truncate text-sm font-medium text-white">
                    {previewPhoto.filename}
                  </p>
                  <p className="mb-1 text-xs text-white/70">
                    تاریخ انتشار:{" "}
                    {formatJalaliDate(photoDate(previewPhoto)) || "—"}
                    {" · "}
                    حجم: {formatFileSize(previewPhoto.bytes)}
                    {" · "}
                    {toFaDigits(previewPhoto.width)}×
                    {toFaDigits(previewPhoto.height)}
                  </p>
                  <p className="mb-3 truncate text-[11px] text-white/40" dir="ltr">
                    {previewPhoto.public_id}
                  </p>
                  <p className="mb-3 text-xs text-white/60">
                    {toFaDigits(previewIndex + 1)} از{" "}
                    {toFaDigits(visiblePhotos.length)}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {renderPreviewActions(previewPhoto)}
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default AdminPanel;

export const getServerSideProps: GetServerSideProps = async ({ req }) => {
  if (!isAuthenticated(req)) {
    return {
      redirect: { destination: "/admin/login", permanent: false },
    };
  }
  return { props: {} };
};
