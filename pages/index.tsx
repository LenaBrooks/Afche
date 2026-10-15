import type { NextPage } from "next";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { CheckIcon, ChevronDownIcon } from "@heroicons/react/24/solid";
import { LayoutGroup, motion, useReducedMotion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import Bridge from "../components/Icons/Bridge";
import GalleryCard from "../components/GalleryCard";
import Modal from "../components/Modal";
import { toFaDigits } from "../utils/fa";
import {
  clearGalleryStale,
  isGalleryStale,
} from "../utils/gallerySync";
import {
  fadeUp,
  galleryItem,
  heroStagger,
  snappySpring,
  softSpring,
  staggerContainer,
} from "../utils/motion";
import { heroUrl } from "../utils/cloudinaryUrl";
import {
  DEFAULT_SITE_SETTINGS,
  type SiteSettings,
} from "../utils/siteSettingsShared";
import type { ImageProps } from "../utils/types";
import { useLastViewedPhoto } from "../utils/useLastViewedPhoto";

type ViewDensity = 1 | 2 | 3 | 4;
type GallerySort = "newest" | "oldest" | "random";

const SORT_MODES: { id: GallerySort; label: string }[] = [
  { id: "newest", label: "جدیدترین" },
  { id: "oldest", label: "قدیمی‌ترین" },
  { id: "random", label: "تصادفی" },
];

const VIEW_MODES: {
  id: ViewDensity;
  label: string;
  grid: string;
  sizes: string;
}[] = [
  {
    id: 1,
    label: "بزرگ",
    grid: "grid-cols-1 gap-4 sm:grid-cols-2",
    sizes: "(max-width: 640px) 100vw, 50vw",
  },
  {
    id: 2,
    label: "متوسط",
    grid: "grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4",
    sizes: "(max-width: 640px) 50vw, (max-width: 1280px) 33vw, 25vw",
  },
  {
    id: 3,
    label: "کوچک",
    grid: "grid-cols-3 gap-2 sm:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6",
    sizes: "(max-width: 640px) 33vw, (max-width: 1280px) 25vw, 16vw",
  },
  {
    id: 4,
    label: "خیلی کوچک",
    grid: "grid-cols-4 gap-1.5 sm:grid-cols-5 md:grid-cols-6 xl:grid-cols-8 2xl:grid-cols-10",
    sizes: "(max-width: 640px) 25vw, (max-width: 1280px) 16vw, 10vw",
  },
];

const STORAGE_KEY = "gallery-view-density";
const SORT_STORAGE_KEY = "gallery-sort";
const PAGE_SIZE = 24;
const MotionLink = motion(Link);

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

function photoTime(photo: ImageProps) {
  return new Date(photo.created_at || 0).getTime() || 0;
}

const Home: NextPage = ({
  images: initialImages,
  settings: initialSettings,
}: {
  images: ImageProps[];
  settings: SiteSettings;
}) => {
  const router = useRouter();
  const { photoId } = router.query;
  const [lastViewedPhoto, setLastViewedPhoto] = useLastViewedPhoto();
  const [images, setImages] = useState(initialImages);
  const [settings, setSettings] = useState(initialSettings);
  const [galleryRefreshing, setGalleryRefreshing] = useState(false);
  const [density, setDensity] = useState<ViewDensity>(2);
  const [sort, setSort] = useState<GallerySort>("newest");
  const [randomSeed, setRandomSeed] = useState(() => Date.now());
  const [sortOpen, setSortOpen] = useState(false);
  const [densityOpen, setDensityOpen] = useState(false);
  const reduceMotion = useReducedMotion();

  const lastViewedPhotoRef = useRef<HTMLAnchorElement>(null);
  const sortRef = useRef<HTMLDivElement>(null);
  const densityRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  useEffect(() => {
    try {
      const saved = Number(localStorage.getItem(STORAGE_KEY));
      if (saved >= 1 && saved <= 4) setDensity(saved as ViewDensity);
      const savedSort = localStorage.getItem(SORT_STORAGE_KEY);
      if (
        savedSort === "newest" ||
        savedSort === "oldest" ||
        savedSort === "random"
      ) {
        setSort(savedSort);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    setImages(initialImages);
    setSettings(initialSettings);
  }, [initialImages, initialSettings]);

  useEffect(() => {
    let cancelled = false;

    async function refreshGallery(force = false) {
      if (!force && !isGalleryStale()) return;
      setGalleryRefreshing(true);
      try {
        const res = await fetch(`/api/gallery?t=${Date.now()}`, {
          cache: "no-store",
        });
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        if (Array.isArray(data.images)) setImages(data.images);
        if (data.settings) setSettings(data.settings);
        clearGalleryStale();
      } catch {
        /* keep SSR props */
      } finally {
        if (!cancelled) setGalleryRefreshing(false);
      }
    }

    void refreshGallery(true);

    function onVisible() {
      if (document.visibilityState === "visible") void refreshGallery(false);
    }
    function onFocus() {
      void refreshGallery(false);
    }

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onFocus);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onFocus);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!sortOpen && !densityOpen) return;
    function onDoc(e: MouseEvent) {
      const t = e.target as Node;
      if (sortOpen && sortRef.current && !sortRef.current.contains(t)) {
        setSortOpen(false);
      }
      if (densityOpen && densityRef.current && !densityRef.current.contains(t)) {
        setDensityOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setSortOpen(false);
        setDensityOpen(false);
      }
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [sortOpen, densityOpen]);

  function changeDensity(next: ViewDensity) {
    setDensity(next);
    try {
      localStorage.setItem(STORAGE_KEY, String(next));
    } catch {
      /* ignore */
    }
  }

  function changeSort(next: GallerySort) {
    setSort(next);
    if (next === "random") setRandomSeed(Date.now());
    try {
      localStorage.setItem(SORT_STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  }

  const sortedImages = useMemo(() => {
    if (sort === "random") return shuffleSeeded(images, randomSeed);
    const next = [...images];
    next.sort((a, b) => {
      const diff = photoTime(a) - photoTime(b);
      if (diff !== 0) return sort === "oldest" ? diff : -diff;
      return sort === "oldest" ? a.id - b.id : b.id - a.id;
    });
    return next;
  }, [images, sort, randomSeed]);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [sort, randomSeed, density, images.length]);

  const visibleImages = useMemo(
    () => sortedImages.slice(0, visibleCount),
    [sortedImages, visibleCount],
  );
  const hasMore = visibleCount < sortedImages.length;

  useEffect(() => {
    if (lastViewedPhoto == null || photoId) return;
    const targetId = Number(lastViewedPhoto);
    if (!Number.isFinite(targetId)) return;
    const idx = sortedImages.findIndex((p) => p.id === targetId);
    if (idx >= 0 && visibleCount < idx + 1) {
      setVisibleCount(idx + 1);
      return;
    }
    const frame = window.requestAnimationFrame(() => {
      lastViewedPhotoRef.current?.scrollIntoView({ block: "center" });
      setLastViewedPhoto(null);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [
    lastViewedPhoto,
    photoId,
    sortedImages,
    visibleCount,
    setLastViewedPhoto,
  ]);

  useEffect(() => {
    if (!hasMore) return;
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return;
        setVisibleCount((c) => Math.min(c + PAGE_SIZE, sortedImages.length));
      },
      { root: null, rootMargin: "600px 0px", threshold: 0 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [hasMore, sortedImages.length, visibleCount]);

  const mode = VIEW_MODES.find((m) => m.id === density) || VIEW_MODES[1];

  return (
    <>
      <Head>
        <title>{settings.title}</title>
        {settings.coverPublicId && settings.coverFormat && (
          <>
            <meta
              property="og:image"
              content={heroUrl(
                settings.coverPublicId,
                settings.coverFormat,
                settings.coverVersion,
              )}
            />
            <meta
              name="twitter:image"
              content={heroUrl(
                settings.coverPublicId,
                settings.coverFormat,
                settings.coverVersion,
              )}
            />
          </>
        )}
      </Head>
      <main className="mx-auto max-w-[1960px] p-4">
        {photoId && (
          <Modal
            images={images}
            onClose={() => {
              setLastViewedPhoto(photoId);
            }}
          />
        )}

        <motion.div
          className="af-hero-block after:content relative mb-4 flex min-h-[520px] flex-col items-center justify-end gap-4 overflow-hidden rounded-2xl border border-white/10 bg-[#0a0a0a] px-6 pb-16 pt-64 text-center text-white shadow-highlight after:pointer-events-none after:absolute after:inset-0 after:rounded-2xl after:shadow-highlight lg:min-h-[560px] lg:pt-0"
          initial={reduceMotion ? false : { opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={softSpring}
        >
          <motion.div
            className="pointer-events-none absolute -top-24 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-[#e8c58c]/15 blur-3xl"
            animate={
              reduceMotion
                ? undefined
                : { scale: [1, 1.15, 1], opacity: [0.35, 0.55, 0.35] }
            }
            transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          />
          {settings.coverPublicId && settings.coverFormat ? (
            <div className="absolute inset-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={heroUrl(
                  settings.coverPublicId,
                  settings.coverFormat,
                  settings.coverVersion,
                )}
                alt=""
                className="h-full w-full object-cover"
                loading="eager"
                decoding="async"
                fetchPriority="high"
              />
              <span className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/55 to-black/90" />
            </div>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center opacity-20">
              <motion.span
                className="flex max-h-full max-w-full items-center justify-center"
                animate={reduceMotion ? undefined : { y: [0, -8, 0] }}
                transition={{
                  duration: 10,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              >
                <Bridge />
              </motion.span>
              <span className="absolute bottom-0 left-0 right-0 h-[400px] bg-gradient-to-b from-black/0 via-black/80 to-black"></span>
            </div>
          )}

          <motion.div
            className="relative z-10 flex flex-col items-center"
            variants={heroStagger}
            initial="hidden"
            animate="show"
          >
            <motion.h1
              variants={fadeUp}
              className="text-shine mb-4 text-2xl font-bold tracking-[0.2em] sm:text-3xl"
            >
              {settings.title}
            </motion.h1>
            <motion.p
              variants={fadeUp}
              className="max-w-[40ch] text-white/75 sm:max-w-[32ch]"
            >
              {settings.subtitle}
            </motion.p>
            <motion.div
              variants={fadeUp}
              className="z-10 mt-6 flex flex-wrap items-center justify-center gap-3 md:mt-4"
            >
              <MotionLink
                href="/upload"
                prefetch
                whileHover={reduceMotion ? undefined : { scale: 1.04, y: -2 }}
                whileTap={reduceMotion ? undefined : { scale: 0.97 }}
                transition={snappySpring}
                className="rounded-xl border border-white/35 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white"
              >
                آپلود عکس
              </MotionLink>
            </motion.div>
          </motion.div>
        </motion.div>

        {images.length === 0 ? (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="py-16 text-center text-[var(--af-muted)]"
          >
            هنوز عکسی منتشر نشده است.
          </motion.p>
        ) : (
          <>
            <motion.div
              className="mb-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-2"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, ...softSpring }}
            >
              <p className="fa-num flex min-w-0 items-center gap-2 text-sm text-[var(--af-muted)]">
                <span>{toFaDigits(images.length)} عکس</span>
                {galleryRefreshing && (
                  <span
                    className="inline-flex items-center gap-1.5 text-[11px] text-[var(--af-accent)]"
                    aria-live="polite"
                  >
                    <span className="h-3 w-3 animate-spin rounded-full border-2 border-[var(--af-accent)]/30 border-t-[var(--af-accent)]" />
                    به‌روزرسانی…
                  </span>
                )}
              </p>

              <div className="flex shrink-0 items-center gap-2">
                <div className="relative" ref={sortRef}>
                  <button
                    type="button"
                    aria-haspopup="listbox"
                    aria-expanded={sortOpen}
                    aria-label="مرتب‌سازی"
                    onClick={() => {
                      setSortOpen((o) => !o);
                      setDensityOpen(false);
                    }}
                    className="af-focusable flex h-9 items-center gap-1.5 rounded-[var(--af-radius-md)] border border-[var(--af-border)] bg-[var(--af-surface)] px-2.5 text-sm shadow-[var(--af-shadow-sm)] sm:h-10 sm:px-3"
                  >
                    <span className="whitespace-nowrap text-[var(--af-text)]">
                      {SORT_MODES.find((m) => m.id === sort)?.label}
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
                      className="absolute top-[calc(100%+6px)] end-0 z-40 min-w-[9.5rem] overflow-hidden rounded-[var(--af-radius-md)] border border-[var(--af-border)] bg-[var(--af-surface)] py-1 shadow-[var(--af-shadow)]"
                    >
                      {SORT_MODES.map((opt) => {
                        const active = opt.id === sort;
                        return (
                          <li key={opt.id}>
                            <button
                              type="button"
                              role="option"
                              aria-selected={active}
                              onClick={() => {
                                changeSort(opt.id);
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
                                <CheckIcon className="h-4 w-4 text-[var(--af-accent)]" />
                              )}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>

                <div className="relative" ref={densityRef}>
                  <button
                    type="button"
                    aria-haspopup="listbox"
                    aria-expanded={densityOpen}
                    aria-label="اندازه نمایش"
                    onClick={() => {
                      setDensityOpen((o) => !o);
                      setSortOpen(false);
                    }}
                    className="af-focusable flex h-9 items-center gap-1.5 rounded-[var(--af-radius-md)] border border-[var(--af-border)] bg-[var(--af-surface)] px-2.5 text-sm shadow-[var(--af-shadow-sm)] sm:h-10 sm:px-3"
                  >
                    <span className="whitespace-nowrap text-[var(--af-text)]">
                      {VIEW_MODES.find((m) => m.id === density)?.label}
                    </span>
                    <ChevronDownIcon
                      className={`h-4 w-4 shrink-0 text-[var(--af-muted)] transition ${
                        densityOpen ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                  {densityOpen && (
                    <ul
                      role="listbox"
                      className="absolute top-[calc(100%+6px)] end-0 z-40 min-w-[9.5rem] overflow-hidden rounded-[var(--af-radius-md)] border border-[var(--af-border)] bg-[var(--af-surface)] py-1 shadow-[var(--af-shadow)]"
                    >
                      {VIEW_MODES.map((opt) => {
                        const active = opt.id === density;
                        return (
                          <li key={opt.id}>
                            <button
                              type="button"
                              role="option"
                              aria-selected={active}
                              onClick={() => {
                                changeDensity(opt.id);
                                setDensityOpen(false);
                              }}
                              className={`flex w-full items-center justify-between gap-3 px-3 py-2.5 text-right text-sm ${
                                active
                                  ? "bg-[var(--af-accent-soft)] text-[var(--af-text)]"
                                  : "text-[var(--af-muted)] hover:bg-[var(--af-hover)] hover:text-[var(--af-text)]"
                              }`}
                            >
                              {opt.label}
                              {active && (
                                <CheckIcon className="h-4 w-4 text-[var(--af-accent)]" />
                              )}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </div>
            </motion.div>

            <LayoutGroup>
              <motion.div
                key={`${density}-${sort}-${sort === "random" ? randomSeed : "x"}`}
                className={`grid ${mode.grid}`}
                variants={staggerContainer}
                initial={reduceMotion ? false : "hidden"}
                animate="show"
              >
                {visibleImages.map(
                  ({ id, public_id, format, version }, index) => (
                    <motion.div
                      key={`${public_id}-${id}`}
                      variants={galleryItem}
                      layout
                      whileHover={
                        reduceMotion
                          ? undefined
                          : { y: -6, scale: 1.02, transition: snappySpring }
                      }
                      whileTap={reduceMotion ? undefined : { scale: 0.98 }}
                    >
                      <GalleryCard
                        id={id}
                        publicId={public_id}
                        format={format}
                        version={version}
                        sizes={mode.sizes}
                        priority={index < 4}
                        lastViewedRef={
                          id === Number(lastViewedPhoto)
                            ? lastViewedPhotoRef
                            : null
                        }
                      />
                    </motion.div>
                  ),
                )}
              </motion.div>
            </LayoutGroup>

            {hasMore && (
              <div
                ref={sentinelRef}
                className="flex items-center justify-center py-8"
                aria-hidden
              >
                <span className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--af-accent)]/30 border-t-[var(--af-accent)]" />
              </div>
            )}
          </>
        )}
      </main>
    </>
  );
};

export default Home;

export async function getStaticProps() {
  const [{ getPublicGalleryImages }, { getSiteSettings }] = await Promise.all([
    import("../utils/photos"),
    import("../utils/siteSettings"),
  ]);
  const [images, settings] = await Promise.all([
    getPublicGalleryImages(),
    getSiteSettings(),
  ]);
  return {
    props: {
      images,
      settings: settings || DEFAULT_SITE_SETTINGS,
    },
    revalidate: 300,
  };
}
