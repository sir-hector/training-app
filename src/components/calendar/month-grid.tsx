import { WEEKDAYS, type MonthGrid as MonthGridData } from "@/lib/calendar-grid";
import { DayCell } from "./day-cell";

type Props = {
  grid: MonthGridData;
  /** ISO date of "today", e.g. "2026-10-21". */
  todayIso: string;
};

export function MonthGrid({ grid, todayIso }: Props) {
  return (
    <div className="flex flex-col gap-1">
      <div className="grid grid-cols-7 gap-1" aria-hidden>
        {WEEKDAYS.map((d) => (
          <div
            key={d}
            className="text-muted-foreground py-1 text-center text-[0.7rem] font-medium tracking-wide uppercase"
          >
            {d}
          </div>
        ))}
      </div>
      <div
        role="grid"
        aria-label={`${grid.year}-${String(grid.month).padStart(2, "0")}`}
        className="grid grid-cols-7 gap-1"
      >
        {grid.weeks.flat().map((day) => (
          <DayCell key={day.iso} day={day} isToday={day.iso === todayIso} />
        ))}
      </div>
    </div>
  );
}
