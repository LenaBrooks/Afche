import type { NextApiRequest, NextApiResponse } from "next";
import { getSiteSettings } from "../../utils/siteSettings";

/** Public read-only site settings (theme, title, cover). */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ error: "متد مجاز نیست" });
  }

  try {
    const settings = await getSiteSettings();
    res.setHeader(
      "Cache-Control",
      "public, s-maxage=60, stale-while-revalidate=300",
    );
    return res.status(200).json({
      settings: {
        title: settings.title,
        subtitle: settings.subtitle,
        theme: settings.theme,
        coverPublicId: settings.coverPublicId,
        coverFormat: settings.coverFormat,
        coverVersion: settings.coverVersion,
      },
    });
  } catch (error: any) {
    return res
      .status(500)
      .json({ error: error?.message || "بارگذاری تنظیمات ناموفق بود" });
  }
}
