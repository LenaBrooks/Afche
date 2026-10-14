const STALE_KEY = "af-gallery-stale";

/** Call after admin publish/upload/delete so homepage refetches. */
export function markGalleryStale() {
  try {
    localStorage.setItem(STALE_KEY, String(Date.now()));
  } catch {
    /* ignore */
  }
}

export function isGalleryStale(maxAgeMs = 1000 * 60 * 30) {
  try {
    const raw = localStorage.getItem(STALE_KEY);
    if (!raw) return false;
    const t = Number(raw);
    if (!Number.isFinite(t)) return true;
    return Date.now() - t < maxAgeMs;
  } catch {
    return false;
  }
}

export function clearGalleryStale() {
  try {
    localStorage.removeItem(STALE_KEY);
  } catch {
    /* ignore */
  }
}

/** Bust ISR + mark client stale. */
export async function notifyGalleryUpdated() {
  markGalleryStale();
  try {
    await fetch("/api/revalidate", { method: "POST" });
  } catch {
    /* revalidate may fail in dev — client fetch still works */
  }
}
