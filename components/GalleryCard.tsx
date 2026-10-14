import Link from "next/link";
import { useLayoutEffect, useRef, useState } from "react";
import { cardSrcSet, cardUrl } from "../utils/cloudinaryUrl";
import { toFaDigits } from "../utils/fa";

type Props = {
  id: number;
  publicId: string;
  format: string;
  version?: number;
  sizes?: string;
  priority?: boolean;
  lastViewedRef?: React.Ref<HTMLAnchorElement> | null;
};

export default function GalleryCard({
  id,
  publicId,
  format,
  version,
  sizes = "(max-width: 640px) 50vw, (max-width: 1280px) 33vw, 25vw",
  priority,
  lastViewedRef,
}: Props) {
  const imgRef = useRef<HTMLImageElement>(null);
  const timeoutRef = useRef<number | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  function clearLoadTimeout() {
    if (timeoutRef.current != null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }

  function markLoaded() {
    clearLoadTimeout();
    setFailed(false);
    setLoaded(true);
  }

  function markFailed() {
    clearLoadTimeout();
    setFailed(true);
    setLoaded(true);
  }

  // Cached images often fire load before React attaches onLoad — sync from complete.
  useLayoutEffect(() => {
    setLoaded(false);
    setFailed(false);
    clearLoadTimeout();

    const img = imgRef.current;
    if (!img) return;

    if (img.complete) {
      if (img.naturalWidth > 0) markLoaded();
      else markFailed();
      return;
    }

    timeoutRef.current = window.setTimeout(markFailed, 15_000);
    return clearLoadTimeout;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [publicId, format, version, sizes]);

  return (
    <Link
      href={`/?photoId=${id}`}
      as={`/p/${id}`}
      ref={lastViewedRef || undefined}
      shallow
      className="after:content group relative block aspect-[3/2] w-full cursor-zoom-in overflow-hidden rounded-xl bg-[var(--af-card-bg)] shadow-[var(--af-shadow-sm)] ring-1 ring-[var(--af-card-ring)] transition after:pointer-events-none after:absolute after:inset-0 after:rounded-xl hover:shadow-[var(--af-shadow)]"
    >
      {!loaded && !failed && (
        <span className="absolute inset-0 z-[1] flex items-center justify-center bg-[var(--af-surface-2)]">
          <span className="h-7 w-7 animate-spin rounded-full border-2 border-[var(--af-accent)]/30 border-t-[var(--af-accent)]" />
        </span>
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={imgRef}
        alt={`عکس ${toFaDigits(id + 1)}`}
        className={`absolute inset-0 h-full w-full object-cover brightness-[0.88] transition duration-500 will-change-transform group-hover:scale-105 group-hover:brightness-110 ${
          loaded && !failed ? "opacity-100" : "opacity-0"
        }`}
        src={cardUrl(publicId, format, version)}
        srcSet={cardSrcSet(publicId, format, version)}
        sizes={sizes}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        fetchPriority={priority ? "high" : "auto"}
        onLoad={markLoaded}
        onError={markFailed}
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent opacity-0 transition duration-500 group-hover:opacity-100" />
    </Link>
  );
}
