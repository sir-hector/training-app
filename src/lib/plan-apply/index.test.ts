import { describe, expect, it } from "vitest";
import { matchPlanToCalendar, type DatedWorkout } from "./index";

const range = { from: "2032-02-02", to: "2032-02-15" };
const w = (date: string, type: DatedWorkout["type"], id = "") => ({ date, type, id });

describe("matchPlanToCalendar", () => {
  it("inserts everything onto an empty calendar", () => {
    const planned = [w("2032-02-02", "gym"), w("2032-02-04", "run")];
    expect(matchPlanToCalendar(planned, [], range)).toEqual({
      toInsert: planned,
      skipped: [],
      untouched: 0,
    });
  });

  it("skips an exact date + type match", () => {
    const planned = [w("2032-02-02", "gym", "a"), w("2032-02-04", "run", "b")];
    const result = matchPlanToCalendar(planned, [w("2032-02-04", "run")], range);
    expect(result.toInsert.map((p) => p.id)).toEqual(["a"]);
    expect(result.skipped.map((p) => p.id)).toEqual(["b"]);
    expect(result.untouched).toBe(0);
  });

  it("matches by count: two planned runs and one existing run add one, skip one", () => {
    const planned = [w("2032-02-03", "run", "a"), w("2032-02-03", "run", "b")];
    const result = matchPlanToCalendar(planned, [w("2032-02-03", "run")], range);
    expect(result.skipped.map((p) => p.id)).toEqual(["a"]);
    expect(result.toInsert.map((p) => p.id)).toEqual(["b"]);
  });

  it("matches by count: more existing than planned skips all and leaves the rest untouched", () => {
    const planned = [w("2032-02-03", "run", "a")];
    const existing = [w("2032-02-03", "run"), w("2032-02-03", "run"), w("2032-02-03", "run")];
    const result = matchPlanToCalendar(planned, existing, range);
    expect(result.toInsert).toEqual([]);
    expect(result.skipped.map((p) => p.id)).toEqual(["a"]);
    expect(result.untouched).toBe(2);
  });

  it("does not let a different type on the same date block", () => {
    const planned = [w("2032-02-03", "run", "a")];
    const result = matchPlanToCalendar(planned, [w("2032-02-03", "gym")], range);
    expect(result.toInsert.map((p) => p.id)).toEqual(["a"]);
    expect(result.skipped).toEqual([]);
    expect(result.untouched).toBe(1);
  });

  it("does not match the same type on a different date", () => {
    const planned = [w("2032-02-03", "run", "a")];
    const result = matchPlanToCalendar(planned, [w("2032-02-04", "run")], range);
    expect(result.toInsert).toHaveLength(1);
    expect(result.untouched).toBe(1);
  });

  it("ignores existing workouts outside the range", () => {
    const planned = [w("2032-02-02", "run", "a")];
    const existing = [w("2032-02-01", "run"), w("2032-02-16", "run"), w("2031-02-02", "run")];
    expect(matchPlanToCalendar(planned, existing, range)).toEqual({
      toInsert: planned,
      skipped: [],
      untouched: 0,
    });
  });

  it("includes both range bounds", () => {
    const planned = [w("2032-02-02", "run", "a"), w("2032-02-15", "bike", "b")];
    const existing = [w("2032-02-02", "run"), w("2032-02-15", "bike")];
    const result = matchPlanToCalendar(planned, existing, range);
    expect(result.skipped.map((p) => p.id)).toEqual(["a", "b"]);
    expect(result.toInsert).toEqual([]);
  });
});
