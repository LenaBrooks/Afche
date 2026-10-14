import cloudinary from "./cloudinary";
import { thumbUrl } from "./cloudinaryUrl";
import { photoDisplayName } from "./fa";
import {
  getCachedList,
  invalidatePhotoListCache,
  setCachedList,
} from "./photoListCache";
import type { ImageProps } from "./types";

export type PhotoStatus = "pending" | "approved" | "hidden" | "rejected" | "all";

export type CloudinaryResource = {
  public_id: string;
  format: string;
  height: number;
  width: number;
  bytes?: number;
  tags?: string[];
  created_at?: string;
  filename?: string;
  secure_url?: string;
  context?: {
    custom?: Record<string, string>;
  } & Record<string, string>;
};

/** Lightweight SVG placeholder — avoids sharp fetch on every SSR request. */
export const BLUR_PLACEHOLDER =
  "data:image/svg+xml;charset=utf-8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="10"><rect width="100%" height="100%" fill="#1a1a1a"/></svg>`,
  );

export function isCloudinaryConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME?.trim());
}

function folderExpression() {
  return `folder:${process.env.CLOUDINARY_FOLDER}/*`;
}

export function publicGalleryExpression() {
  return `${folderExpression()} AND tags=approved AND -tags=hidden`;
}

export function adminStatusExpression(status: PhotoStatus) {
  const base = folderExpression();
  switch (status) {
    case "pending":
      return `${base} AND tags=pending`;
    case "approved":
      return `${base} AND tags=approved AND -tags=hidden`;
    case "hidden":
      return `${base} AND tags=hidden`;
    case "rejected":
      return `${base} AND tags=rejected`;
    case "all":
    default:
      return base;
  }
}

function readContext(resource: CloudinaryResource) {
  const raw = resource.context || {};
  const custom = raw.custom || raw;
  return {
    approved_at: custom.approved_at || null,
    original_filename: custom.original_filename || null,
  };
}

export async function searchPhotos(
  expression: string,
  sortField: "created_at" | "public_id" = "created_at",
) {
  if (!isCloudinaryConfigured()) {
    console.warn(
      "NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME is missing; returning empty photo list.",
    );
    return [] as CloudinaryResource[];
  }

  const cacheKey = `search:${expression}:${sortField}`;
  const cached = getCachedList<CloudinaryResource[]>(cacheKey);
  if (cached) return cached;

  const result = await cloudinary.search
    .expression(expression)
    .with_field("tags")
    .with_field("context")
    .sort_by(sortField, "desc")
    .max_results(400)
    .execute();

  const resources = (result.resources || []) as CloudinaryResource[];
  setCachedList(cacheKey, resources);
  return resources;
}

export function bustPhotoCaches() {
  invalidatePhotoListCache();
}

export async function getPublicGalleryImages(): Promise<ImageProps[]> {
  const resources = await searchPhotos(publicGalleryExpression(), "created_at");
  return resources.map((result, index) => {
    const ctx = readContext(result);
    return {
      id: index,
      height: result.height,
      width: result.width,
      public_id: result.public_id,
      format: result.format,
      blurDataUrl: BLUR_PLACEHOLDER,
      created_at: ctx.approved_at || result.created_at || null,
      bytes: result.bytes ?? null,
      filename: photoDisplayName(result.public_id, ctx.original_filename),
    };
  });
}

export function resourceToAdminPhoto(resource: CloudinaryResource) {
  const tags = resource.tags || [];
  let status: Exclude<PhotoStatus, "all"> = "pending";
  if (tags.includes("rejected")) status = "rejected";
  else if (tags.includes("hidden")) status = "hidden";
  else if (tags.includes("approved")) status = "approved";
  else if (tags.includes("pending")) status = "pending";

  const ctx = readContext(resource);

  return {
    public_id: resource.public_id,
    format: resource.format,
    width: resource.width,
    height: resource.height,
    tags,
    status,
    created_at: resource.created_at || null,
    approved_at: ctx.approved_at,
    bytes: resource.bytes ?? 0,
    filename: photoDisplayName(resource.public_id, ctx.original_filename),
    url: thumbUrl(resource.public_id, resource.format),
  };
}

export async function destroyPhoto(publicId: string) {
  const result = await cloudinary.uploader.destroy(publicId, {
    resource_type: "image",
    invalidate: true,
  });
  // Already gone is fine (idempotent); anything else is a real failure.
  if (result?.result === "ok" || result?.result === "not found") return;
  throw new Error(
    typeof result?.result === "string"
      ? `حذف از Cloudinary ناموفق بود: ${result.result}`
      : "حذف از Cloudinary ناموفق بود",
  );
}
