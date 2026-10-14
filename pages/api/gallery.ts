import type { NextApiRequest, NextApiResponse } from "next";
import { getPublicGalleryImages } from "../../utils/photos";
import { getSiteSettings } from "../../utils/siteSettings";

/** Fresh public gallery — bypasses ISR page cache. */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ error: "متد مجاز نیست" });
  }

  try {
    const [images, settings] = await Promise.all([
      getPublicGalleryImages(),
      getSiteSettings(),
    ]);
    res.setHeader(
      "Cache-Control",
      "no-store, no-cache, must-revalidate, max-age=0",
    );
    return res.status(200).json({ images, settings });
  } catch (error: any) {
    return res
      .status(500)
      .json({ error: error?.message || "بارگذاری گالری ناموفق بود" });
  }
}
