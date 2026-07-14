import { format as formatJalaliBase } from "date-fns-jalali";
import { format as formatGregBase } from "date-fns";
import { siteConfig } from "@/lib/site-config";

/**
 * Date helpers. All dates are stored in UTC; the default display timezone is
 * Europe/Istanbul (per site config). Both Jalali (شمسی) and Gregorian (میلادی)
 * formats are available for the UI.
 */

/** Convert Persian/Arabic-friendly digits for display. */
export function toPersianDigits(input: string | number): string {
  const digits = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];
  return String(input).replace(/[0-9]/g, (d) => digits[Number(d)]);
}

/** Format a date as Jalali (e.g. "۲۳ تیر ۱۴۰۵"). */
export function formatJalali(date: Date, pattern = "d MMMM yyyy"): string {
  return toPersianDigits(formatJalaliBase(date, pattern));
}

/** Format a date as Gregorian (e.g. "2026-07-14"). */
export function formatGregorian(date: Date, pattern = "yyyy-MM-dd"): string {
  return formatGregBase(date, pattern);
}

/** ISO string for <time datetime> and machine-readable metadata. */
export function toIso(date: Date): string {
  return date.toISOString();
}

export const DISPLAY_TIME_ZONE = siteConfig.timeZone;
