import type { NextApiRequest, NextApiResponse } from "next";

/**
 * Public upload config for direct browser → Cloudinary uploads.
 * Preset must be unsigned in Cloudinary dashboard when used this way.
 */
export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ error: "متد مجاز نیست" });
  }

  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME?.trim();
  const preset = process.env.CLOUDINARY_UPLOAD_PRESET?.trim();
  const folder = process.env.CLOUDINARY_FOLDER || "afche";

  if (!cloudName) {
    return res.status(500).json({ error: "Cloudinary پیکربندی نشده است" });
  }

  res.setHeader("Cache-Control", "public, max-age=60");
  return res.status(200).json({
    cloudName,
    folder,
    uploadPreset: preset || null,
    direct: Boolean(preset),
  });
}
