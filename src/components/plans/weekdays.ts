const DAY_NAMES = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

/** 0 = Monday … 6 = Sunday. */
export function dayName(dayOfWeek: number): string {
  return DAY_NAMES[dayOfWeek] ?? "";
}

export function shortDayName(dayOfWeek: number): string {
  return dayName(dayOfWeek).slice(0, 3);
}
