/**
 * Which plan workouts to add when a plan is applied to the calendar, and
 * which to skip because they are already there. Pure: no I/O and no clock.
 *
 * A planned workout matches an existing workout on the same date with the
 * same type. Matching is count-based: each existing workout can absorb at
 * most one planned workout, so two planned runs on a day that already has
 * one run add one run and skip one. Workouts of other types never block.
 */
import type { WorkoutType } from "@/lib/workout-types";

export type DatedWorkout = { date: string; type: WorkoutType };

export type PlanApplyMatch<P extends DatedWorkout> = {
  /** Planned workouts to insert, in their original order. */
  toInsert: P[];
  /** Planned workouts skipped because a matching workout already exists. */
  skipped: P[];
  /** Existing workouts inside the range that no planned workout matched. */
  untouched: number;
};

const keyOf = (w: DatedWorkout) => `${w.date}|${w.type}`;

/**
 * Split `planned` into workouts to insert and workouts to skip, given the
 * user's `existing` workouts. Only existing workouts within `range`
 * (inclusive "YYYY-MM-DD" bounds) are considered; the rest are ignored.
 */
export function matchPlanToCalendar<P extends DatedWorkout>(
  planned: readonly P[],
  existing: readonly DatedWorkout[],
  range: { from: string; to: string },
): PlanApplyMatch<P> {
  const available = new Map<string, number>();
  let inRange = 0;
  for (const w of existing) {
    if (w.date < range.from || w.date > range.to) continue;
    inRange++;
    const key = keyOf(w);
    available.set(key, (available.get(key) ?? 0) + 1);
  }

  const toInsert: P[] = [];
  const skipped: P[] = [];
  for (const p of planned) {
    const key = keyOf(p);
    const left = available.get(key) ?? 0;
    if (left > 0) {
      available.set(key, left - 1);
      skipped.push(p);
    } else {
      toInsert.push(p);
    }
  }

  return { toInsert, skipped, untouched: inRange - skipped.length };
}
