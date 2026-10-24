import { describe, expect, it } from "vitest";
import {
  addDays,
  assertMonday,
  dayOfWeekOf,
  isIsoDate,
  isMonday,
  monthOf,
  nextMondayOnOrAfter,
  planDateRange,
  planDayDate,
  snapToMonday,
} from "./index";

describe("isIsoDate", () => {
  it("accepts real dates and rejects malformed or rolled-over ones", () => {
    expect(isIsoDate("2032-02-29")).toBe(true); // leap year
    expect(isIsoDate("2031-02-29")).toBe(false);
    expect(isIsoDate("2032-02-30")).toBe(false);
    expect(isIsoDate("2032-13-01")).toBe(false);
    expect(isIsoDate("2032-2-2")).toBe(false);
    expect(isIsoDate("")).toBe(false);
  });
});

describe("dayOfWeekOf / isMonday", () => {
  it("numbers days Monday = 0 … Sunday = 6", () => {
    expect(dayOfWeekOf("2032-02-02")).toBe(0); // Monday
    expect(dayOfWeekOf("2032-02-04")).toBe(2);
    expect(dayOfWeekOf("2032-02-08")).toBe(6); // Sunday
  });

  it("isMonday is false for other days and invalid input", () => {
    expect(isMonday("2032-02-02")).toBe(true);
    expect(isMonday("2032-02-03")).toBe(false);
    expect(isMonday("2032-02-30")).toBe(false);
    expect(isMonday("nope")).toBe(false);
  });

  it("assertMonday throws for non-Mondays", () => {
    expect(() => assertMonday("2032-02-02")).not.toThrow();
    expect(() => assertMonday("2032-02-03")).toThrow(RangeError);
    expect(() => assertMonday("bad")).toThrow(RangeError);
  });
});

describe("snapToMonday / nextMondayOnOrAfter", () => {
  it("snaps to the Monday of the same week", () => {
    expect(snapToMonday("2032-02-02")).toBe("2032-02-02");
    expect(snapToMonday("2032-02-04")).toBe("2032-02-02");
    expect(snapToMonday("2032-02-08")).toBe("2032-02-02"); // Sunday belongs to the week before
  });

  it("snaps across month and year boundaries", () => {
    expect(snapToMonday("2032-03-03")).toBe("2032-03-01");
    expect(snapToMonday("2033-01-01")).toBe("2032-12-27");
  });

  it("nextMondayOnOrAfter keeps a Monday and otherwise moves forward", () => {
    expect(nextMondayOnOrAfter("2032-02-02")).toBe("2032-02-02");
    expect(nextMondayOnOrAfter("2032-02-03")).toBe("2032-02-09");
    expect(nextMondayOnOrAfter("2032-02-08")).toBe("2032-02-09");
    expect(nextMondayOnOrAfter("2032-12-29")).toBe("2033-01-03");
  });
});

describe("planDayDate", () => {
  it("is start + weekIndex * 7 + dayOfWeek", () => {
    expect(planDayDate("2032-02-02", 0, 0)).toBe("2032-02-02");
    expect(planDayDate("2032-02-02", 0, 2)).toBe("2032-02-04");
    expect(planDayDate("2032-02-02", 1, 6)).toBe("2032-02-15");
  });

  it("crosses a leap day, month and year end", () => {
    expect(planDayDate("2032-02-23", 0, 6)).toBe("2032-02-29");
    expect(planDayDate("2032-02-23", 1, 0)).toBe("2032-03-01");
    expect(planDayDate("2032-12-27", 0, 5)).toBe("2033-01-01");
  });

  it("is unaffected by DST changes (last Sunday of March / October)", () => {
    // Europe switches on 2032-03-28 and 2032-10-31; US on 2032-03-14 and 2032-11-07.
    expect(planDayDate("2032-03-22", 1, 0)).toBe("2032-03-29");
    expect(planDayDate("2032-10-25", 1, 0)).toBe("2032-11-01");
    expect(planDayDate("2032-03-08", 25, 6)).toBe(addDays("2032-03-08", 181));
  });

  it("rejects a non-Monday start and out-of-range indices", () => {
    expect(() => planDayDate("2032-02-03", 0, 0)).toThrow(RangeError);
    expect(() => planDayDate("2032-02-02", -1, 0)).toThrow(RangeError);
    expect(() => planDayDate("2032-02-02", 0, 7)).toThrow(RangeError);
    expect(() => planDayDate("2032-02-02", 0.5, 0)).toThrow(RangeError);
  });
});

describe("planDateRange", () => {
  it("covers Monday of week 1 to Sunday of the last week", () => {
    expect(planDateRange("2032-02-02", 1)).toEqual({ from: "2032-02-02", to: "2032-02-08" });
    expect(planDateRange("2032-02-02", 2)).toEqual({ from: "2032-02-02", to: "2032-02-15" });
    expect(planDateRange("2032-12-27", 26)).toEqual({ from: "2032-12-27", to: "2033-06-26" });
  });

  it("rejects bad input", () => {
    expect(() => planDateRange("2032-02-04", 2)).toThrow(RangeError);
    expect(() => planDateRange("2032-02-02", 0)).toThrow(RangeError);
  });
});

describe("monthOf", () => {
  it("returns YYYY-MM", () => {
    expect(monthOf("2032-02-02")).toBe("2032-02");
    expect(() => monthOf("x")).toThrow(RangeError);
  });
});
