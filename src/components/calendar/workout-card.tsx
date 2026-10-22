import type { Workout } from "@/db/schema";
import { WORKOUT_TYPE_META } from "@/lib/workout-types";
import { cn } from "@/lib/utils";

export function WorkoutCard({ workout }: { workout: Workout }) {
  const meta = WORKOUT_TYPE_META[workout.type];
  const Icon = meta.icon;
  return (
    <div
      data-slot="workout-card"
      title={workout.notes ?? meta.label}
      className={cn(
        "flex min-w-0 items-center gap-1 rounded-md px-1 py-0.5 text-[0.65rem] leading-tight font-medium sm:text-xs",
        meta.cardClass,
      )}
    >
      <Icon className="size-3 shrink-0" aria-hidden />
      <span className="sr-only sm:not-sr-only sm:truncate">{meta.label}</span>
    </div>
  );
}
