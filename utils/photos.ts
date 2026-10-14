import cloudinary from "./cloudinary";
import { photoDisplayName } from "./fa";
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
  const result = await cloudinary.search
    .expression(expression)
    .with_field("tags")
    .with_field("context")
    .sort_by(sortField, "desc")
    .max_results(400)
    .execute();

  return (result.resources || []) as CloudinaryResource[];
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
    url: cloudinaryUrl(
      resource.public_id,
      resource.format,
      "c_fill,g_auto,w_720,h_480,f_auto,q_auto",
    ),
  };
}

export async function destroyPhoto(publicId: string) {
  await cloudinary.uploader.destroy(publicId, { invalidate: true });
}

/** Crop/fill + auto format/quality for uniform, fast delivery. */
export function cloudinaryUrl(
  publicId: string,
  format: string,
  transform = "c_fill,g_auto,w_720,h_480,f_auto,q_auto",
) {
  return `https://res.cloudinary.com/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/image/upload/${transform}/${publicId}.${format}`;
}
