import cloudinary from "./cloudinary";
import { destroyPhoto } from "./photos";

export type PhotoAction = "approve" | "reject" | "hide" | "unhide" | "delete";

export const PHOTO_ACTIONS: PhotoAction[] = [
  "approve",
  "reject",
  "hide",
  "unhide",
  "delete",
];

export async function applyPhotoAction(
  publicId: string,
  action: PhotoAction,
) {
  if (action === "delete" || action === "reject") {
    await destroyPhoto(publicId);
    return;
  }

  if (action === "approve") {
    await cloudinary.uploader.remove_tag("pending", [publicId]);
    await cloudinary.uploader.remove_tag("rejected", [publicId]);
    await cloudinary.uploader.remove_tag("hidden", [publicId]);
    await cloudinary.uploader.add_tag("approved", [publicId]);
    await cloudinary.uploader.add_context(
      `approved_at=${new Date().toISOString()}`,
      [publicId],
    );
    return;
  }

  if (action === "hide") {
    await cloudinary.uploader.add_tag("hidden", [publicId]);
    return;
  }

  if (action === "unhide") {
    await cloudinary.uploader.remove_tag("hidden", [publicId]);
  }
}
