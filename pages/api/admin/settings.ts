import type { NextApiRequest, NextApiResponse } from "next";
import { requireAdminApi } from "../../../utils/auth";
import {
  DEFAULT_SITE_SETTINGS,
  getSiteSettings,
  saveSiteSettings,
  type SiteSettings,
} from "../../../utils/siteSettings";
import { isSiteTheme } from "../../../utils/siteSettingsShared";

function parseBody(body: unknown): Partial<SiteSettings> {
  if (!body || typeof body !== "object") return {};
  const raw = body as Record<string, unknown>;
  const patch: Partial<SiteSettings> = {};

  if ("title" in raw) {
    patch.title =
      typeof raw.title === "string" ? raw.title : DEFAULT_SITE_SETTINGS.title;
  }
  if ("subtitle" in raw) {
    patch.subtitle =
      typeof raw.subtitle === "string"
        ? raw.subtitle
        : DEFAULT_SITE_SETTINGS.subtitle;
  }
  if ("theme" in raw) {
    patch.theme = isSiteTheme(raw.theme)
      ? raw.theme
      : DEFAULT_SITE_SETTINGS.theme;
  }
  if ("coverPublicId" in raw) {
    patch.coverPublicId =
      typeof raw.coverPublicId === "string" && raw.coverPublicId.trim()
        ? raw.coverPublicId.trim()
        : null;
  }
  if ("coverFormat" in raw) {
    patch.coverFormat =
      typeof raw.coverFormat === "string" && raw.coverFormat.trim()
        ? raw.coverFormat.trim()
        : null;
  }

  return patch;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (!requireAdminApi(req, res)) return;

  if (req.method === "GET") {
    try {
      const settings = await getSiteSettings();
      return res.status(200).json({ settings });
    } catch (error: any) {
      return res
        .status(500)
        .json({ error: error?.message || "بارگذاری تنظیمات ناموفق بود" });
    }
  }

  if (req.method === "PUT" || req.method === "POST") {
    try {
      const settings = await saveSiteSettings(parseBody(req.body));
      try {
        await res.revalidate("/");
      } catch {
        /* build may not support revalidate in all contexts */
      }
      return res.status(200).json({ settings });
    } catch (error: any) {
      return res
        .status(500)
        .json({ error: error?.message || "ذخیره تنظیمات ناموفق بود" });
    }
  }

  res.setHeader("Allow", ["GET", "PUT", "POST"]);
  return res.status(405).json({ error: "متد مجاز نیست" });
}
