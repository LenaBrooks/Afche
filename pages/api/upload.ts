import type { NextApiRequest, NextApiResponse } from "next";
import { IncomingForm, type File } from "formidable";
import cloudinary from "../../utils/cloudinary";

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

function parseForm(req: NextApiRequest): Promise<{ files: File[] }> {
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
      const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
      resolve({ files: list });
    });
  });
}

function cloudinaryErrorMessage(error: any): string {
  const detail =
    error?.error?.message ||
    error?.message ||
    (typeof error === "string" ? error : null) ||
    "آپلود ناموفق بود";

  if (
    error?.http_code === 403 ||
    String(detail).includes("missing permissions") ||
    String(detail).includes('actions=["create"]')
  ) {
    return "کلید API کلودینری مجوز آپلود ندارد. در پنل Cloudinary یک کلید با دسترسی Upload بسازید یا CLOUDINARY_UPLOAD_PRESET را تنظیم کنید.";
  }

  if (
    String(detail).includes("maxFileSize") ||
    error?.httpCode === 413 ||
    error?.http_code === 413
  ) {
    return "حجم فایل زیاد است (حداکثر ۱۰ مگابایت)";
  }

  return detail;
}

async function uploadToCloudinary(file: File) {
  const folder = process.env.CLOUDINARY_FOLDER || "afche";
  const preset = process.env.CLOUDINARY_UPLOAD_PRESET;
  const original =
    file.originalFilename?.replace(/[|=]/g, "_") || "photo";

  const options: Record<string, unknown> = {
    resource_type: "image",
    context: `original_filename=${original}`,
  };

  if (preset) {
    options.upload_preset = preset;
    options.folder = folder;
    options.tags = ["pending"];
  } else {
    options.folder = folder;
    options.tags = ["pending"];
  }

  const result = await cloudinary.uploader.upload(file.filepath, options);
  return {
    public_id: result.public_id,
    format: result.format,
  };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: "متد مجاز نیست" });
  }

  try {
    const { files } = await parseForm(req);
    const file = files[0];
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

    const result = await uploadToCloudinary(file);
    return res.status(200).json({
      ok: true,
      public_id: result.public_id,
      format: result.format,
      message: "آپلود شد. بعد از تأیید مدیر در گالری نمایش داده می‌شود.",
    });
  } catch (error: any) {
    const status = error?.http_code === 403 ? 403 : 400;
    return res.status(status).json({ error: cloudinaryErrorMessage(error) });
  }
}
