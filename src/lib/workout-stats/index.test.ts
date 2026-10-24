import { describe, expect, it } from "vitest";
import type { WorkoutType } from "@/lib/workout-types";
import {
  addDaysIso,
  computeWorkoutStats,
  lastWeeksRange,
  startOfWeekIso,
  totalsOf,
  type StatsWorkout,
} from "./index";

const w = (date: string, done = false, type: WorkoutType = "run"): StatsWorkout => ({
  date,
  type,
  done,
});

// 2026-10-21 is a Wednesday; its week is Mon 19 – Sun 25 Oct.
const TODAY = "2026-10-21";

describe("date helpers", () => {
  it("finds the Monday of a week, across month and year boundaries", () => {
    expect(startOfWeekIso("2026-10-19")).toBe("2026-10-19"); // Monday
    expect(startOfWeekIso("2026-10-25")).toBe("2026-10-19"); // Sunday
    expect(startOfWeekIso("2026-11-01")).toBe("2026-10-26"); // Sunday → previous month
    expect(startOfWeekIso("2027-01-01")).toBe("2026-12-28"); // Friday → previous year
  });

  it("adds days across a DST change without drifting", () => {
    // Europe moves clocks back on 2026-10-25.
    expect(addDaysIso("2026-10-24", 2)).toBe("2026-10-26");
    expect(addDaysIso("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("builds the last N weeks ending with the current week", () => {
    expect(lastWeeksRange(TODAY, 12)).toEqual({ from: "2026-08-03", to: "2026-10-25" });
    expect(lastWeeksRange("2026-10-19", 1)).toEqual({ from: "2026-10-19", to: "2026-10-25" });
    expect(() => lastWeeksRange(TODAY, 0)).toThrow(RangeError);
  });
});

describe("computeWorkoutStats", () => {
  it("returns empty buckets and null completion for no workouts", () => {
    const stats = computeWorkoutStats([], { ...lastWeeksRange(TODAY, 12), today: TODAY });
    expect(stats.weeks).toHaveLength(12);
    expect(stats.weeks.every((wk) => wk.planned === 0 && wk.done === 0)).toBe(true);
    expect(stats.totals).toMatchObject({ planned: 0, done: 0, missed: 0, completionRate: null });
    expect(stats.totals.byType.run).toEqual({ planned: 0, done: 0 });
    expect(stats.streak).toEqual({ weeks: 0, reachesRangeStart: false });
  });

  it("buckets into Monday-start weeks across a month boundary", () => {
    const stats = computeWorkoutStats(
      [w("2026-09-27", true), w("2026-09-28"), w("2026-09-30", true, "gym"), w("2026-10-04")],
      { from: "2026-09-21", to: "2026-10-04", today: TODAY },
    );
    expect(stats.weeks.map((wk) => [wk.start, wk.end, wk.planned, wk.done])).toEqual([
      ["2026-09-21", "2026-09-27", 1, 1],
      ["2026-09-28", "2026-10-04", 3, 1],
    ]);
    expect(stats.weeks[1].byType.gym).toEqual({ planned: 1, done: 1 });
    expect(stats.weeks[1].byType.run).toEqual({ planned: 2, done: 0 });
  });

  it("buckets across a year boundary", () => {
    const stats = computeWorkoutStats([w("2026-12-27"), w("2026-12-31", true), w("2027-01-03")], {
      from: "2026-12-21",
      to: "2027-01-10",
      today: "2027-02-01",
    });
    expect(stats.weeks.map((wk) => [wk.start, wk.planned])).toEqual([
      ["2026-12-21", 1],
      ["2026-12-28", 2],
      ["2027-01-04", 0],
    ]);
  });

  it("widens a partial range to full weeks and ignores workouts outside it", () => {
    const stats = computeWorkoutStats([w("2026-10-18"), w("2026-10-19"), w("2026-10-26")], {
      from: "2026-10-21",
      to: "2026-10-21",
      today: TODAY,
    });
    expect(stats.weeks).toHaveLength(1);
    expect(stats.weeks[0]).toMatchObject({ start: "2026-10-19", end: "2026-10-25", planned: 1 });
  });

  it("counts per-type totals for the range", () => {
    const stats = computeWorkoutStats(
      [w("2026-10-05", true, "gym"), w("2026-10-12", false, "gym"), w("2026-10-13", true)],
      { ...lastWeeksRange(TODAY, 4), today: TODAY },
    );
    expect(stats.totals.byType.gym).toEqual({ planned: 2, done: 1 });
    expect(stats.totals.byType.run).toEqual({ planned: 1, done: 1 });
    expect(stats.totals.byType.bike).toEqual({ planned: 0, done: 0 });
  });

  it("has a null completion rate when nothing was planned", () => {
    expect(totalsOf([]).completionRate).toBeNull();
    const stats = computeWorkoutStats([], { from: TODAY, to: TODAY, today: TODAY });
    expect(stats.totals.completionRate).toBeNull();
  });

  it("does not count today's or future workouts as missed", () => {
    const stats = computeWorkoutStats(
      [
        w("2026-10-19", true), // done, past
        w("2026-10-20"), // missed
        w(TODAY), // today, not done yet: not missed
        w("2026-10-24"), // future: not missed
        w("2026-10-25", true), // future but already done: counts as done
      ],
      { from: TODAY, to: TODAY, today: TODAY },
    );
    expect(stats.totals).toMatchObject({ planned: 5, done: 2, missed: 1 });
    expect(stats.totals.completionRate).toBeCloseTo(2 / 3);
  });

  it("has a null completion rate when everything planned is still ahead", () => {
    const stats = computeWorkoutStats([w("2026-10-23"), w("2026-10-24")], {
      from: TODAY,
      to: TODAY,
      today: TODAY,
    });
    expect(stats.totals.planned).toBe(2);
    expect(stats.totals.completionRate).toBeNull();
  });

  it("rejects malformed dates and an inverted range", () => {
    expect(() => computeWorkoutStats([], { from: "2026-10", to: TODAY, today: TODAY })).toThrow();
    expect(() => computeWorkoutStats([], { from: "2026-11-02", to: TODAY, today: TODAY })).toThrow(
      RangeError,
    );
  });
});

describe("streak", () => {
  const range = { ...lastWeeksRange(TODAY, 6), today: TODAY }; // weeks from 2026-09-14
  const streakOf = (workouts: StatsWorkout[]) => computeWorkoutStats(workouts, range).streak;

  it("counts consecutive complete weeks ending last week", () => {
    expect(streakOf([w("2026-10-14", true), w("2026-10-07", true)])).toEqual({
      weeks: 2,
      reachesRangeStart: false,
    });
  });

  it("adds the current week once it has a done workout", () => {
    expect(streakOf([w("2026-10-19", true), w("2026-10-14", true)]).weeks).toBe(2);
    // Current week alone, after an empty last week.
    expect(streakOf([w("2026-10-19", true), w("2026-10-07", true)]).weeks).toBe(1);
  });

  it("is not broken by a current week with nothing done yet", () => {
    expect(streakOf([w("2026-10-20"), w("2026-10-14", true)]).weeks).toBe(1);
  });

  it("breaks on an empty week", () => {
    expect(
      streakOf([
        w("2026-10-14", true),
        // week of 2026-10-05 empty
        w("2026-09-29", true),
        w("2026-09-22", true),
      ]).weeks,
    ).toBe(1);
  });

  it("breaks on a week with workouts but none done", () => {
    expect(streakOf([w("2026-10-14", true), w("2026-10-07")]).weeks).toBe(1);
  });

  it("is zero when last week had nothing done and this week neither", () => {
    expect(streakOf([w("2026-10-07", true)]).weeks).toBe(0);
  });

  it("flags a streak that reaches the start of the range", () => {
    const all = ["2026-09-14", "2026-09-21", "2026-09-28", "2026-10-05", "2026-10-12"].map((d) =>
      w(d, true),
    );
    expect(streakOf(all)).toEqual({ weeks: 5, reachesRangeStart: true });
  });

  it("treats every week as complete when the range is in the past", () => {
    const stats = computeWorkoutStats([w("2026-09-14", true), w("2026-09-21", true)], {
      from: "2026-09-14",
      to: "2026-09-27",
      today: TODAY,
    });
    expect(stats.streak).toEqual({ weeks: 2, reachesRangeStart: true });
  });
});

describe("streak for a future range", () => {
  it("is zero when the whole range is ahead of today", () => {
    const stats = computeWorkoutStats([w("2026-11-02", true)], {
      from: "2026-11-02",
      to: "2026-11-08",
      today: TODAY,
    });
    expect(stats.streak).toEqual({ weeks: 0, reachesRangeStart: false });
  });
});
