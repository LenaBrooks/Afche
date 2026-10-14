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

/** LRI … PDI — keep digit runs as one visual unit in RTL. */
const LRI = "\u2066";
const PDI = "\u2069";

function convertDigits(raw: string) {
  return raw
    .replace(/\d/g, (d) => FA_DIGITS[Number(d)])
    .replace(/\./g, "٫");
}

function isolateFaDigitRuns(text: string) {
  return text.replace(/[۰-۹٫٬]+/g, (run) => `${LRI}${run}${PDI}`);
}

/** Convert Latin digits in any value to Persian digits (RTL-safe). */
export function toFaDigits(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  return isolateFaDigitRuns(convertDigits(String(value)));
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
  return `${toFaDigits(jd)} ${FA_MONTHS[jm - 1]} ${toFaDigits(jy)}`;
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
