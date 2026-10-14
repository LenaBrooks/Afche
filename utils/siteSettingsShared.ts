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

export const THEME_STORAGE_KEY = "af-theme";

export function isSiteTheme(value: unknown): value is SiteTheme {
  return value === "dark" || value === "light";
}

export function applySiteTheme(theme: SiteTheme) {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-theme", theme);
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    /* ignore */
  }
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
