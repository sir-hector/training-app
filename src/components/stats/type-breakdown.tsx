import { WORKOUT_TYPES, WORKOUT_TYPE_META } from "@/lib/workout-types";
import type { TypeCounts } from "@/lib/workout-stats";
import { cn } from "@/lib/utils";

type Props = {
  byType: TypeCounts;
  weeks: number;
};

/**
 * Done / planned per workout type, most-planned first. Labels, icons and
 * colors all come from `workout-types`. The bar's pale part is what was
 * planned (scaled to the most-planned type); the solid part is what got done.
 */
export function TypeBreakdown({ byType, weeks }: Props) {
  const rows = WORKOUT_TYPES.map((type) => ({ type, ...byType[type] }))
    .filter((r) => r.planned > 0)
    .sort((a, b) => b.planned - a.planned);
  const max = Math.max(1, ...rows.map((r) => r.planned));

  return (
    <section aria-labelledby="by-type" className="flex flex-col gap-3">
      <h2 id="by-type" className="font-heading text-base font-semibold tracking-tight sm:text-lg">
        By type
      </h2>
      {rows.length === 0 ? (
        <p className="text-muted-foreground text-sm">No workouts in the last {weeks} weeks.</p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {rows.map(({ type, planned, done }) => {
            const meta = WORKOUT_TYPE_META[type];
            const Icon = meta.icon;
            return (
              <li
                key={type}
                className="grid grid-cols-[minmax(6.5rem,auto)_1fr_auto] items-center gap-3 text-sm sm:grid-cols-[9rem_1fr_4rem]"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <Icon className="text-muted-foreground size-4 shrink-0" aria-hidden />
                  <span className="truncate">{meta.label}</span>
                </span>
                <span className="relative h-2.5" aria-hidden>
                  <span
                    className={cn(
                      "absolute inset-y-0 left-0 rounded-full opacity-30",
                      meta.chartClass,
                    )}
                    style={{ width: `${(planned / max) * 100}%` }}
                  />
                  {done > 0 && (
                    <span
                      className={cn("absolute inset-y-0 left-0 rounded-full", meta.chartClass)}
                      style={{ width: `${(done / max) * 100}%` }}
                    />
                  )}
                </span>
                <span className="text-right tabular-nums">
                  {done} / {planned}
                  <span className="sr-only"> done</span>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
