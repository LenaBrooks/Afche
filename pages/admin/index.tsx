import type { GetServerSideProps, NextPage } from "next";
import Head from "next/head";
import Link from "next/link";
import {
  ArrowPathIcon,
  ArrowRightOnRectangleIcon,
  ArrowUpTrayIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  Cog6ToothIcon,
  MagnifyingGlassIcon,
  PhotoIcon,
  Squares2X2Icon,
} from "@heroicons/react/24/solid";
import { ListBulletIcon } from "@heroicons/react/24/outline";
import { AnimatePresence, motion } from "framer-motion";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import ActionSheet, {
  type ActionSheetItem,
} from "../../components/ui/ActionSheet";
import Button from "../../components/ui/Button";
import ConfirmDialog, {
  type ConfirmState,
} from "../../components/ui/ConfirmDialog";
import Dropzone from "../../components/ui/Dropzone";
import EmptyState from "../../components/ui/EmptyState";
import SegmentedControl from "../../components/ui/SegmentedControl";
import StatPill from "../../components/ui/StatPill";
import { useToast } from "../../components/ui/Toast";
import {
  getAdminCache,
  invalidateAdminCache,
  setAdminCache,
  type AdminPhoto,
} from "../../utils/adminCache";
import { isAuthenticated } from "../../utils/auth";
import { lightboxUrl } from "../../utils/cloudinaryUrl";
import {
  formatFileSize,
  formatJalaliDate,
  toFaDigits,
} from "../../utils/fa";
import { notifyGalleryUpdated } from "../../utils/gallerySync";

type Tab = "pending" | "approved" | "hidden";
type ViewMode = "grid" | "list";
type SortKey = "date-desc" | "date-asc" | "random";

const TABS: { id: Tab; label: string }[] = [
  { id: "pending", label: "در انتظار" },
  { id: "approved", label: "منتشرشده" },
  { id: "hidden", label: "متوقف‌شده" },
];

const SORT_OPTIONS: { id: SortKey; label: string }[] = [
  { id: "date-desc", label: "جدیدترین" },
  { id: "date-asc", label: "قدیمی‌ترین" },
  { id: "random", label: "تصادفی" },
];

const ACTION_LABELS: Record<string, string> = {
  approve: "تأیید و انتشار",
  reject: "رد و حذف",
  hide: "توقف انتشار",
  unhide: "انتشار مجدد",
  delete: "حذف",
};

const PAGE_SIZE = 24;
const ADMIN_UPLOAD_MAX = 30;
const ADMIN_UPLOAD_BYTES = 10 * 1024 * 1024;
const ADMIN_UPLOAD_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/jpg",
]);

const EMPTY_COPY: Record<Tab, { title: string; description: string }> = {
  pending: {
    title: "عکسی در صف نیست",
    description: "وقتی کاربر عکس بفرستد، اینجا برای تأیید ظاهر می‌شود.",
  },
  approved: {
    title: "هنوز عکسی منتشر نشده",
    description: "عکس‌های تأییدشده اینجا و در گالری عمومی دیده می‌شوند.",
  },
  hidden: {
    title: "عکس متوقف‌شده‌ای نیست",
    description: "عکس‌هایی که موقتاً از گالری برداشته‌اید اینجا می‌مانند.",
  },
};

function fullUrl(photo: AdminPhoto) {
  return lightboxUrl(photo.public_id, photo.format);
}

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

function shuffleSeeded<T>(items: T[], seed: number): T[] {
  const next = [...items];
  let s = seed || 1;
  for (let i = next.length - 1; i > 0; i--) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    const j = s % (i + 1);
    const tmp = next[i];
    next[i] = next[j];
    next[j] = tmp;
  }
  return next;
}

function sortPhotos(list: AdminPhoto[], sort: SortKey, randomSeed = 1) {
  if (sort === "random") return shuffleSeeded(list, randomSeed);
  const next = [...list];
  next.sort((a, b) => {
    const diff =
      new Date(photoDate(a) || 0).getTime() -
      new Date(photoDate(b) || 0).getTime();
    if (sort === "date-asc") return diff;
    return -diff;
  });
  return next;
}

const AdminPanel: NextPage = () => {
  const toast = useToast();
  const [tab, setTab] = useState<Tab>("pending");
  const [photos, setPhotos] = useState<AdminPhoto[]>(
    () => getAdminCache("pending") || [],
  );
  const [counts, setCounts] = useState<Record<Tab, number>>(() => ({
    pending: getAdminCache("pending")?.length ?? 0,
    approved: getAdminCache("approved")?.length ?? 0,
    hidden: getAdminCache("hidden")?.length ?? 0,
  }));
  const [loading, setLoading] = useState(() => !getAdminCache("pending"));
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState("");
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [sheetIndex, setSheetIndex] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [sortKey, setSortKey] = useState<SortKey>("date-desc");
  const [randomSeed, setRandomSeed] = useState(() => Date.now());
  const [sortOpen, setSortOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [confirm, setConfirm] = useState<ConfirmState>(null);
  const [uploading, setUploading] = useState(false);
  const sortRef = useRef<HTMLDivElement>(null);
  const listTopRef = useRef<HTMLDivElement>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);

  const syncCount = useCallback((status: Tab, list: AdminPhoto[]) => {
    setCounts((prev) => ({ ...prev, [status]: list.length }));
  }, []);

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

  const load = useCallback(
    async (status: Tab, opts?: { silent?: boolean }) => {
      const cached = getAdminCache(status);
      const silent = opts?.silent || Boolean(cached);

      if (cached) {
        setPhotos(cached);
        syncCount(status, cached);
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
        syncCount(status, list);
        if (status === tab) {
          setPhotos(list);
          setSelected(new Set());
        }
      } catch (e: any) {
        if (!cached && status === tab) {
          setError(e.message || "بارگذاری ناموفق بود");
          setPhotos([]);
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [syncCount, tab],
  );

  useEffect(() => {
    const cached = getAdminCache(tab);
    if (cached) {
      setPhotos(cached);
      syncCount(tab, cached);
      setLoading(false);
      setSelected(new Set());
      load(tab, { silent: true });
    } else {
      load(tab);
    }
  }, [tab, load, syncCount]);

  useEffect(() => {
    const others = TABS.map((t) => t.id).filter((id) => id !== tab);
    let cancelled = false;
    const run = () => {
      others.forEach((status) => {
        if (cancelled) return;
        const cached = getAdminCache(status);
        if (cached) {
          syncCount(status, cached);
          return;
        }
        fetch(`/api/admin/photos?status=${status}`)
          .then((res) => (res.ok ? res.json() : null))
          .then((data) => {
            if (!cancelled && data?.photos) {
              setAdminCache(status, data.photos);
              syncCount(status, data.photos);
            }
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
  }, [tab, syncCount]);

  const visiblePhotos = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? photos.filter(
          (p) =>
            p.filename.toLowerCase().includes(q) ||
            p.public_id.toLowerCase().includes(q),
        )
      : photos;
    return sortPhotos(filtered, sortKey, randomSeed);
  }, [photos, query, sortKey, randomSeed]);

  const pageCount = Math.max(1, Math.ceil(visiblePhotos.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);

  const pagePhotos = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return visiblePhotos.slice(start, start + PAGE_SIZE);
  }, [visiblePhotos, safePage]);

  useEffect(() => {
    setPage(1);
  }, [tab, query, sortKey]);

  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  function goToPage(next: number) {
    const clamped = Math.min(Math.max(1, next), pageCount);
    setPage(clamped);
    setPreviewIndex(null);
    setSheetIndex(null);
    listTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const storageStats = useMemo(() => {
    let total = 0;
    let bytes = 0;
    for (const t of TABS) {
      const list = t.id === tab ? photos : getAdminCache(t.id) || [];
      total += list.length;
      for (const photo of list) bytes += photo.bytes || 0;
    }
    return { total, bytes };
  }, [tab, photos, counts]);

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
      setPreviewIndex(
        visiblePhotos.length > 0 ? visiblePhotos.length - 1 : null,
      );
    }
  }, [visiblePhotos.length, previewIndex]);

  useEffect(() => {
    if (sheetIndex !== null && sheetIndex >= visiblePhotos.length) {
      setSheetIndex(null);
    }
  }, [visiblePhotos.length, sheetIndex]);

  useEffect(() => {
    if (previewIndex === null) return;
    [visiblePhotos[previewIndex - 1], visiblePhotos[previewIndex + 1]]
      .filter(Boolean)
      .forEach((photo) => {
        const img = new window.Image();
        img.src = fullUrl(photo);
      });
  }, [previewIndex, visiblePhotos]);

  const allSelected = useMemo(
    () =>
      pagePhotos.length > 0 &&
      pagePhotos.every((p) => selected.has(p.public_id)),
    [pagePhotos, selected],
  );

  const previewPhoto =
    previewIndex !== null ? visiblePhotos[previewIndex] : undefined;
  const sheetPhoto =
    sheetIndex !== null ? visiblePhotos[sheetIndex] : undefined;

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
      setSelected((prev) => {
        const next = new Set(prev);
        for (const p of pagePhotos) next.delete(p.public_id);
        return next;
      });
      return;
    }
    setSelected((prev) => {
      const next = new Set(prev);
      for (const p of pagePhotos) next.add(p.public_id);
      return next;
    });
  }

  function applyOptimisticRemoval(ids: string[], action: string) {
    const remove = new Set(ids);
    setPhotos((prev) => {
      const next = prev.filter((p) => !remove.has(p.public_id));
      setAdminCache(tab, next);
      syncCount(tab, next);
      return next;
    });
    setSelected((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.delete(id));
      return next;
    });
    setPreviewIndex(null);
    setSheetIndex(null);
    for (const t of relatedTabs(tab, action)) {
      if (t !== tab) invalidateAdminCache(t);
    }
  }

  function askDestructive(action: string, count: number, run: () => void) {
    if (action !== "delete" && action !== "reject") {
      run();
      return;
    }
    const label = action === "reject" ? "رد و حذف دائمی" : "حذف دائمی";
    setConfirm({
      title: label,
      message: `${label} ${toFaDigits(count)} عکس؟ این کار قابل بازگشت نیست.`,
      confirmLabel: action === "reject" ? "رد و حذف" : "حذف",
      danger: true,
      onConfirm: run,
    });
  }

  async function runAction(publicId: string, action: string) {
    askDestructive(action, 1, async () => {
      setBusyId(publicId);
      setError("");
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
        toast.success(
          `${ACTION_LABELS[action] || "انجام شد"} — ${toFaDigits(1)} عکس`,
        );
        applyOptimisticRemoval([publicId], action);
        void notifyGalleryUpdated();
      } catch (e: any) {
        const msg = e.message || "عملیات ناموفق بود";
        setError(msg);
        toast.error(msg);
      } finally {
        setBusyId(null);
      }
    });
  }

  async function runBulk(action: string, ids?: string[]) {
    const publicIds = ids || Array.from(selected);
    if (publicIds.length === 0) {
      toast.error("هیچ عکسی انتخاب نشده است");
      return;
    }

    const execute = async () => {
      setBulkBusy(true);
      setError("");
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
        toast.success(
          data.failed
            ? `${label}: ${toFaDigits(data.processed)} موفق، ${toFaDigits(data.failed)} ناموفق`
            : `${label}: ${toFaDigits(data.processed)} عکس`,
        );
        applyOptimisticRemoval(publicIds, action);
        void notifyGalleryUpdated();
        if (data.failed) {
          invalidateAdminCache(tab);
          await load(tab, { silent: true });
        }
      } catch (e: any) {
        const msg = e.message || "عملیات گروهی ناموفق بود";
        setError(msg);
        toast.error(msg);
      } finally {
        setBulkBusy(false);
      }
    };

    if (action === "approve" && ids && ids.length === visiblePhotos.length) {
      setConfirm({
        title: "تأیید همه",
        message: `همهٔ ${toFaDigits(publicIds.length)} عکس این بخش تأیید و منتشر شود؟`,
        confirmLabel: "تأیید همه",
        onConfirm: () => {
          void execute();
        },
      });
      return;
    }

    askDestructive(action, publicIds.length, () => {
      void execute();
    });
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/admin/login";
  }

  async function uploadAdminFiles(fileList: FileList | File[]) {
    const picked = Array.from(fileList);
    const files = picked.filter((f) => {
      if (!ADMIN_UPLOAD_TYPES.has(f.type)) return false;
      if (f.size > ADMIN_UPLOAD_BYTES) return false;
      return true;
    });

    if (files.length === 0) {
      toast.error("فایل معتبری انتخاب نشد (JPEG/PNG/WebP/GIF تا ۱۰ مگ)");
      return;
    }
    if (files.length > ADMIN_UPLOAD_MAX) {
      toast.error(`حداکثر ${toFaDigits(ADMIN_UPLOAD_MAX)} فایل در هر بار`);
      return;
    }
    if (files.length < picked.length) {
      toast.push(
        `${toFaDigits(picked.length - files.length)} فایل رد شد — بقیه آپلود می‌شوند`,
        "info",
      );
    }

    setUploading(true);
    try {
      const body = new FormData();
      for (const file of files) body.append("file", file);
      const res = await fetch("/api/admin/upload", {
        method: "POST",
        body,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "آپلود ناموفق بود");

      const uploaded = (data.photos || []) as AdminPhoto[];
      const prevApproved =
        getAdminCache("approved") ||
        (tab === "approved" ? photos : []);
      const nextApproved = [
        ...uploaded,
        ...prevApproved.filter(
          (p) => !uploaded.some((u) => u.public_id === p.public_id),
        ),
      ];
      setAdminCache("approved", nextApproved);
      syncCount("approved", nextApproved);

      if (tab !== "approved") {
        setTab("approved");
      } else {
        setPhotos(nextApproved);
        setSelected(new Set());
        setPage(1);
      }

      toast.success(
        data.failed
          ? `${toFaDigits(data.processed)} آپلود شد، ${toFaDigits(data.failed)} ناموفق`
          : `${toFaDigits(data.processed)} عکس آپلود و منتشر شد`,
      );
      void notifyGalleryUpdated();
      void load("approved", { silent: true });
    } catch (e: any) {
      toast.error(e?.message || "آپلود ناموفق بود");
    } finally {
      setUploading(false);
      if (uploadInputRef.current) uploadInputRef.current.value = "";
    }
  }

  const busy = bulkBusy || busyId !== null;

  function sheetActions(photo: AdminPhoto, index: number): ActionSheetItem[] {
    const items: ActionSheetItem[] = [
      {
        id: "view",
        label: "مشاهده",
        onClick: () => setPreviewIndex(index),
      },
    ];

    if (tab === "pending") {
      items.push(
        {
          id: "approve",
          label: "تأیید و انتشار",
          tone: "ok",
          onClick: () => runAction(photo.public_id, "approve"),
        },
        {
          id: "reject",
          label: "رد و حذف",
          tone: "danger",
          onClick: () => runAction(photo.public_id, "reject"),
        },
      );
    } else if (tab === "approved") {
      items.push(
        {
          id: "hide",
          label: "توقف انتشار",
          tone: "warn",
          onClick: () => runAction(photo.public_id, "hide"),
        },
        {
          id: "delete",
          label: "حذف",
          tone: "danger",
          onClick: () => runAction(photo.public_id, "delete"),
        },
      );
    } else {
      items.push(
        {
          id: "unhide",
          label: "انتشار مجدد",
          tone: "ok",
          onClick: () => runAction(photo.public_id, "unhide"),
        },
        {
          id: "delete",
          label: "حذف",
          tone: "danger",
          onClick: () => runAction(photo.public_id, "delete"),
        },
      );
    }

    return items;
  }

  function renderPreviewActions(photo: AdminPhoto) {
    if (tab === "pending") {
      return (
        <>
          <Button
            size="sm"
            disabled={busy}
            className="!bg-emerald-500/90 !text-black"
            onClick={() => runAction(photo.public_id, "approve")}
          >
            تأیید
          </Button>
          <Button
            size="sm"
            variant="danger"
            disabled={busy}
            onClick={() => runAction(photo.public_id, "reject")}
          >
            رد
          </Button>
        </>
      );
    }
    if (tab === "approved") {
      return (
        <>
          <Button
            size="sm"
            variant="warn"
            disabled={busy}
            onClick={() => runAction(photo.public_id, "hide")}
          >
            توقف
          </Button>
          <Button
            size="sm"
            variant="danger"
            disabled={busy}
            onClick={() => runAction(photo.public_id, "delete")}
          >
            حذف
          </Button>
        </>
      );
    }
    return (
      <>
        <Button
          size="sm"
          disabled={busy}
          className="!bg-emerald-500/90 !text-black"
          onClick={() => runAction(photo.public_id, "unhide")}
        >
          انتشار
        </Button>
        <Button
          size="sm"
          variant="danger"
          disabled={busy}
          onClick={() => runAction(photo.public_id, "delete")}
        >
          حذف
        </Button>
      </>
    );
  }

  return (
    <>
      <Head>
        <title>پنل مدیریت عکس‌ها</title>
      </Head>
      <main className="af-admin mx-auto min-h-screen max-w-6xl px-3 pb-[calc(6.5rem+env(safe-area-inset-bottom))] pt-4 text-[var(--af-text)] sm:px-4 sm:py-8 sm:pb-28">
        <header className="mb-4 flex flex-wrap items-start justify-between gap-3 sm:mb-6">
          <div className="min-w-0 flex-1">
            <p className="af-brand mb-1 text-[10px] font-semibold text-[var(--af-accent)] sm:text-xs">
              AFCHE
            </p>
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <h1 className="text-xl font-bold sm:text-2xl">مدیریت</h1>
              {counts.pending > 0 && (
                <StatPill label="در انتظار" value={counts.pending} />
              )}
            </div>
            <p className="fa-num mt-1.5 text-xs text-[var(--af-muted)] sm:text-sm">
              <span className="text-[var(--af-text)]/80">
                {toFaDigits(storageStats.total)} عکس
              </span>
              <span className="mx-1.5 opacity-40">·</span>
              <span className="text-[var(--af-text)]/80">
                {formatFileSize(storageStats.bytes)}
              </span>
              <span className="mx-1.5 hidden opacity-40 sm:inline">·</span>
              <span className="hidden sm:inline">
                تپ روی کارت = منوی عمل · چک‌باکس = انتخاب گروهی
              </span>
            </p>
          </div>
          <div className="flex shrink-0 gap-1.5">
            <input
              ref={uploadInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.length) {
                  void uploadAdminFiles(e.target.files);
                }
              }}
            />
            <Button
              type="button"
              size="sm"
              loading={uploading}
              disabled={busy}
              onClick={() => uploadInputRef.current?.click()}
              className="hidden sm:inline-flex"
            >
              <ArrowUpTrayIcon className="h-4 w-4" />
              آپلود
            </Button>
            <button
              type="button"
              title="آپلود عکس"
              aria-label="آپلود عکس"
              disabled={uploading || busy}
              onClick={() => uploadInputRef.current?.click()}
              className="af-focusable inline-flex h-10 w-10 items-center justify-center rounded-[var(--af-radius-md)] border border-[var(--af-border)] text-[var(--af-muted)] hover:bg-[var(--af-chip)] hover:text-[var(--af-text)] disabled:opacity-40 sm:hidden"
            >
              <ArrowUpTrayIcon
                className={`h-4 w-4 ${uploading ? "animate-pulse" : ""}`}
              />
            </button>
            <button
              type="button"
              title="تازه‌سازی"
              aria-label="تازه‌سازی"
              disabled={loading || refreshing || uploading}
              onClick={() => load(tab)}
              className="af-focusable inline-flex h-10 w-10 items-center justify-center rounded-[var(--af-radius-md)] border border-[var(--af-border)] text-[var(--af-muted)] hover:bg-[var(--af-chip)] hover:text-[var(--af-text)] disabled:opacity-40"
            >
              <ArrowPathIcon
                className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
              />
            </button>
            <Link
              href="/admin/settings"
              prefetch
              title="تنظیمات"
              aria-label="تنظیمات"
              className="af-focusable inline-flex h-10 w-10 items-center justify-center rounded-[var(--af-radius-md)] border border-[var(--af-border)] text-[var(--af-muted)] hover:bg-[var(--af-chip)] hover:text-[var(--af-text)]"
            >
              <Cog6ToothIcon className="h-4 w-4" />
            </Link>
            <Link
              href="/"
              prefetch
              title="گالری"
              aria-label="گالری"
              className="af-focusable inline-flex h-10 w-10 items-center justify-center rounded-[var(--af-radius-md)] border border-[var(--af-border)] text-[var(--af-muted)] hover:bg-[var(--af-chip)] hover:text-[var(--af-text)]"
            >
              <PhotoIcon className="h-4 w-4" />
            </Link>
            <button
              type="button"
              title="خروج"
              aria-label="خروج"
              onClick={logout}
              className="af-focusable inline-flex h-10 w-10 items-center justify-center rounded-[var(--af-radius-md)] border border-[var(--af-border)] text-[var(--af-muted)] hover:bg-[var(--af-chip)] hover:text-[var(--af-text)]"
            >
              <ArrowRightOnRectangleIcon className="h-4 w-4" />
            </button>
          </div>
        </header>

        <div className="mb-3 sm:mb-4">
          <SegmentedControl
            items={TABS.map((t) => ({
              id: t.id,
              label: t.label,
              count: counts[t.id],
            }))}
            value={tab}
            onChange={(id) => {
              setPreviewIndex(null);
              setSheetIndex(null);
              setQuery("");
              setTab(id);
            }}
          />
        </div>

        <div className="mb-3 sm:mb-4">
          <Dropzone
            compact
            disabled={uploading || busy}
            onFiles={(files) => void uploadAdminFiles(files)}
            title={
              uploading
                ? "در حال آپلود…"
                : "آپلود گروهی — انتخاب یا رها کردن چند عکس"
            }
            hint={`چند فایل با هم · JPEG/PNG/WebP/GIF · تا ${toFaDigits(ADMIN_UPLOAD_MAX)} فایل · مستقیم منتشر می‌شود`}
          />
        </div>

        {!loading && photos.length > 0 && (
          <div className="mb-3 space-y-2.5 rounded-[var(--af-radius-lg)] border border-[var(--af-border)] bg-[var(--af-surface)] p-2.5 shadow-[var(--af-shadow-sm)] sm:mb-4 sm:space-y-3 sm:p-3">
            <div className="relative w-full">
              <MagnifyingGlassIcon className="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-[var(--af-muted)]" />
              <input
                type="search"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPreviewIndex(null);
                  setSheetIndex(null);
                }}
                placeholder="جستجو نام فایل…"
                className="af-focusable h-10 w-full rounded-[var(--af-radius-md)] border border-[var(--af-border)] bg-[var(--af-input-bg)] pr-9 pl-3 text-sm text-[var(--af-text)] outline-none placeholder:text-[var(--af-muted)] focus:border-[var(--af-accent)]/40"
              />
            </div>

            <div className="flex items-center gap-2">
              <div className="relative min-w-0 flex-1" ref={sortRef}>
                <button
                  type="button"
                  aria-haspopup="listbox"
                  aria-expanded={sortOpen}
                  onClick={() => setSortOpen((o) => !o)}
                  className="af-focusable flex h-10 w-full items-center justify-between gap-2 rounded-[var(--af-radius-md)] border border-[var(--af-border)] bg-[var(--af-input-bg)] px-3 text-sm text-[var(--af-text)]"
                >
                  <span className="truncate">
                    {SORT_OPTIONS.find((o) => o.id === sortKey)?.label}
                  </span>
                  <ChevronDownIcon
                    className={`h-4 w-4 shrink-0 text-[var(--af-muted)] transition ${
                      sortOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>
                {sortOpen && (
                  <ul
                    role="listbox"
                    className="absolute top-[calc(100%+6px)] right-0 z-40 min-w-full overflow-hidden rounded-[var(--af-radius-md)] border border-[var(--af-border)] bg-[var(--af-surface)] py-1 shadow-[var(--af-shadow)]"
                  >
                    {SORT_OPTIONS.map((opt) => {
                      const active = opt.id === sortKey;
                      return (
                        <li key={opt.id}>
                          <button
                            type="button"
                            onClick={() => {
                              setSortKey(opt.id);
                              if (opt.id === "random") {
                                setRandomSeed(Date.now());
                              }
                              setSortOpen(false);
                            }}
                            className={`flex w-full items-center justify-between gap-3 px-3 py-2.5 text-right text-sm ${
                              active
                                ? "bg-[var(--af-accent-soft)] text-[var(--af-text)]"
                                : "text-[var(--af-muted)] hover:bg-[var(--af-hover)] hover:text-[var(--af-text)]"
                            }`}
                          >
                            {opt.label}
                            {active && (
                              <CheckIcon className="h-4 w-4 text-emerald-400" />
                            )}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              <div className="flex h-10 shrink-0 overflow-hidden rounded-[var(--af-radius-md)] border border-[var(--af-border)] bg-[var(--af-ctl-bg)]">
                <button
                  type="button"
                  title="شبکه‌ای"
                  aria-label="نمای شبکه‌ای"
                  onClick={() => setViewMode("grid")}
                  className={`inline-flex h-full w-10 items-center justify-center transition ${
                    viewMode === "grid"
                      ? "bg-[var(--af-ctl-active-bg)] text-[var(--af-ctl-active-fg)]"
                      : "text-[var(--af-ctl-fg)] hover:bg-[var(--af-hover)]"
                  }`}
                >
                  <Squares2X2Icon className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  title="لیستی"
                  aria-label="نمای لیستی"
                  onClick={() => setViewMode("list")}
                  className={`inline-flex h-full w-10 items-center justify-center transition ${
                    viewMode === "list"
                      ? "bg-[var(--af-ctl-active-bg)] text-[var(--af-ctl-active-fg)]"
                      : "text-[var(--af-ctl-fg)] hover:bg-[var(--af-hover)]"
                  }`}
                >
                  <ListBulletIcon className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-sm">
              <label className="flex cursor-pointer items-center gap-2 rounded-[var(--af-radius-sm)] border border-[var(--af-border)] bg-[var(--af-input-bg)] px-2.5 py-1.5">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  disabled={busy}
                  className="h-4 w-4 accent-[var(--af-accent)]"
                />
                انتخاب صفحه (
                <span className="fa-num">{toFaDigits(pagePhotos.length)}</span>)
              </label>
              {selected.size > 0 && (
                <button
                  type="button"
                  onClick={() => setSelected(new Set())}
                  className="af-focusable text-xs text-[var(--af-muted)] hover:text-[var(--af-text)]"
                >
                  پاک کردن انتخاب (
                  <span className="fa-num">{toFaDigits(selected.size)}</span>)
                </button>
              )}
              {visiblePhotos.length > PAGE_SIZE && (
                <span className="fa-num text-xs text-[var(--af-muted)]">
                  {toFaDigits((safePage - 1) * PAGE_SIZE + 1)}–
                  {toFaDigits(
                    Math.min(safePage * PAGE_SIZE, visiblePhotos.length),
                  )}{" "}
                  از {toFaDigits(visiblePhotos.length)}
                </span>
              )}
              {tab === "pending" && (
                <Button
                  size="sm"
                  variant="soft"
                  disabled={busy || visiblePhotos.length === 0}
                  onClick={() =>
                    runBulk(
                      "approve",
                      visiblePhotos.map((p) => p.public_id),
                    )
                  }
                >
                  تأیید همه
                </Button>
              )}
            </div>
          </div>
        )}

        {error && (
          <p
            role="alert"
            className="mb-3 rounded-[var(--af-radius-md)] border border-[var(--af-danger)]/25 bg-[var(--af-danger-soft)] px-3 py-2 text-sm text-[var(--af-danger)]"
          >
            <span className="fa-num">{toFaDigits(error)}</span>
          </p>
        )}

        {loading ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="aspect-[3/2] animate-pulse rounded-[var(--af-radius-md)] bg-[var(--af-chip)]"
              />
            ))}
          </div>
        ) : photos.length === 0 ? (
          <EmptyState
            icon={<PhotoIcon className="h-6 w-6" />}
            title={EMPTY_COPY[tab].title}
            description={EMPTY_COPY[tab].description}
            action={
              <Button
                type="button"
                loading={uploading}
                onClick={() => uploadInputRef.current?.click()}
              >
                <ArrowUpTrayIcon className="h-4 w-4" />
                آپلود عکس
              </Button>
            }
          />
        ) : visiblePhotos.length === 0 ? (
          <EmptyState
            title="نتیجه‌ای پیدا نشد"
            description="عبارت جستجو را عوض کنید یا فیلتر را پاک کنید."
          />
        ) : viewMode === "list" ? (
          <div
            ref={listTopRef}
            className="overflow-hidden rounded-[var(--af-radius-lg)] border border-[var(--af-border)] bg-[var(--af-surface)]"
          >
            {pagePhotos.map((photo, localIndex) => {
              const index = (safePage - 1) * PAGE_SIZE + localIndex;
              const isSelected = selected.has(photo.public_id);
              const dateLabel = formatJalaliDate(photoDate(photo));
              return (
                <div
                  key={photo.public_id}
                  className={`flex h-14 items-center gap-2 border-b border-[var(--af-hairline)] px-2 sm:h-16 sm:gap-3 sm:px-3 ${
                    isSelected ? "bg-[var(--af-accent-soft)]" : ""
                  }`}
                >
                  <label
                    className="flex h-10 w-8 shrink-0 cursor-pointer items-center justify-center"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      disabled={busy}
                      onChange={() => toggleOne(photo.public_id)}
                      className="h-4 w-4 accent-[var(--af-accent)]"
                    />
                  </label>

                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setSheetIndex(index)}
                    className="flex min-w-0 flex-1 items-center gap-2.5 text-right"
                  >
                    <div className="relative h-10 w-12 shrink-0 overflow-hidden rounded-md border border-[var(--af-border)] sm:h-12 sm:w-14">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={photo.url}
                        alt=""
                        className="h-full w-full object-cover"
                        loading="lazy"
                        decoding="async"
                      />
                      {busyId === photo.public_id && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                          <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/70 border-t-transparent" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium leading-5">
                        {photo.filename}
                      </p>
                      <p className="fa-num truncate text-[11px] leading-4 text-[var(--af-muted)]">
                        {formatFileSize(photo.bytes)}
                        {dateLabel ? ` · ${dateLabel}` : ""}
                      </p>
                    </div>
                    <ChevronLeftIcon className="h-4 w-4 shrink-0 text-[var(--af-muted)]" />
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <div
            ref={listTopRef}
            className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
          >
            {pagePhotos.map((photo, localIndex) => {
              const index = (safePage - 1) * PAGE_SIZE + localIndex;
              const isSelected = selected.has(photo.public_id);
              return (
                <div
                  key={photo.public_id}
                  className={`overflow-hidden rounded-[var(--af-radius-md)] border bg-[var(--af-surface)] ${
                    isSelected
                      ? "border-[var(--af-accent)] ring-1 ring-[var(--af-accent)]/40"
                      : "border-[var(--af-border)]"
                  }`}
                >
                  <div className="relative">
                    <label
                      className="absolute top-1.5 right-1.5 z-20 flex h-7 w-7 cursor-pointer items-center justify-center rounded-md bg-black/55"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        disabled={busy}
                        onChange={() => toggleOne(photo.public_id)}
                        className="h-3.5 w-3.5 accent-[var(--af-accent)]"
                      />
                    </label>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setSheetIndex(index)}
                      className="relative block aspect-[3/2] w-full"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={photo.url}
                        alt=""
                        className="absolute inset-0 h-full w-full object-cover"
                        loading="lazy"
                        decoding="async"
                      />
                      {(busyId === photo.public_id ||
                        (bulkBusy && isSelected)) && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                          <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/70 border-t-transparent" />
                        </div>
                      )}
                    </button>
                  </div>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setSheetIndex(index)}
                    className="block w-full space-y-0.5 p-2 text-right"
                  >
                    <p className="truncate text-[11px] text-[var(--af-muted)]">
                      {photo.filename}
                    </p>
                    <p className="fa-num text-[10px] text-[var(--af-muted)]">
                      {formatFileSize(photo.bytes)}
                    </p>
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {!loading && visiblePhotos.length > PAGE_SIZE && (
          <nav
            aria-label="صفحه‌بندی"
            className="mt-4 flex flex-wrap items-center justify-center gap-2 pb-2"
          >
            <button
              type="button"
              disabled={safePage >= pageCount}
              onClick={() => goToPage(safePage + 1)}
              className="af-focusable inline-flex h-9 items-center gap-1 rounded-[var(--af-radius-md)] border border-[var(--af-border)] px-3 text-sm text-[var(--af-muted)] hover:bg-[var(--af-chip)] hover:text-[var(--af-text)] disabled:opacity-35"
            >
              بعدی
              <ChevronLeftIcon className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-1">
              {Array.from({ length: pageCount }, (_, i) => i + 1)
                .filter((n) => {
                  if (pageCount <= 7) return true;
                  if (n === 1 || n === pageCount) return true;
                  return Math.abs(n - safePage) <= 1;
                })
                .reduce<(number | "gap")[]>((acc, n, idx, arr) => {
                  if (idx > 0 && n - (arr[idx - 1] as number) > 1) {
                    acc.push("gap");
                  }
                  acc.push(n);
                  return acc;
                }, [])
                .map((item, idx) =>
                  item === "gap" ? (
                    <span
                      key={`gap-${idx}`}
                      className="px-1 text-sm text-[var(--af-muted)]"
                    >
                      …
                    </span>
                  ) : (
                    <button
                      key={item}
                      type="button"
                      aria-current={item === safePage ? "page" : undefined}
                      onClick={() => goToPage(item)}
                      className={`af-focusable fa-num inline-flex h-9 min-w-9 items-center justify-center rounded-[var(--af-radius-md)] px-2 text-sm ${
                        item === safePage
                          ? "bg-[var(--af-ctl-active-bg)] text-[var(--af-ctl-active-fg)]"
                          : "border border-[var(--af-border)] text-[var(--af-muted)] hover:bg-[var(--af-hover)] hover:text-[var(--af-text)]"
                      }`}
                    >
                      {toFaDigits(item)}
                    </button>
                  ),
                )}
            </div>
            <button
              type="button"
              disabled={safePage <= 1}
              onClick={() => goToPage(safePage - 1)}
              className="af-focusable inline-flex h-9 items-center gap-1 rounded-[var(--af-radius-md)] border border-[var(--af-border)] px-3 text-sm text-[var(--af-muted)] hover:bg-[var(--af-chip)] hover:text-[var(--af-text)] disabled:opacity-35"
            >
              <ChevronRightIcon className="h-4 w-4" />
              قبلی
            </button>
          </nav>
        )}
      </main>

      <AnimatePresence>
        {selected.size > 0 && (
          <motion.div
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--af-border)] bg-[var(--af-surface)]/95 px-3 pt-2.5 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[var(--af-shadow)] backdrop-blur-sm"
          >
            <div className="mx-auto flex max-w-6xl items-center gap-2 overflow-x-auto scrollbar-none">
              <span className="fa-num shrink-0 text-xs text-[var(--af-muted)] sm:text-sm">
                {toFaDigits(selected.size)} انتخاب
              </span>
              <div className="mr-auto flex shrink-0 gap-1.5">
                {tab === "pending" && (
                  <>
                    <Button
                      size="sm"
                      disabled={busy}
                      className="!bg-emerald-500/90 !text-black"
                      onClick={() => runBulk("approve")}
                    >
                      تأیید
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      disabled={busy}
                      onClick={() => runBulk("reject")}
                    >
                      رد
                    </Button>
                  </>
                )}
                {tab === "approved" && (
                  <>
                    <Button
                      size="sm"
                      variant="warn"
                      disabled={busy}
                      onClick={() => runBulk("hide")}
                    >
                      توقف
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      disabled={busy}
                      onClick={() => runBulk("delete")}
                    >
                      حذف
                    </Button>
                  </>
                )}
                {tab === "hidden" && (
                  <>
                    <Button
                      size="sm"
                      disabled={busy}
                      className="!bg-emerald-500/90 !text-black"
                      onClick={() => runBulk("unhide")}
                    >
                      انتشار
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      disabled={busy}
                      onClick={() => runBulk("delete")}
                    >
                      حذف
                    </Button>
                  </>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setSelected(new Set())}
                >
                  لغو
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {previewPhoto && previewIndex !== null && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <button
              type="button"
              aria-label="بستن"
              className="absolute inset-0 bg-black/85"
              onClick={() => setPreviewIndex(null)}
            />
            <motion.div
              className="relative z-10 flex max-h-[92vh] w-full max-w-5xl flex-col"
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
            >
              <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-[var(--af-radius-lg)] border border-[var(--af-border)] bg-black shadow-[var(--af-shadow)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={fullUrl(previewPhoto)}
                  alt="نمایش بزرگ"
                  className="max-h-[min(78vh,900px)] max-w-full object-contain"
                  decoding="async"
                  fetchPriority="high"
                />
                {previewIndex > 0 && (
                  <button
                    type="button"
                    onClick={() => setPreviewIndex(previewIndex - 1)}
                    className="absolute top-1/2 right-2 z-30 -translate-y-1/2 rounded-full bg-black/60 p-2.5 text-white sm:right-3 sm:p-3"
                  >
                    ›
                  </button>
                )}
                {previewIndex < visiblePhotos.length - 1 && (
                  <button
                    type="button"
                    onClick={() => setPreviewIndex(previewIndex + 1)}
                    className="absolute top-1/2 left-2 z-30 -translate-y-1/2 rounded-full bg-black/60 p-2.5 text-white sm:left-3 sm:p-3"
                  >
                    ‹
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setPreviewIndex(null)}
                  className="absolute top-3 left-3 z-30 rounded-full bg-black/60 px-3 py-1.5 text-sm text-white"
                >
                  بستن
                </button>
              </div>
              <div className="mt-2 rounded-[var(--af-radius-md)] border border-[var(--af-border)] bg-[var(--af-surface)] p-3 sm:p-4">
                <p className="mb-1 truncate text-sm font-medium">
                  {previewPhoto.filename}
                </p>
                <p className="fa-num mb-1 text-[11px] text-[var(--af-muted)]">
                  {formatJalaliDate(photoDate(previewPhoto)) || "—"}
                  {" · "}
                  {formatFileSize(previewPhoto.bytes)}
                  {" · "}
                  {toFaDigits(previewPhoto.width)}×
                  {toFaDigits(previewPhoto.height)}
                </p>
                <p className="fa-num mb-3 text-xs text-[var(--af-muted)]">
                  {toFaDigits(previewIndex + 1)} از{" "}
                  {toFaDigits(visiblePhotos.length)}
                </p>
                <div className="flex flex-wrap gap-2">
                  {renderPreviewActions(previewPhoto)}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <ActionSheet
        open={Boolean(sheetPhoto && sheetIndex !== null)}
        onClose={() => setSheetIndex(null)}
        title={sheetPhoto?.filename || ""}
        subtitle={
          sheetPhoto
            ? `${formatFileSize(sheetPhoto.bytes)}${
                formatJalaliDate(photoDate(sheetPhoto))
                  ? ` · ${formatJalaliDate(photoDate(sheetPhoto))}`
                  : ""
              }`
            : undefined
        }
        actions={
          sheetPhoto && sheetIndex !== null
            ? sheetActions(sheetPhoto, sheetIndex)
            : []
        }
      />

      <ConfirmDialog state={confirm} onClose={() => setConfirm(null)} />
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
