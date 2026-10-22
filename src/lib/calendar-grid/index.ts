import { addDays, format, getDay, startOfMonth } from "date-fns";

export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

export const GRID_WEEKS = 6;
export const GRID_DAYS = GRID_WEEKS * 7;

export type GridDay = {
  /** ISO date, e.g. "2026-10-21". Stable key; timezone-free. */
  iso: string;
  /** Day of month, 1–31. */
  day: number;
  /** True for days that belong to the requested month (not padding). */
  inMonth: boolean;
};

export type MonthGrid = {
  year: number;
  /** 1–12 */
  month: number;
  /** 6 weeks × 7 days, Monday first. */
  weeks: GridDay[][];
};

/**
 * Build the 6×7 month grid for a month view. Weeks start on Monday. Leading
 * days from the previous month and trailing days from the next month pad the
 * grid so it always has 42 cells.
 *
 * Pure: no clock, no timezone. `month` is 1-based (January = 1).
 */
export function getMonthGrid(year: number, month: number): MonthGrid {
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new RangeError(`month must be an integer 1–12, got ${month}`);
  }

  const first = startOfMonth(new Date(year, month - 1, 1));
  // date-fns getDay: 0 = Sunday … 6 = Saturday. Shift so Monday = 0.
  const leading = (getDay(first) + 6) % 7;
  const gridStart = addDays(first, -leading);

  const weeks: GridDay[][] = [];
  for (let w = 0; w < GRID_WEEKS; w++) {
    const week: GridDay[] = [];
    for (let d = 0; d < 7; d++) {
      const date = addDays(gridStart, w * 7 + d);
      week.push({
        iso: format(date, "yyyy-MM-dd"),
        day: date.getDate(),
        inMonth: date.getMonth() === month - 1,
      });
    }
    weeks.push(week);
  }

  return { year, month, weeks };
}

/** Previous month as { year, month }, wrapping across years. */
export function previousMonth(year: number, month: number): { year: number; month: number } {
  return month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
}

/** Next month as { year, month }, wrapping across years. */
export function nextMonth(year: number, month: number): { year: number; month: number } {
  return month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };
}
