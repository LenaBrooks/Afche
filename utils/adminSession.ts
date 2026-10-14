/** In-memory admin session cache — avoids waiting on SSR between admin pages. */

let cached: boolean | null = null;
let inflight: Promise<boolean> | null = null;

export function getAdminSessionCache(): boolean | null {
  return cached;
}

export function markAdminAuthed() {
  cached = true;
}

export function clearAdminAuthed() {
  cached = false;
  inflight = null;
}

export async function ensureAdminSession(): Promise<boolean> {
  if (cached === true) {
    // Soft revalidate in background; trust cache for instant UI.
    void revalidateAdminSession();
    return true;
  }
  if (cached === false) return false;
  return revalidateAdminSession();
}

async function revalidateAdminSession(): Promise<boolean> {
  if (inflight) return inflight;
  inflight = fetch("/api/auth/session", {
    credentials: "same-origin",
    cache: "no-store",
  })
    .then((res) => res.ok)
    .then((ok) => {
      cached = ok;
      return ok;
    })
    .catch(() => {
      cached = false;
      return false;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

export const ADMIN_PREFETCH_ROUTES = [
  "/admin",
  "/admin/settings",
  "/admin/upload",
  "/admin/login",
] as const;
