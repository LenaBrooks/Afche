import type { NextPage } from "next";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { LayoutGroup, motion, useReducedMotion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import Bridge from "../components/Icons/Bridge";
import Logo from "../components/Icons/Logo";
import Modal from "../components/Modal";
import { toFaDigits } from "../utils/fa";
import {
  fadeUp,
  galleryItem,
  heroStagger,
  snappySpring,
  softSpring,
  staggerContainer,
} from "../utils/motion";
import { cardUrl, heroUrl } from "../utils/cloudinaryUrl";
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
  images,
  settings,
}: {
  images: ImageProps[];
  settings: SiteSettings;
}) => {
  const router = useRouter();
  const { photoId } = router.query;
  const [lastViewedPhoto, setLastViewedPhoto] = useLastViewedPhoto();
  const [density, setDensity] = useState<ViewDensity>(2);
  const [sort, setSort] = useState<GallerySort>("newest");
  const [randomSeed, setRandomSeed] = useState(() => Date.now());
  const reduceMotion = useReducedMotion();

  const lastViewedPhotoRef = useRef<HTMLAnchorElement>(null);

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
    if (lastViewedPhoto && !photoId) {
      lastViewedPhotoRef.current?.scrollIntoView({ block: "center" });
      setLastViewedPhoto(null);
    }
  }, [photoId, lastViewedPhoto, setLastViewedPhoto]);

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

  const mode = VIEW_MODES.find((m) => m.id === density) || VIEW_MODES[1];

  return (
    <>
      <Head>
        <title>{settings.title}</title>
        {settings.coverPublicId && settings.coverFormat && (
          <>
            <meta
              property="og:image"
              content={heroUrl(settings.coverPublicId, settings.coverFormat)}
            />
            <meta
              name="twitter:image"
              content={heroUrl(settings.coverPublicId, settings.coverFormat)}
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
                src={heroUrl(settings.coverPublicId, settings.coverFormat)}
                alt=""
                className="h-full w-full object-cover"
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
            <motion.div variants={fadeUp}>
              <Logo />
            </motion.div>
            <motion.h1
              variants={fadeUp}
              className="text-shine mt-8 mb-4 text-2xl font-bold tracking-[0.2em] sm:text-3xl"
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
                className="rounded-xl border border-white bg-white px-4 py-2.5 text-sm font-semibold text-black shadow-[0_0_40px_-12px_rgba(232,197,140,0.55)]"
              >
                آپلود عکس
              </MotionLink>
              <MotionLink
                href="/admin/login"
                prefetch
                whileHover={reduceMotion ? undefined : { scale: 1.04, y: -2 }}
                whileTap={reduceMotion ? undefined : { scale: 0.97 }}
                transition={snappySpring}
                className="rounded-xl border border-white/35 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white"
              >
                ورود مدیر
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
              className="mb-4 flex flex-wrap items-center justify-between gap-3"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, ...softSpring }}
            >
              <p className="fa-num text-sm text-[var(--af-muted)]">
                {toFaDigits(images.length)} عکس
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <div
                  className="relative flex items-center gap-1 rounded-xl border border-[var(--af-border)] bg-[var(--af-surface)] p-1"
                  role="group"
                  aria-label="مرتب‌سازی"
                >
                  {SORT_MODES.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => changeSort(m.id)}
                      title={
                        m.id === "random" && sort === "random"
                          ? "بزن تا دوباره قاطی شود"
                          : m.label
                      }
                      aria-pressed={sort === m.id}
                      className="relative rounded-lg px-2.5 py-1.5 text-xs font-medium text-[var(--af-muted)] transition hover:text-[var(--af-text)]"
                    >
                      {sort === m.id && (
                        <motion.span
                          layoutId="sort-pill"
                          className="absolute inset-0 rounded-lg bg-[var(--af-ctl-active-bg)]"
                          transition={snappySpring}
                        />
                      )}
                      <span
                        className={`relative z-10 ${
                          sort === m.id ? "text-[var(--af-ctl-active-fg)]" : ""
                        }`}
                      >
                        {m.label}
                      </span>
                    </button>
                  ))}
                </div>
                <div
                  className="relative flex items-center gap-1 rounded-xl border border-[var(--af-border)] bg-[var(--af-surface)] p-1"
                  role="group"
                  aria-label="اندازه نمایش کارت‌ها"
                >
                  {VIEW_MODES.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => changeDensity(m.id)}
                      title={m.label}
                      aria-pressed={density === m.id}
                      className="relative rounded-lg px-2.5 py-1.5 text-xs font-medium text-[var(--af-muted)] transition hover:text-[var(--af-text)]"
                    >
                      {density === m.id && (
                        <motion.span
                          layoutId="density-pill"
                          className="absolute inset-0 rounded-lg bg-[var(--af-ctl-active-bg)]"
                          transition={snappySpring}
                        />
                      )}
                      <span
                        className={`relative z-10 ${
                          density === m.id ? "text-[var(--af-ctl-active-fg)]" : ""
                        }`}
                      >
                        {m.label}
                      </span>
                    </button>
                  ))}
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
                {sortedImages.map(({ id, public_id, format }, index) => (
                  <motion.div
                    key={id}
                    variants={galleryItem}
                    layout
                    whileHover={
                      reduceMotion
                        ? undefined
                        : { y: -6, scale: 1.02, transition: snappySpring }
                    }
                    whileTap={reduceMotion ? undefined : { scale: 0.98 }}
                  >
                    <Link
                      href={`/?photoId=${id}`}
                      as={`/p/${id}`}
                      ref={
                        id === Number(lastViewedPhoto)
                          ? lastViewedPhotoRef
                          : null
                      }
                      shallow
                      className="after:content group relative block aspect-[3/2] w-full cursor-zoom-in overflow-hidden rounded-xl bg-[var(--af-card-bg)] shadow-[var(--af-shadow-sm)] ring-1 ring-[var(--af-card-ring)] transition after:pointer-events-none after:absolute after:inset-0 after:rounded-xl hover:shadow-[var(--af-shadow)]"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        alt={`عکس ${toFaDigits(id + 1)}`}
                        className="absolute inset-0 h-full w-full object-cover brightness-[0.88] transition duration-300 will-change-transform group-hover:scale-105 group-hover:brightness-110"
                        src={cardUrl(public_id, format)}
                        loading={index < 6 ? "eager" : "lazy"}
                        decoding="async"
                        fetchPriority={index < 4 ? "high" : "auto"}
                      />
                      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent opacity-0 transition duration-500 group-hover:opacity-100" />
                    </Link>
                  </motion.div>
                ))}
              </motion.div>
            </LayoutGroup>
          </>
        )}
      </main>
      <motion.footer
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        className="p-6 text-center text-[var(--af-muted)] sm:p-12"
      >
        برای افزودن عکس از دکمه «آپلود عکس» استفاده کنید.
      </motion.footer>
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
