import type { NextApiRequest, NextApiResponse } from "next";
import { IncomingForm, type File } from "formidable";
import { requireAdminApi } from "../../../utils/auth";
import cloudinary from "../../../utils/cloudinary";
import { thumbUrl } from "../../../utils/cloudinaryUrl";
import { photoDisplayName } from "../../../utils/fa";
import { bustPhotoCaches } from "../../../utils/photos";
import type { AdminPhoto } from "../../../utils/adminCache";

export const config = {
  api: {
    bodyParser: false,
  },
};

const MAX_BYTES = 10 * 1024 * 1024;
const MAX_FILES = 30;
const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/jpg",
]);

function parseForm(req: NextApiRequest): Promise<File[]> {
  const form = new IncomingForm({
    maxFileSize: MAX_BYTES,
    multiples: true,
    keepExtensions: true,
  });

  return new Promise((resolve, reject) => {
    form.parse(req, (err, _fields, files) => {
      if (err) {
        reject(err);
        return;
      }
      const raw = files.file;
      if (!raw) {
        resolve([]);
        return;
      }
      resolve(Array.isArray(raw) ? raw : [raw]);
    });
  });
}

async function uploadOne(file: File): Promise<AdminPhoto> {
  const mime = file.mimetype || "";
  if (!ALLOWED_TYPES.has(mime)) {
    throw new Error("فقط فرمت‌های JPEG، PNG، WebP و GIF مجاز هستند");
  }
  if (typeof file.size === "number" && file.size > MAX_BYTES) {
    throw new Error("حجم فایل زیاد است (حداکثر ۱۰ مگابایت)");
  }

  const folder = process.env.CLOUDINARY_FOLDER || "afche";
  const original =
    file.originalFilename?.replace(/[|=]/g, "_") || "photo";
  const approvedAt = new Date().toISOString();

  const result = await cloudinary.uploader.upload(file.filepath, {
    resource_type: "image",
    folder,
    tags: ["approved"],
    context: `original_filename=${original}|approved_at=${approvedAt}`,
  });

  return {
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
  };
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
    const files = await parseForm(req);
    if (files.length === 0) {
      return res.status(400).json({ error: "فایلی انتخاب نشده است" });
    }
    if (files.length > MAX_FILES) {
      return res
        .status(400)
        .json({ error: `حداکثر ${MAX_FILES} فایل در هر بار مجاز است` });
    }

    const results = await Promise.allSettled(files.map((f) => uploadOne(f)));
    const photos = results
      .filter((r): r is PromiseFulfilledResult<AdminPhoto> => r.status === "fulfilled")
      .map((r) => r.value);
    const failed = results.length - photos.length;

    if (photos.length > 0) bustPhotoCaches();

    if (photos.length === 0) {
      const firstErr = results.find((r) => r.status === "rejected") as
        | PromiseRejectedResult
        | undefined;
      return res.status(400).json({
        error:
          (firstErr?.reason as Error)?.message || "آپلود ناموفق بود",
      });
    }

    try {
      await res.revalidate("/");
    } catch {
      /* ignore */
    }

    return res.status(200).json({
      ok: true,
      photos,
      processed: photos.length,
      failed,
    });
  } catch (error: any) {
    const detail =
      error?.error?.message || error?.message || "آپلود ناموفق بود";
    const status = error?.http_code === 403 ? 403 : 400;
    return res.status(status).json({ error: detail });
  }
}
