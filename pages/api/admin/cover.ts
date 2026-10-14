import type { NextApiRequest, NextApiResponse } from "next";
import { IncomingForm, type File } from "formidable";
import { requireAdminApi } from "../../../utils/auth";
import cloudinary from "../../../utils/cloudinary";
import { thumbUrl } from "../../../utils/cloudinaryUrl";
import { photoDisplayName } from "../../../utils/fa";
import { bustPhotoCaches } from "../../../utils/photos";

export const config = {
  api: {
    bodyParser: false,
  },
};

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/jpg",
]);

function parseForm(req: NextApiRequest): Promise<File | null> {
  const form = new IncomingForm({
    maxFileSize: MAX_BYTES,
    multiples: false,
    keepExtensions: true,
  });

  return new Promise((resolve, reject) => {
    form.parse(req, (err, _fields, files) => {
      if (err) {
        reject(err);
        return;
      }
      const raw = files.file;
      const file = Array.isArray(raw) ? raw[0] : raw;
      resolve(file || null);
    });
  });
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (!requireAdminApi(req, res)) return;

  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: "متد مجاز نیست" });
  }

  try {
    const file = await parseForm(req);
    if (!file) {
      return res.status(400).json({ error: "فایلی انتخاب نشده است" });
    }

    const mime = file.mimetype || "";
    if (!ALLOWED_TYPES.has(mime)) {
      return res.status(400).json({
        error: "فقط فرمت‌های JPEG، PNG، WebP و GIF مجاز هستند",
      });
    }

    if (typeof file.size === "number" && file.size > MAX_BYTES) {
      return res
        .status(400)
        .json({ error: "حجم فایل زیاد است (حداکثر ۱۰ مگابایت)" });
    }

    const folder = process.env.CLOUDINARY_FOLDER || "afche";
    const original =
      file.originalFilename?.replace(/[|=]/g, "_") || "cover";
    const approvedAt = new Date().toISOString();

    const result = await cloudinary.uploader.upload(file.filepath, {
      resource_type: "image",
      folder,
      tags: ["approved"],
      context: `original_filename=${original}|approved_at=${approvedAt}`,
    });

    bustPhotoCaches();

    return res.status(200).json({
      ok: true,
      photo: {
        public_id: result.public_id,
        format: result.format,
        width: result.width,
        height: result.height,
        tags: ["approved"],
        status: "approved",
        created_at: result.created_at || null,
        approved_at: approvedAt,
        bytes: result.bytes ?? 0,
        filename: photoDisplayName(result.public_id, original),
        url: thumbUrl(result.public_id, result.format),
      },
    });
  } catch (error: any) {
    const detail =
      error?.error?.message || error?.message || "آپلود کاور ناموفق بود";
    const status = error?.http_code === 403 ? 403 : 400;
    return res.status(status).json({ error: detail });
  }
}
