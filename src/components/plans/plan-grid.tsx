"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import type { PlanDay } from "@/db/schema";
import { summarize } from "@/lib/workout-structure";
import { WORKOUT_TYPE_META } from "@/lib/workout-types";
import { cn } from "@/lib/utils";
import { PlanDayDialog } from "./plan-day-dialog";
import { dayName, shortDayName } from "./weekdays";

type Props = {
  planId: string;
  weeks: number;
  days: PlanDay[];
};

type Target = { weekIndex: number; dayOfWeek: number; day?: PlanDay };

const key = (w: number, d: number) => `${w}:${d}`;

/**
 * Week-by-week editor. Each week is a row of seven days on wide screens and
 * a stacked list on phones. Tap "+" to add a workout, a chip to edit it.
 */
export function PlanGrid({ planId, weeks, days }: Props) {
  const [target, setTarget] = useState<Target | null>(null);
  const [open, setOpen] = useState(false);
  // Bumped on every open so the dialog remounts with a fresh form.
  const [session, setSession] = useState(0);

  const byDay = new Map<string, PlanDay[]>();
  for (const d of days) {
    const k = key(d.weekIndex, d.dayOfWeek);
    const list = byDay.get(k);
    if (list) list.push(d);
    else byDay.set(k, [d]);
  }

  const openDialog = (t: Target) => {
    setTarget(t);
    setSession((n) => n + 1);
    setOpen(true);
  };

  return (
    <>
      <div className="flex flex-col gap-5">
        {Array.from({ length: weeks }, (_, w) => {
          const weekCount = days.filter((d) => d.weekIndex === w).length;
          return (
            <section key={w} aria-labelledby={`week-${w}`} className="flex flex-col gap-1.5">
              <h2 id={`week-${w}`} className="flex items-baseline gap-2 text-sm font-semibold">
                Week {w + 1}
                <span className="text-muted-foreground text-xs font-normal">
                  {weekCount === 0
                    ? "rest week"
                    : `${weekCount} workout${weekCount === 1 ? "" : "s"}`}
                </span>
              </h2>
              <div className="grid grid-cols-1 gap-1 sm:grid-cols-7">
                {Array.from({ length: 7 }, (_, d) => {
                  const list = byDay.get(key(w, d)) ?? [];
                  const label = `Week ${w + 1}, ${dayName(d)}`;
                  return (
                    <div
                      key={d}
                      role="group"
                      aria-label={label}
                      className={cn(
                        "bg-card flex items-center gap-2 rounded-lg border p-1.5",
                        "sm:min-h-28 sm:flex-col sm:items-stretch sm:gap-1 sm:p-2",
                      )}
                    >
                      <span className="text-muted-foreground w-9 shrink-0 text-xs font-medium tracking-wide uppercase sm:w-auto">
                        {shortDayName(d)}
                      </span>
                      <div className="flex min-w-0 flex-1 flex-wrap gap-1 sm:flex-col sm:flex-nowrap">
                        {list.map((day) => (
                          <PlanDayChip
                            key={day.id}
                            day={day}
                            onEdit={() => openDialog({ weekIndex: w, dayOfWeek: d, day })}
                          />
                        ))}
                      </div>
                      <button
                        type="button"
                        aria-label={`Add workout to ${label}`}
                        title="Add workout"
                        onClick={() => openDialog({ weekIndex: w, dayOfWeek: d })}
                        className={cn(
                          "text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-ring/50 grid size-8 shrink-0 place-items-center rounded-md outline-none focus-visible:ring-3",
                          "sm:h-7 sm:w-full sm:border sm:border-dashed",
                        )}
                      >
                        <Plus className="size-4" aria-hidden />
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>

      {target && (
        <PlanDayDialog
          key={session}
          planId={planId}
          weekIndex={target.weekIndex}
          dayOfWeek={target.dayOfWeek}
          day={target.day}
          open={open}
          onOpenChange={setOpen}
        />
      )}
    </>
  );
}

function PlanDayChip({ day, onEdit }: { day: PlanDay; onEdit: () => void }) {
  const meta = WORKOUT_TYPE_META[day.type];
  const Icon = meta.icon;
  const summary = day.structure ? summarize(day.structure) : null;
  const heading = summary ? `${meta.label} · ${summary}` : meta.label;
  return (
    <button
      type="button"
      onClick={onEdit}
      aria-label={`Edit ${heading}${day.notes ? `: ${day.notes}` : ""}`}
      title={day.notes ? `${heading}: ${day.notes}` : heading}
      className={cn(
        "focus-visible:ring-ring/60 flex max-w-full min-w-0 items-center gap-1 rounded-md px-1.5 py-1 text-left text-xs leading-tight font-medium outline-none hover:brightness-95 focus-visible:ring-2",
        meta.cardClass,
      )}
    >
      <Icon className="size-3 shrink-0" aria-hidden />
      <span className="min-w-0">
        <span className="block truncate">{meta.label}</span>
        {summary && (
          <span className="block truncate text-[0.65rem] font-normal opacity-75">{summary}</span>
        )}
      </span>
    </button>
  );
}
