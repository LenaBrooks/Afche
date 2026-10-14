import { toJalaali } from "jalaali-js";

const FA_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
const FA_MONTHS = [
  "فروردین",
  "اردیبهشت",
  "خرداد",
  "تیر",
  "مرداد",
  "شهریور",
  "مهر",
  "آبان",
  "آذر",
  "دی",
  "بهمن",
  "اسفند",
];

/** Convert Latin digits in any value to Persian digits. */
export function toFaDigits(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  return String(value).replace(/\d/g, (d) => FA_DIGITS[Number(d)]);
}

/** ISO / Date → «۲۲ مهر ۱۴۰۳» with Persian digits. */
export function formatJalaliDate(
  value: string | Date | null | undefined,
): string {
  if (!value) return "";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "";
  const { jy, jm, jd } = toJalaali(
    date.getFullYear(),
    date.getMonth() + 1,
    date.getDate(),
  );
  return toFaDigits(`${jd} ${FA_MONTHS[jm - 1]} ${jy}`);
}

/** Bytes → human size with Persian digits. */
export function formatFileSize(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined || Number.isNaN(bytes)) return "—";
  if (bytes < 1024) return `${toFaDigits(bytes)} بایت`;
  if (bytes < 1024 * 1024) {
    return `${toFaDigits((bytes / 1024).toFixed(1))} کیلوبایت`;
  }
  return `${toFaDigits((bytes / (1024 * 1024)).toFixed(2))} مگابایت`;
}

export function photoDisplayName(
  publicId: string,
  originalFilename?: string | null,
): string {
  if (originalFilename?.trim()) return originalFilename.trim();
  const base = publicId.split("/").pop() || publicId;
  return base;
}
