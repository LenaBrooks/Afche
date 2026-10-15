import type { NextPage } from "next";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import {
  ArrowRightOnRectangleIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  Cog6ToothIcon,
  MagnifyingGlassIcon,
  MoonIcon,
  PhotoIcon,
  PlusIcon,
  Squares2X2Icon,
  SunIcon,
  TrashIcon,
} from "@heroicons/react/24/solid";
import {
  CheckCircleIcon,
  ListBulletIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { AnimatePresence, motion } from "framer-motion";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import AdminGate from "../../components/AdminGate";
import AdminNavLink from "../../components/AdminNavLink";
import ActionSheet, {
  type ActionSheetItem,
} from "../../components/ui/ActionSheet";
import Button from "../../components/ui/Button";
import ConfirmDialog, {
  type ConfirmState,
} from "../../components/ui/ConfirmDialog";
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
import { clearAdminAuthed } from "../../utils/adminSession";
import { lightboxUrl } from "../../utils/cloudinaryUrl";
import {
  formatFileSize,
  formatJalaliDate,
  toFaDigits,
} from "../../utils/fa";
import { notifyGalleryUpdated } from "../../utils/gallerySync";
import {
  applyAdminTheme,
  readAdminTheme,
  type SiteTheme,
} from "../../utils/siteSettingsShared";

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
  return lightboxUrl(photo.public_id, photo.format, false, photo.version);
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

function tabFromQuery(value: string | string[] | undefined): Tab | null {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === "pending" || raw === "approved" || raw === "hidden") return raw;
  return null;
}

function samePhotoIds(a: AdminPhoto[], b: AdminPhoto[]) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i].public_id !== b[i].public_id) return false;
  }
  return true;
}

function initialTab(): Tab {
  if (typeof window === "undefined") return "pending";
  return (
    tabFromQuery(
      new URLSearchParams(window.location.search).get("tab") || undefined,
    ) || "pending"
  );
}

const AdminPanel: NextPage = () => {
  const router = useRouter();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>(initialTab);
  const [photos, setPhotos] = useState<AdminPhoto[]>(
    () => getAdminCache(initialTab()) || [],
  );
  const [counts, setCounts] = useState<Record<Tab, number>>(() => ({
    pending: getAdminCache("pending")?.length ?? 0,
    approved: getAdminCache("approved")?.length ?? 0,
    hidden: getAdminCache("hidden")?.length ?? 0,
  }));
  const [loading, setLoading] = useState(() => !getAdminCache(initialTab()));
  const [refreshing, setRefreshing] = useState(false);
  const [adminTheme, setAdminTheme] = useState<SiteTheme>("dark");
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
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [confirm, setConfirm] = useState<ConfirmState>(null);
  const sortRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listTopRef = useRef<HTMLDivElement>(null);
  const tabRef = useRef<Tab>(tab);
  const loadSeq = useRef(0);

  tabRef.current = tab;

  const syncCount = useCallback((status: Tab, list: AdminPhoto[]) => {
    setCounts((prev) =>
      prev[status] === list.length ? prev : { ...prev, [status]: list.length },
    );
  }, []);

  useEffect(() => {
    setAdminTheme(readAdminTheme());
  }, []);

  useEffect(() => {
    if (searchOpen) searchInputRef.current?.focus();
  }, [searchOpen]);

  function toggleAdminTheme() {
    const next: SiteTheme = adminTheme === "dark" ? "light" : "dark";
    setAdminTheme(next);
    applyAdminTheme(next);
  }

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

  const showTab = useCallback(
    (next: Tab) => {
      if (next === tabRef.current) return;
      tabRef.current = next;
      const cached = getAdminCache(next);
      setTab(next);
      setPhotos(cached || []);
      setLoading(!cached);
      setSelected(new Set());
      setPreviewIndex(null);
      setSheetIndex(null);
      setQuery("");
      setSearchOpen(false);
      setError("");
      if (cached) syncCount(next, cached);
    },
    [syncCount],
  );

  useEffect(() => {
    if (!router.isReady) return;
    const next = tabFromQuery(router.query.tab);
    if (next && next !== tabRef.current) showTab(next);
  }, [router.isReady, router.query.tab, showTab]);

  const load = useCallback(
    async (status: Tab, opts?: { silent?: boolean }) => {
      const seq = ++loadSeq.current;
      const cached = getAdminCache(status);
      const silent = opts?.silent ?? Boolean(cached);
      const isCurrent = () =>
        status === tabRef.current && seq === loadSeq.current;

      if (cached) {
        if (isCurrent()) {
          setPhotos((prev) => (samePhotoIds(prev, cached) ? prev : cached));
          setLoading(false);
        }
        syncCount(status, cached);
      } else if (!silent && isCurrent()) {
        setLoading(true);
      } else if (silent && isCurrent()) {
        setRefreshing(true);
      }

      setError("");
      try {
        const res = await fetch(`/api/admin/photos?status=${status}`);
        if (res.status === 401) {
          clearAdminAuthed();
          window.location.href = "/admin/login";
          return;
        }
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "بارگذاری ناموفق بود");
        }
        const data = await res.json();
        const list = data.photos || [];
        setAdminCache(status, list);
        syncCount(status, list);
        if (isCurrent()) {
          setPhotos((prev) => (samePhotoIds(prev, list) ? prev : list));
        }
      } catch (e: any) {
        if (!cached && isCurrent()) {
          setError(e.message || "بارگذاری ناموفق بود");
          setPhotos([]);
        }
      } finally {
        if (isCurrent()) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [syncCount],
  );

  useEffect(() => {
    const cached = getAdminCache(tab);
    if (cached) {
      setPhotos((prev) => (samePhotoIds(prev, cached) ? prev : cached));
      syncCount(tab, cached);
      setLoading(false);
      // Keep cached list as-is when switching tabs — background refetch
      // was racing and flashing the wrong / previous list.
      return;
    }
    void load(tab);
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
    // Drop in-flight list fetches so a stale response can't restore old photos.
    loadSeq.current += 1;
    setRefreshing(false);
    setLoading(false);

    const remove = new Set(ids);
    const moved = photos.filter((p) => remove.has(p.public_id));
    const n = moved.length;
    const nextCurrent = photos.filter((p) => !remove.has(p.public_id));

    setAdminCache(tab, nextCurrent);
    setPhotos(nextCurrent);

    let destCount: number | null = null;
    const otherCounts: Partial<Record<Tab, number>> = {};

    const moveTo = (dest: Tab, status: string) => {
      const cached = getAdminCache(dest);
      if (cached) {
        const nextDest = [
          ...moved.map((p) => ({ ...p, status })),
          ...cached.filter((p) => !remove.has(p.public_id)),
        ];
        setAdminCache(dest, nextDest);
        destCount = nextDest.length;
      } else {
        invalidateAdminCache(dest);
      }
    };

    if (action === "hide") moveTo("hidden", "hidden");
    else if (action === "unhide") moveTo("approved", "approved");
    else if (action === "approve") moveTo("approved", "approved");
    else {
      for (const t of relatedTabs(tab, action)) {
        if (t === tab) continue;
        const cached = getAdminCache(t);
        if (cached) {
          const filtered = cached.filter((p) => !remove.has(p.public_id));
          setAdminCache(t, filtered);
          otherCounts[t] = filtered.length;
        } else {
          invalidateAdminCache(t);
        }
      }
    }

    setCounts((prev) => {
      const next = { ...prev, [tab]: nextCurrent.length };
      if (action === "hide") {
        next.hidden = destCount ?? prev.hidden + n;
      } else if (action === "unhide" || action === "approve") {
        next.approved = destCount ?? prev.approved + n;
      } else {
        Object.assign(next, otherCounts);
      }
      return next;
    });

    setSelected((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.delete(id));
      return next;
    });
    setPreviewIndex(null);
    setSheetIndex(null);
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
    clearAdminAuthed();
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    window.location.href = "/admin/login";
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
            </p>
          </div>
          <div className="flex shrink-0 gap-1.5">
            <AdminNavLink
              href="/admin/upload"
              title="آپلود عکس"
              aria-label="آپلود عکس"
              className="af-focusable inline-flex h-10 w-10 items-center justify-center rounded-[var(--af-radius-md)] border border-[var(--af-border)] text-[var(--af-muted)] hover:bg-[var(--af-chip)] hover:text-[var(--af-text)]"
            >
              <PlusIcon className="h-4 w-4" />
            </AdminNavLink>
            <button
              type="button"
              title={adminTheme === "dark" ? "تم روشن" : "تم تیره"}
              aria-label={adminTheme === "dark" ? "تم روشن" : "تم تیره"}
              onClick={toggleAdminTheme}
              className="af-focusable inline-flex h-10 w-10 items-center justify-center rounded-[var(--af-radius-md)] border border-[var(--af-border)] text-[var(--af-muted)] hover:bg-[var(--af-chip)] hover:text-[var(--af-text)]"
            >
              {adminTheme === "dark" ? (
                <SunIcon className="h-4 w-4" />
              ) : (
                <MoonIcon className="h-4 w-4" />
              )}
            </button>
            <AdminNavLink
              href="/admin/settings"
              title="تنظیمات"
              aria-label="تنظیمات"
              className="af-focusable inline-flex h-10 w-10 items-center justify-center rounded-[var(--af-radius-md)] border border-[var(--af-border)] text-[var(--af-muted)] hover:bg-[var(--af-chip)] hover:text-[var(--af-text)]"
            >
              <Cog6ToothIcon className="h-4 w-4" />
            </AdminNavLink>
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
              showTab(id);
              void router.replace(
                id === "pending" ? "/admin" : `/admin?tab=${id}`,
                undefined,
                { shallow: true },
              );
            }}
          />
        </div>

        {!loading && photos.length > 0 && (
          <div className="mb-2 space-y-1.5">
            <div className="flex items-center gap-1">
              <div className="relative" ref={sortRef}>
                <button
                  type="button"
                  aria-haspopup="listbox"
                  aria-expanded={sortOpen}
                  onClick={() => setSortOpen((o) => !o)}
                  className="af-focusable inline-flex h-9 items-center gap-1 rounded-lg px-2 text-sm text-[var(--af-text)] hover:bg-[var(--af-hover)]"
                >
                  {SORT_OPTIONS.find((o) => o.id === sortKey)?.label}
                  <ChevronDownIcon
                    className={`h-3.5 w-3.5 text-[var(--af-muted)] transition ${
                      sortOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>
                {sortOpen && (
                  <ul
                    role="listbox"
                    className="absolute top-[calc(100%+4px)] right-0 z-40 min-w-[8.5rem] overflow-hidden rounded-lg bg-[var(--af-surface)] py-1 shadow-[var(--af-shadow)] ring-1 ring-[var(--af-border)]"
                  >
                    {SORT_OPTIONS.map((opt) => {
                      const active = opt.id === sortKey;
                      return (
                        <li key={opt.id}>
                          <button
                            type="button"
                            onClick={() => {
                              setSortKey(opt.id);
                              if (opt.id === "random") setRandomSeed(Date.now());
                              setSortOpen(false);
                            }}
                            className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-right text-sm ${
                              active
                                ? "bg-[var(--af-ctl-active-bg)] text-[var(--af-ctl-active-fg)]"
                                : "text-[var(--af-muted)] hover:bg-[var(--af-hover)] hover:text-[var(--af-text)]"
                            }`}
                          >
                            {opt.label}
                            {active && (
                              <CheckIcon className="h-3.5 w-3.5 text-[var(--af-accent)]" />
                            )}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              <button
                type="button"
                title="جستجو"
                aria-label="جستجو"
                aria-expanded={searchOpen}
                onClick={() => setSearchOpen((o) => !o)}
                className={`af-focusable inline-flex h-9 w-9 items-center justify-center rounded-lg transition ${
                  searchOpen || query
                    ? "bg-[var(--af-ctl-active-bg)] text-[var(--af-ctl-active-fg)]"
                    : "text-[var(--af-muted)] hover:bg-[var(--af-hover)] hover:text-[var(--af-text)]"
                }`}
              >
                <MagnifyingGlassIcon className="h-4 w-4" />
              </button>

              <button
                type="button"
                title={viewMode === "grid" ? "نمای لیستی" : "نمای شبکه‌ای"}
                aria-label={viewMode === "grid" ? "نمای لیستی" : "نمای شبکه‌ای"}
                onClick={() =>
                  setViewMode((m) => (m === "grid" ? "list" : "grid"))
                }
                className="af-focusable inline-flex h-9 w-9 items-center justify-center rounded-lg text-[var(--af-muted)] hover:bg-[var(--af-hover)] hover:text-[var(--af-text)]"
              >
                {viewMode === "grid" ? (
                  <ListBulletIcon className="h-4 w-4" />
                ) : (
                  <Squares2X2Icon className="h-4 w-4" />
                )}
              </button>

              <div className="mr-auto flex items-center gap-0.5">
                <button
                  type="button"
                  title={allSelected ? "لغو انتخاب" : "انتخاب همه"}
                  aria-label={allSelected ? "لغو انتخاب" : "انتخاب همه"}
                  aria-pressed={allSelected}
                  disabled={busy}
                  onClick={toggleAll}
                  className={`af-focusable inline-flex h-9 w-9 items-center justify-center rounded-lg transition disabled:opacity-40 ${
                    allSelected
                      ? "bg-[var(--af-ctl-active-bg)] text-[var(--af-ctl-active-fg)]"
                      : "text-[var(--af-muted)] hover:bg-[var(--af-hover)] hover:text-[var(--af-text)]"
                  }`}
                >
                  <CheckCircleIcon className="h-5 w-5" />
                </button>

                {tab === "pending" && (
                  <button
                    type="button"
                    title="تأیید همه"
                    aria-label="تأیید همه"
                    disabled={busy || visiblePhotos.length === 0}
                    onClick={() =>
                      runBulk(
                        "approve",
                        visiblePhotos.map((p) => p.public_id),
                      )
                    }
                    className="af-focusable inline-flex h-9 w-9 items-center justify-center rounded-lg text-[var(--af-ok)] hover:bg-[var(--af-ok-soft)] disabled:opacity-40"
                  >
                    <CheckIcon className="h-5 w-5" />
                  </button>
                )}

                {(tab === "approved" || tab === "hidden") && (
                  <button
                    type="button"
                    title="حذف انتخاب‌شده‌ها"
                    aria-label="حذف انتخاب‌شده‌ها"
                    disabled={busy || selected.size === 0}
                    onClick={() => runBulk("delete")}
                    className="af-focusable inline-flex h-9 w-9 items-center justify-center rounded-lg text-[var(--af-danger)] hover:bg-[var(--af-danger-soft)] disabled:opacity-40"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>

            {searchOpen && (
              <div className="relative">
                <input
                  ref={searchInputRef}
                  type="search"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setPreviewIndex(null);
                    setSheetIndex(null);
                  }}
                  placeholder="جستجو…"
                  className="af-focusable h-9 w-full rounded-lg bg-[var(--af-input-bg)] px-3 text-sm text-[var(--af-text)] outline-none ring-1 ring-[var(--af-border)] placeholder:text-[var(--af-muted)] focus:ring-[var(--af-accent)]/40"
                />
                <button
                  type="button"
                  title="بستن"
                  aria-label="بستن جستجو"
                  onClick={() => {
                    setSearchOpen(false);
                    setQuery("");
                  }}
                  className="absolute top-1/2 left-1.5 inline-flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-[var(--af-muted)] hover:text-[var(--af-text)]"
                >
                  <XMarkIcon className="h-4 w-4" />
                </button>
              </div>
            )}
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
              <AdminNavLink
                href="/admin/upload"
                className="af-focusable inline-flex items-center gap-2 rounded-[var(--af-radius-md)] border border-[var(--af-inverse)] bg-[var(--af-inverse)] px-4 py-2.5 text-sm font-semibold text-[var(--af-inverse-text)]"
              >
                <PlusIcon className="h-4 w-4" />
                آپلود عکس
              </AdminNavLink>
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
                  className={`flex h-14 items-center gap-2 border-b border-[var(--af-hairline)] px-2 transition sm:h-16 sm:gap-3 sm:px-3 ${
                    isSelected
                      ? "bg-[var(--af-ctl-active-bg)] shadow-[inset_3px_0_0_var(--af-accent),var(--af-ctl-active-glow)]"
                      : ""
                  }`}
                >
                  <label
                    className={`flex h-10 w-8 shrink-0 cursor-pointer items-center justify-center ${
                      isSelected ? "text-[var(--af-accent)]" : "text-[var(--af-muted)]"
                    }`}
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
                        loading="eager"
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
                  className={`overflow-hidden rounded-[var(--af-radius-md)] border bg-[var(--af-surface)] transition ${
                    isSelected
                      ? "border-[var(--af-accent)] shadow-[var(--af-select-glow)] ring-1 ring-[var(--af-ctl-active-ring)]"
                      : "border-[var(--af-border)]"
                  }`}
                >
                  <div className="relative">
                    <label
                      className={`absolute top-1.5 right-1.5 z-20 flex h-7 w-7 cursor-pointer items-center justify-center rounded-md transition ${
                        isSelected
                          ? "bg-[var(--af-accent)] text-[var(--af-inverse)] shadow-[0_0_14px_rgba(232,197,140,0.75)]"
                          : "bg-black/55 text-white/80"
                      }`}
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
                        loading="eager"
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
            className="mt-4 flex flex-wrap items-center justify-center gap-1.5 pb-2"
          >
            <button
              type="button"
              title="صفحه بعد"
              aria-label="صفحه بعد"
              disabled={safePage >= pageCount}
              onClick={() => goToPage(safePage + 1)}
              className="af-focusable inline-flex h-9 w-9 items-center justify-center rounded-[var(--af-radius-md)] border border-[var(--af-border)] text-[var(--af-muted)] hover:bg-[var(--af-chip)] hover:text-[var(--af-text)] disabled:opacity-35"
            >
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
                      title={`صفحه ${toFaDigits(item)}`}
                      aria-label={`صفحه ${toFaDigits(item)}`}
                      aria-current={item === safePage ? "page" : undefined}
                      onClick={() => goToPage(item)}
                      className={`af-focusable fa-num inline-flex h-9 min-w-9 items-center justify-center rounded-[var(--af-radius-md)] px-2 text-sm transition ${
                        item === safePage
                          ? "bg-[var(--af-ctl-active-bg)] text-[var(--af-ctl-active-fg)] shadow-[var(--af-ctl-active-glow)] ring-1 ring-[var(--af-ctl-active-ring)]"
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
              title="صفحه قبل"
              aria-label="صفحه قبل"
              disabled={safePage <= 1}
              onClick={() => goToPage(safePage - 1)}
              className="af-focusable inline-flex h-9 w-9 items-center justify-center rounded-[var(--af-radius-md)] border border-[var(--af-border)] text-[var(--af-muted)] hover:bg-[var(--af-chip)] hover:text-[var(--af-text)] disabled:opacity-35"
            >
              <ChevronRightIcon className="h-4 w-4" />
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
            className="fixed inset-x-0 bottom-0 z-40 bg-[var(--af-surface)]/95 px-3 pt-2.5 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[var(--af-ctl-active-glow)] ring-1 ring-[var(--af-ctl-active-ring)] backdrop-blur-sm"
          >
            <div className="mx-auto flex max-w-6xl items-center gap-2">
              <span className="fa-num text-xs text-[var(--af-ctl-active-fg)]">
                {toFaDigits(selected.size)}
              </span>
              <div className="mr-auto flex items-center gap-0.5">
                {tab === "pending" && (
                  <>
                    <button
                      type="button"
                      title="تأیید"
                      aria-label="تأیید"
                      disabled={busy}
                      onClick={() => runBulk("approve")}
                      className="af-focusable inline-flex h-10 w-10 items-center justify-center rounded-lg text-[var(--af-ok)] hover:bg-[var(--af-ok-soft)] disabled:opacity-40"
                    >
                      <CheckIcon className="h-5 w-5" />
                    </button>
                    <button
                      type="button"
                      title="رد"
                      aria-label="رد"
                      disabled={busy}
                      onClick={() => runBulk("reject")}
                      className="af-focusable inline-flex h-10 w-10 items-center justify-center rounded-lg text-[var(--af-danger)] hover:bg-[var(--af-danger-soft)] disabled:opacity-40"
                    >
                      <XMarkIcon className="h-5 w-5" />
                    </button>
                  </>
                )}
                {tab === "approved" && (
                  <>
                    <button
                      type="button"
                      title="توقف"
                      aria-label="توقف"
                      disabled={busy}
                      onClick={() => runBulk("hide")}
                      className="af-focusable inline-flex h-10 w-10 items-center justify-center rounded-lg text-[var(--af-warn)] hover:bg-[var(--af-warn-soft)] disabled:opacity-40"
                    >
                      <MoonIcon className="h-5 w-5" />
                    </button>
                    <button
                      type="button"
                      title="حذف"
                      aria-label="حذف"
                      disabled={busy}
                      onClick={() => runBulk("delete")}
                      className="af-focusable inline-flex h-10 w-10 items-center justify-center rounded-lg text-[var(--af-danger)] hover:bg-[var(--af-danger-soft)] disabled:opacity-40"
                    >
                      <TrashIcon className="h-5 w-5" />
                    </button>
                  </>
                )}
                {tab === "hidden" && (
                  <>
                    <button
                      type="button"
                      title="انتشار"
                      aria-label="انتشار"
                      disabled={busy}
                      onClick={() => runBulk("unhide")}
                      className="af-focusable inline-flex h-10 w-10 items-center justify-center rounded-lg text-[var(--af-ok)] hover:bg-[var(--af-ok-soft)] disabled:opacity-40"
                    >
                      <CheckIcon className="h-5 w-5" />
                    </button>
                    <button
                      type="button"
                      title="حذف"
                      aria-label="حذف"
                      disabled={busy}
                      onClick={() => runBulk("delete")}
                      className="af-focusable inline-flex h-10 w-10 items-center justify-center rounded-lg text-[var(--af-danger)] hover:bg-[var(--af-danger-soft)] disabled:opacity-40"
                    >
                      <TrashIcon className="h-5 w-5" />
                    </button>
                  </>
                )}
                <button
                  type="button"
                  title="لغو انتخاب"
                  aria-label="لغو انتخاب"
                  onClick={() => setSelected(new Set())}
                  className="af-focusable inline-flex h-10 w-10 items-center justify-center rounded-lg text-[var(--af-muted)] hover:bg-[var(--af-hover)] hover:text-[var(--af-text)]"
                >
                  <XMarkIcon className="h-5 w-5" />
                </button>
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
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
            >
              <div
                className="relative flex min-h-0 w-full flex-1 items-center justify-center overflow-hidden rounded-[var(--af-radius-lg)] bg-black shadow-[var(--af-shadow)]"
                style={{
                  aspectRatio:
                    previewPhoto.width > 0 && previewPhoto.height > 0
                      ? `${previewPhoto.width} / ${previewPhoto.height}`
                      : "3 / 2",
                  maxHeight: "min(78vh, 900px)",
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={fullUrl(previewPhoto)}
                  alt="نمایش بزرگ"
                  width={previewPhoto.width}
                  height={previewPhoto.height}
                  className="max-h-full max-w-full object-contain"
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
              <div className="mt-2 rounded-[var(--af-radius-md)] bg-[var(--af-surface)] p-3 shadow-[var(--af-shadow-sm)] sm:p-4">
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

export default function AdminPanelPage() {
  return (
    <AdminGate>
      <AdminPanel />
    </AdminGate>
  );
}
