/**
 * Centralized Date & Time Utilities
 *
 * Handles database timestamps consistently in UTC, parsing ISO strings and
 * PostgreSQL timestamptz / timestamp-without-time-zone values, and formatting
 * them into the user's browser local timezone.
 */

/**
 * Parses any timestamp value into a valid Date object.
 * If an ISO string lacks a timezone designator (e.g. "2026-09-29T14:18:02.519"),
 * it is treated as UTC as per database convention, preventing JavaScript from
 * incorrectly parsing it as local time.
 */
export function parseUtcDate(value: string | Date | number | null | undefined): Date | null {
  if (!value) return null;
  if (value instanceof Date) {
    return isNaN(value.getTime()) ? null : value;
  }
  if (typeof value === "number") {
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }

  const str = String(value).trim();
  if (!str) return null;

  let normalized = str;

  // Check if it's an ISO timestamp without timezone designator (no 'Z' and no +HH:MM / -HH:MM)
  // e.g. "2026-09-29T14:18:02.519" or "2026-09-29 14:18:02"
  if (/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(\.\d+)?$/.test(normalized)) {
    normalized = normalized.replace(" ", "T") + "Z";
  } else if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    // Plain date: treat as UTC midnight
    normalized = normalized + "T00:00:00Z";
  }

  const d = new Date(normalized);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Formats a timestamp into date and time in the user's local browser timezone.
 * Example output: "29 Sep 2026, 7:48 PM" (or user's locale equivalent)
 */
export function formatDateTime(
  timestamp: string | Date | number | null | undefined,
  fallbackOrOptions?: string | Intl.DateTimeFormatOptions,
  options?: Intl.DateTimeFormatOptions
): string {
  const fallback = typeof fallbackOrOptions === "string" ? fallbackOrOptions : "—";
  const opts = typeof fallbackOrOptions === "object" ? fallbackOrOptions : options;
  const date = parseUtcDate(timestamp);
  if (!date) return fallback;

  const defaultOptions: Intl.DateTimeFormatOptions = {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    ...opts
  };

  return new Intl.DateTimeFormat(undefined, defaultOptions).format(date);
}

/**
 * Formats a timestamp into date only in the user's local browser timezone.
 * Example output: "29 Sep 2026"
 */
export function formatDate(
  timestamp: string | Date | number | null | undefined,
  fallbackOrOptions?: string | Intl.DateTimeFormatOptions,
  options?: Intl.DateTimeFormatOptions
): string {
  const fallback = typeof fallbackOrOptions === "string" ? fallbackOrOptions : "—";
  const opts = typeof fallbackOrOptions === "object" ? fallbackOrOptions : options;
  const date = parseUtcDate(timestamp);
  if (!date) return fallback;

  const defaultOptions: Intl.DateTimeFormatOptions = {
    day: "numeric",
    month: "short",
    year: "numeric",
    ...opts
  };

  return new Intl.DateTimeFormat(undefined, defaultOptions).format(date);
}

/**
 * Formats a timestamp into time only in the user's local browser timezone.
 * Example output: "7:48 PM"
 */
export function formatTime(
  timestamp: string | Date | number | null | undefined,
  fallbackOrOptions?: string | Intl.DateTimeFormatOptions,
  options?: Intl.DateTimeFormatOptions
): string {
  const fallback = typeof fallbackOrOptions === "string" ? fallbackOrOptions : "—";
  const opts = typeof fallbackOrOptions === "object" ? fallbackOrOptions : options;
  const date = parseUtcDate(timestamp);
  if (!date) return fallback;

  const defaultOptions: Intl.DateTimeFormatOptions = {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    ...opts
  };

  return new Intl.DateTimeFormat(undefined, defaultOptions).format(date);
}
