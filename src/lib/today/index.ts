/**
 * "Today" as a calendar date in the user's timezone. The server runs in UTC,
 * so using its clock directly highlights the wrong day around midnight for
 * anyone east or west of Greenwich. The browser reports its IANA timezone in
 * a cookie (see TimeZoneSync) and server pages compute today with it.
 *
 * Pure: no cookies, no Next imports, so it's unit-testable and client-safe.
 */

export const TZ_COOKIE = "tz";
export const DEFAULT_TIME_ZONE = "UTC";

export function isValidTimeZone(tz: unknown): tz is string {
  if (typeof tz !== "string" || tz.length === 0 || tz.length > 64) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** "YYYY-MM-DD" for `now` as seen in `timeZone` (falls back to UTC if invalid). */
export function todayIn(timeZone: string, now: Date = new Date()): string {
  const tz = isValidTimeZone(timeZone) ? timeZone : DEFAULT_TIME_ZONE;
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
