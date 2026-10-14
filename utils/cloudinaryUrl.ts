/** Client-safe Cloudinary delivery URLs — no Node SDK. */

export type CloudinaryVersion = number | string | null | undefined;

function cloudName() {
  return process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || "";
}

function versionSegment(version: CloudinaryVersion) {
  if (version === null || version === undefined || version === "") return "";
  const n = String(version).replace(/^v/i, "");
  return n ? `v${n}/` : "";
}

/** Append fl_immutable_cache only for uniquely versioned URLs. */
function withImmutable(transform: string, version: CloudinaryVersion) {
  const hasVersion = Boolean(versionSegment(version));
  if (!hasVersion) return transform;
  if (/(^|,)fl_immutable_cache(,|$)/.test(transform)) return transform;
  return `${transform},fl_immutable_cache`;
}

/**
 * Derived delivery URL. Omits file extension so f_auto can negotiate WebP/AVIF.
 * With version → path includes v{n} and fl_immutable_cache (1y immutable CDN cache).
 */
export function cloudinaryUrl(
  publicId: string,
  format: string,
  transform = "c_fill,g_auto,w_720,h_480,f_auto,q_auto",
  version?: CloudinaryVersion,
) {
  void format; // kept for call-site compatibility; f_auto ignores forced extension
  const t = withImmutable(transform, version);
  const v = versionSegment(version);
  return `https://res.cloudinary.com/${cloudName()}/image/upload/${t}/${v}${publicId}`;
}

export function thumbUrl(
  publicId: string,
  format: string,
  version?: CloudinaryVersion,
) {
  return cloudinaryUrl(
    publicId,
    format,
    "c_fill,g_auto,w_240,h_160,f_auto,q_auto",
    version,
  );
}

export function cardUrl(
  publicId: string,
  format: string,
  version?: CloudinaryVersion,
) {
  return cloudinaryUrl(
    publicId,
    format,
    "c_fill,g_auto,w_720,h_480,f_auto,q_auto",
    version,
  );
}

/** Responsive srcset for gallery cards (3:2). */
export function cardSrcSet(
  publicId: string,
  format: string,
  version?: CloudinaryVersion,
) {
  const widths: [number, number][] = [
    [360, 240],
    [720, 480],
    [1080, 720],
  ];
  return widths
    .map(([w, h]) => {
      const url = cloudinaryUrl(
        publicId,
        format,
        `c_fill,g_auto,w_${w},h_${h},f_auto,q_auto`,
        version,
      );
      return `${url} ${w}w`;
    })
    .join(", ");
}

/** Full-bleed homepage hero cover. */
export function heroUrl(
  publicId: string,
  format: string,
  version?: CloudinaryVersion,
) {
  return cloudinaryUrl(
    publicId,
    format,
    "c_fill,g_auto,w_1920,h_1080,f_auto,q_auto",
    version,
  );
}

export function filmstripUrl(
  publicId: string,
  format: string,
  version?: CloudinaryVersion,
) {
  return cloudinaryUrl(
    publicId,
    format,
    "c_fill,g_auto,w_144,h_96,f_auto,q_auto",
    version,
  );
}

/** Full photo for lightbox — fit inside bounds, never crop orientation. */
export function lightboxUrl(
  publicId: string,
  format: string,
  wide = false,
  version?: CloudinaryVersion,
) {
  return cloudinaryUrl(
    publicId,
    format,
    wide
      ? "c_limit,w_2400,h_2400,f_auto,q_auto"
      : "c_limit,w_1600,h_1600,f_auto,q_auto",
    version,
  );
}

/** Original file for download/open — keeps format extension; versions when known. */
export function originalUrl(
  publicId: string,
  format: string,
  version?: CloudinaryVersion,
) {
  const v = versionSegment(version);
  const flags = v ? "fl_immutable_cache/" : "";
  const ext = format ? `.${format}` : "";
  return `https://res.cloudinary.com/${cloudName()}/image/upload/${flags}${v}${publicId}${ext}`;
}
