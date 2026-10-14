import cloudinary from "./cloudinary";
import {
  getCachedList,
  invalidatePhotoListCache,
  setCachedList,
} from "./photoListCache";
import {
  DEFAULT_SITE_SETTINGS,
  normalizeSiteSettings,
  type SiteSettings,
} from "./siteSettingsShared";

export type { SiteSettings } from "./siteSettingsShared";
export { DEFAULT_SITE_SETTINGS } from "./siteSettingsShared";

function isCloudinaryConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME?.trim());
}

const CACHE_KEY = "site-settings";

function settingsPublicId() {
  const folder = process.env.CLOUDINARY_FOLDER?.trim() || "afche";
  return `${folder}/_site_settings`;
}

export async function getSiteSettings(): Promise<SiteSettings> {
  const cached = getCachedList<SiteSettings>(CACHE_KEY);
  if (cached) return cached;

  if (!isCloudinaryConfigured()) {
    return { ...DEFAULT_SITE_SETTINGS };
  }

  try {
    const resource = await cloudinary.api.resource(settingsPublicId(), {
      resource_type: "raw",
    });
    const url = `${resource.secure_url}?t=${resource.version || Date.now()}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`settings fetch ${res.status}`);
    const data = (await res.json()) as Partial<SiteSettings>;
    const settings = normalizeSiteSettings(data);
    setCachedList(CACHE_KEY, settings, 60_000);
    return settings;
  } catch {
    const fallback = { ...DEFAULT_SITE_SETTINGS };
    setCachedList(CACHE_KEY, fallback, 15_000);
    return fallback;
  }
}

export async function saveSiteSettings(
  patch: Partial<SiteSettings>,
): Promise<SiteSettings> {
  if (!isCloudinaryConfigured()) {
    throw new Error("Cloudinary پیکربندی نشده است");
  }

  invalidatePhotoListCache(CACHE_KEY);
  const current = await getSiteSettings();
  const next = normalizeSiteSettings({ ...current, ...patch });

  const payload = Buffer.from(JSON.stringify(next), "utf8").toString("base64");
  await cloudinary.uploader.upload(`data:application/json;base64,${payload}`, {
    public_id: settingsPublicId(),
    resource_type: "raw",
    overwrite: true,
    invalidate: true,
  });

  invalidatePhotoListCache(CACHE_KEY);
  setCachedList(CACHE_KEY, next, 60_000);
  return next;
}

export function invalidateSiteSettingsCache() {
  invalidatePhotoListCache(CACHE_KEY);
}
