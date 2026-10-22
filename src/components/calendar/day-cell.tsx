import type { GridDay } from "@/lib/calendar-grid";
import { cn } from "@/lib/utils";

type Props = {
  day: GridDay;
  isToday: boolean;
};

/**
 * One calendar cell. Looks clickable; interaction arrives with workouts (#4).
 */
export function DayCell({ day, isToday }: Props) {
  return (
    <div
      role="gridcell"
      aria-label={day.iso}
      aria-current={isToday ? "date" : undefined}
      tabIndex={0}
      className={cn(
        "bg-card hover:bg-muted focus-visible:ring-ring/50 flex aspect-square min-h-12 cursor-pointer flex-col rounded-lg border p-1.5 transition-colors outline-none focus-visible:ring-3 sm:aspect-[5/4] sm:p-2",
        !day.inMonth && "text-muted-foreground/50 bg-transparent",
        isToday && "border-primary",
      )}
    >
      <span
        className={cn(
          "inline-flex size-6 items-center justify-center rounded-full text-xs font-medium tabular-nums sm:text-sm",
          isToday && "bg-primary text-primary-foreground",
        )}
      >
        {day.day}
      </span>
    </div>
  );
}
