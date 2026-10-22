import { describe, expect, it } from "vitest";
import { GRID_DAYS, getMonthGrid, nextMonth, previousMonth } from "./index";

const flat = (year: number, month: number) => getMonthGrid(year, month).weeks.flat();

describe("getMonthGrid", () => {
  it("always returns 6 weeks of 7 days", () => {
    for (const [y, m] of [
      [2026, 2],
      [2026, 10],
      [2024, 2],
      [2027, 1],
    ]) {
      const grid = getMonthGrid(y, m);
      expect(grid.weeks).toHaveLength(6);
      for (const week of grid.weeks) expect(week).toHaveLength(7);
      expect(grid.weeks.flat()).toHaveLength(GRID_DAYS);
    }
  });

  it("pads leading days from the previous month (Oct 2026 starts on Thursday)", () => {
    const days = flat(2026, 10);
    // Mon 28 Sep, Tue 29, Wed 30, then Thu 1 Oct
    expect(days.slice(0, 4).map((d) => d.iso)).toEqual([
      "2026-09-28",
      "2026-09-29",
      "2026-09-30",
      "2026-10-01",
    ]);
    expect(days.slice(0, 3).every((d) => !d.inMonth)).toBe(true);
    expect(days[3].inMonth).toBe(true);
  });

  it("pads trailing days from the next month", () => {
    const days = flat(2026, 10);
    // 3 leading + 31 in-month = 34 → 8 trailing days: 1–8 Nov
    const trailing = days.slice(34);
    expect(trailing).toHaveLength(8);
    expect(trailing[0].iso).toBe("2026-11-01");
    expect(trailing[7].iso).toBe("2026-11-08");
    expect(trailing.every((d) => !d.inMonth)).toBe(true);
  });

  it("has no leading padding when the month starts on Monday (June 2026)", () => {
    const days = flat(2026, 6);
    expect(days[0]).toEqual({ iso: "2026-06-01", day: 1, inMonth: true });
  });

  it("handles leap-year February (Feb 2024 has 29 days)", () => {
    const days = flat(2024, 2);
    const inMonth = days.filter((d) => d.inMonth);
    expect(inMonth).toHaveLength(29);
    expect(inMonth[28].iso).toBe("2024-02-29");
    expect(inMonth[0].iso).toBe("2024-02-01");
  });

  it("handles non-leap February (Feb 2026 has 28 days)", () => {
    expect(flat(2026, 2).filter((d) => d.inMonth)).toHaveLength(28);
  });

  it("orders each week Monday → Sunday", () => {
    // 2026-10-26 is a Monday; the 5th row of Oct 2026 starts there.
    const week = getMonthGrid(2026, 10).weeks[4];
    expect(week.map((d) => d.iso)).toEqual([
      "2026-10-26",
      "2026-10-27",
      "2026-10-28",
      "2026-10-29",
      "2026-10-30",
      "2026-10-31",
      "2026-11-01",
    ]);
  });

  it("wraps padding across a year boundary (Jan 2027 starts on Friday)", () => {
    const days = flat(2027, 1);
    expect(days[0].iso).toBe("2026-12-28");
    expect(days[4].iso).toBe("2027-01-01");
  });

  it("rejects an out-of-range month", () => {
    expect(() => getMonthGrid(2026, 0)).toThrow(RangeError);
    expect(() => getMonthGrid(2026, 13)).toThrow(RangeError);
  });
});

describe("previousMonth / nextMonth", () => {
  it("wraps across years", () => {
    expect(previousMonth(2026, 1)).toEqual({ year: 2025, month: 12 });
    expect(nextMonth(2026, 12)).toEqual({ year: 2027, month: 1 });
  });

  it("steps within a year", () => {
    expect(previousMonth(2026, 10)).toEqual({ year: 2026, month: 9 });
    expect(nextMonth(2026, 10)).toEqual({ year: 2026, month: 11 });
  });
});
