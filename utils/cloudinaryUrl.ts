/** Client-safe Cloudinary delivery URLs — no Node SDK. */

function cloudName() {
  return process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || "";
}

/** Crop/fill + auto format/quality for uniform, fast delivery. */
export function cloudinaryUrl(
  publicId: string,
  format: string,
  transform = "c_fill,g_auto,w_720,h_480,f_auto,q_auto",
) {
  return `https://res.cloudinary.com/${cloudName()}/image/upload/${transform}/${publicId}.${format}`;
}

export function thumbUrl(publicId: string, format: string) {
  return cloudinaryUrl(
    publicId,
    format,
    "c_fill,g_auto,w_240,h_160,f_auto,q_auto",
  );
}

export function cardUrl(publicId: string, format: string) {
  return cloudinaryUrl(
    publicId,
    format,
    "c_fill,g_auto,w_720,h_480,f_auto,q_auto",
  );
}

/** Full-bleed homepage hero cover. */
export function heroUrl(publicId: string, format: string) {
  return cloudinaryUrl(
    publicId,
    format,
    "c_fill,g_auto,w_1920,h_1080,f_auto,q_auto",
  );
}

export function filmstripUrl(publicId: string, format: string) {
  return cloudinaryUrl(
    publicId,
    format,
    "c_fill,g_auto,w_144,h_96,f_auto,q_auto",
  );
}

/** Full photo for lightbox — fit inside bounds, never crop orientation. */
export function lightboxUrl(
  publicId: string,
  format: string,
  wide = false,
) {
  return cloudinaryUrl(
    publicId,
    format,
    wide
      ? "c_limit,w_2400,h_2400,f_auto,q_auto"
      : "c_limit,w_1600,h_1600,f_auto,q_auto",
  );
}

export function originalUrl(publicId: string, format: string) {
  return `https://res.cloudinary.com/${cloudName()}/image/upload/${publicId}.${format}`;
}
