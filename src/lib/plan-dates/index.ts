/**
 * Date math for applying a plan template to the calendar. Pure: no I/O and
 * no clock.
 *
 * All dates are ISO "YYYY-MM-DD" strings. Plans start on a Monday; a plan
 * day at (weekIndex, dayOfWeek) lands on `start + weekIndex * 7 + dayOfWeek`
 * (dayOfWeek 0 = Monday … 6 = Sunday). Arithmetic happens in UTC so DST
 * changes can't shift a date.
 */

/** Longest plan allowed, in weeks. */
export const PLAN_MAX_WEEKS = 26;

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 24 * 60 * 60 * 1000;

function parseIso(iso: string): number | null {
  const m = ISO_DATE.exec(iso);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const ms = Date.UTC(y, mo - 1, d);
  const back = new Date(ms);
  // Reject roll-overs such as 2032-02-30.
  if (back.getUTCFullYear() !== y || back.getUTCMonth() !== mo - 1 || back.getUTCDate() !== d) {
    return null;
  }
  return ms;
}

function toUtc(iso: string): number {
  const ms = parseIso(iso);
  if (ms === null) throw new RangeError(`expected a "YYYY-MM-DD" date, got ${JSON.stringify(iso)}`);
  return ms;
}

function fromUtc(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** True for a real calendar date in "YYYY-MM-DD" form. */
export function isIsoDate(value: string): boolean {
  return parseIso(value) !== null;
}

/** Add `days` (may be negative) to an ISO date. */
export function addDays(iso: string, days: number): string {
  return fromUtc(toUtc(iso) + days * DAY_MS);
}

/** 0 = Monday … 6 = Sunday. */
export function dayOfWeekOf(iso: string): number {
  return (new Date(toUtc(iso)).getUTCDay() + 6) % 7;
}

export function isMonday(iso: string): boolean {
  return isIsoDate(iso) && dayOfWeekOf(iso) === 0;
}

/** The Monday of the week containing `iso` (itself if it is a Monday). */
export function snapToMonday(iso: string): string {
  return addDays(iso, -dayOfWeekOf(iso));
}

/** The first Monday on or after `iso`. A sensible default start date. */
export function nextMondayOnOrAfter(iso: string): string {
  const dow = dayOfWeekOf(iso);
  return dow === 0 ? iso : addDays(iso, 7 - dow);
}

/** Throws unless `iso` is a valid date that falls on a Monday. */
export function assertMonday(iso: string): void {
  if (!isMonday(iso)) {
    throw new RangeError(`plan start must be a Monday, got ${JSON.stringify(iso)}`);
  }
}

/** Calendar date of a plan day for a plan starting on `startMonday`. */
export function planDayDate(startMonday: string, weekIndex: number, dayOfWeek: number): string {
  assertMonday(startMonday);
  if (!Number.isInteger(weekIndex) || weekIndex < 0) {
    throw new RangeError(`weekIndex must be a non-negative integer, got ${weekIndex}`);
  }
  if (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
    throw new RangeError(`dayOfWeek must be 0–6, got ${dayOfWeek}`);
  }
  return addDays(startMonday, weekIndex * 7 + dayOfWeek);
}

/** First (Monday) and last (Sunday) date covered by a `weeks`-long plan. */
export function planDateRange(startMonday: string, weeks: number): { from: string; to: string } {
  assertMonday(startMonday);
  if (!Number.isInteger(weeks) || weeks < 1) {
    throw new RangeError(`weeks must be a positive integer, got ${weeks}`);
  }
  return { from: startMonday, to: addDays(startMonday, weeks * 7 - 1) };
}

/** "YYYY-MM" of a date, for linking to `/app?month=`. */
export function monthOf(iso: string): string {
  toUtc(iso);
  return iso.slice(0, 7);
}
