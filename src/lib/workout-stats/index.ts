import { WORKOUT_TYPES, type WorkoutType } from "@/lib/workout-types";

/**
 * Training statistics. Pure: no I/O and no clock. "Today" is always passed
 * in, so the same input gives the same numbers whenever it runs.
 *
 * All dates are ISO "YYYY-MM-DD" strings. Weeks start on Monday. Day
 * arithmetic happens in UTC so DST changes can't shift a date.
 */

/** The only workout fields stats need; a full `Workout` row fits. */
export type StatsWorkout = {
  date: string;
  type: WorkoutType;
  done: boolean;
};

export type TypeCounts = Record<WorkoutType, { planned: number; done: number }>;

export type Counts = {
  /** Every workout in the period, past or future. */
  planned: number;
  done: number;
  /** Not done and dated before `today`. Today and future workouts are never missed. */
  missed: number;
  byType: TypeCounts;
};

export type WeekBucket = Counts & {
  /** Monday, "YYYY-MM-DD". */
  start: string;
  /** Sunday, "YYYY-MM-DD". */
  end: string;
};

export type Totals = Counts & {
  /**
   * done / (done + missed): the share of workouts that were due and got done.
   * Workouts still ahead (today included, unless already done) don't count
   * against you. Null when nothing was due yet.
   */
  completionRate: number | null;
};

export type Streak = {
  /** Consecutive weeks with at least one done workout. */
  weeks: number;
  /** True when the streak reaches the first week of the range, so it may be longer. */
  reachesRangeStart: boolean;
};

export type WorkoutStats = {
  weeks: WeekBucket[];
  totals: Totals;
  streak: Streak;
};

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 24 * 60 * 60 * 1000;

function toUtc(iso: string): number {
  const m = iso.match(ISO_DATE);
  if (!m) throw new RangeError(`expected a "YYYY-MM-DD" date, got ${JSON.stringify(iso)}`);
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function fromUtc(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** Add `days` (may be negative) to an ISO date. */
export function addDaysIso(iso: string, days: number): string {
  return fromUtc(toUtc(iso) + days * DAY_MS);
}

/** Monday of the week containing `iso`. */
export function startOfWeekIso(iso: string): string {
  const ms = toUtc(iso);
  // getUTCDay: 0 = Sunday … 6 = Saturday. Shift so Monday = 0.
  const offset = (new Date(ms).getUTCDay() + 6) % 7;
  return fromUtc(ms - offset * DAY_MS);
}

/**
 * The last `count` Monday-start weeks ending with the week that contains
 * `today`: `from` is a Monday, `to` the Sunday of the current week.
 */
export function lastWeeksRange(today: string, count: number): { from: string; to: string } {
  if (!Number.isInteger(count) || count < 1) {
    throw new RangeError(`count must be a positive integer, got ${count}`);
  }
  const thisMonday = startOfWeekIso(today);
  return { from: addDaysIso(thisMonday, -7 * (count - 1)), to: addDaysIso(thisMonday, 6) };
}

function emptyByType(): TypeCounts {
  return Object.fromEntries(WORKOUT_TYPES.map((t) => [t, { planned: 0, done: 0 }])) as TypeCounts;
}

function emptyCounts(): Counts {
  return { planned: 0, done: 0, missed: 0, byType: emptyByType() };
}

function add(into: Counts, from: Counts): void {
  into.planned += from.planned;
  into.done += from.done;
  into.missed += from.missed;
  for (const t of WORKOUT_TYPES) {
    into.byType[t].planned += from.byType[t].planned;
    into.byType[t].done += from.byType[t].done;
  }
}

/** Sum a run of weeks (e.g. the last four) into totals with a completion rate. */
export function totalsOf(weeks: readonly Counts[]): Totals {
  const sum = emptyCounts();
  for (const w of weeks) add(sum, w);
  const due = sum.done + sum.missed;
  return { ...sum, completionRate: due === 0 ? null : sum.done / due };
}

function streakOf(weeks: readonly WeekBucket[], today: string): Streak {
  let i = weeks.length - 1;
  // Weeks that haven't started yet can't extend or break a streak.
  while (i >= 0 && weeks[i].start > today) i--;

  let count = 0;
  // The current week only adds to the streak once it has a done workout; an
  // empty current week doesn't break it (the week isn't over yet).
  if (i >= 0 && weeks[i].end >= today) {
    if (weeks[i].done > 0) count++;
    i--;
  }
  // Complete weeks, newest first, until one without a done workout.
  for (; i >= 0 && weeks[i].done > 0; i--) count++;

  return { weeks: count, reachesRangeStart: count > 0 && i < 0 };
}

/**
 * Bucket `workouts` into Monday-start weeks covering `from`…`to` (inclusive;
 * the first and last weeks are widened to full weeks). Workouts outside
 * those weeks are ignored.
 */
export function computeWorkoutStats(
  workouts: readonly StatsWorkout[],
  range: { from: string; to: string; today: string },
): WorkoutStats {
  const { today } = range;
  toUtc(today); // validate
  const first = startOfWeekIso(range.from);
  const last = startOfWeekIso(range.to);
  if (first > last) throw new RangeError(`from (${range.from}) is after to (${range.to})`);

  const weeks: WeekBucket[] = [];
  const index = new Map<string, WeekBucket>();
  for (let start = first; start <= last; start = addDaysIso(start, 7)) {
    const week: WeekBucket = { start, end: addDaysIso(start, 6), ...emptyCounts() };
    weeks.push(week);
    index.set(start, week);
  }

  for (const w of workouts) {
    const week = index.get(startOfWeekIso(w.date));
    if (!week) continue;
    week.planned++;
    week.byType[w.type].planned++;
    if (w.done) {
      week.done++;
      week.byType[w.type].done++;
    } else if (w.date < today) {
      week.missed++;
    }
  }

  return { weeks, totals: totalsOf(weeks), streak: streakOf(weeks, today) };
}
