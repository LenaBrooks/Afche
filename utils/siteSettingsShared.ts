/** Client-safe site settings types/defaults — no Cloudinary SDK. */

export type SiteTheme = "dark" | "light";

export type SiteSettings = {
  title: string;
  subtitle: string;
  theme: SiteTheme;
  coverPublicId: string | null;
  coverFormat: string | null;
  /** Cloudinary version of the cover asset for cache-busted delivery. */
  coverVersion: number | null;
};

export const DEFAULT_SITE_SETTINGS: SiteSettings = {
  title: "گالری عکس",
  subtitle:
    "عکس‌های تأییدشده را ببینید یا تصویر خودتان را برای بررسی ارسال کنید.",
  theme: "dark",
  coverPublicId: null,
  coverFormat: null,
  coverVersion: null,
};

/** Admin-panel theme only (public gallery always stays dark). */
export const ADMIN_THEME_STORAGE_KEY = "af-admin-theme";
/** @deprecated legacy key — read once for migration */
export const THEME_STORAGE_KEY = "af-theme";

export function isSiteTheme(value: unknown): value is SiteTheme {
  return value === "dark" || value === "light";
}

export function readAdminTheme(): SiteTheme {
  if (typeof window === "undefined") return "dark";
  try {
    const stored =
      localStorage.getItem(ADMIN_THEME_STORAGE_KEY) ||
      localStorage.getItem(THEME_STORAGE_KEY);
    if (isSiteTheme(stored)) return stored;
  } catch {
    /* ignore */
  }
  return "dark";
}

/** Apply theme for admin routes and persist preference. */
export function applyAdminTheme(theme: SiteTheme) {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-theme", theme);
  try {
    localStorage.setItem(ADMIN_THEME_STORAGE_KEY, theme);
  } catch {
    /* ignore */
  }
}

/** Public site is always dark — does not touch admin preference. */
export function applyPublicTheme() {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-theme", "dark");
}

/** @deprecated use applyAdminTheme / applyPublicTheme */
export function applySiteTheme(theme: SiteTheme) {
  applyAdminTheme(theme);
}

export function normalizeSiteSettings(
  raw: Partial<SiteSettings> | null | undefined,
): SiteSettings {
  const title =
    typeof raw?.title === "string" && raw.title.trim()
      ? raw.title.trim()
      : DEFAULT_SITE_SETTINGS.title;
  const subtitle =
    typeof raw?.subtitle === "string" && raw.subtitle.trim()
      ? raw.subtitle.trim()
      : DEFAULT_SITE_SETTINGS.subtitle;
  const theme = isSiteTheme(raw?.theme) ? raw.theme : DEFAULT_SITE_SETTINGS.theme;
  const coverPublicId =
    typeof raw?.coverPublicId === "string" && raw.coverPublicId.trim()
      ? raw.coverPublicId.trim()
      : null;
  const coverFormat =
    typeof raw?.coverFormat === "string" && raw.coverFormat.trim()
      ? raw.coverFormat.trim()
      : null;
  const coverVersionRaw = raw?.coverVersion as unknown;
  const coverVersion =
    typeof coverVersionRaw === "number" && Number.isFinite(coverVersionRaw)
      ? coverVersionRaw
      : typeof coverVersionRaw === "string" &&
          coverVersionRaw.trim() &&
          Number.isFinite(Number(coverVersionRaw))
        ? Number(coverVersionRaw)
        : null;

  return {
    title,
    subtitle,
    theme,
    coverPublicId,
    coverFormat: coverPublicId ? coverFormat || "jpg" : null,
    coverVersion: coverPublicId ? coverVersion : null,
  };
}
