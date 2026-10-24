"use client";

import { useOptimistic, useState } from "react";
import type { Workout } from "@/db/schema";
import type { GridDay } from "@/lib/calendar-grid";
import { cn } from "@/lib/utils";
import { WorkoutCard } from "./workout-card";
import { WorkoutDialog, type OptimisticChange } from "./workout-dialog";

type Props = {
  day: GridDay;
  isToday: boolean;
  workouts: Workout[];
};

/**
 * One calendar cell. Clicking empty space adds a workout; clicking a card
 * edits it.
 */
export function DayCell({ day, isToday, workouts }: Props) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Workout | undefined>(undefined);
  // Bumped on every open so the dialog remounts with a fresh form.
  const [session, setSession] = useState(0);

  // Optimistic view of this day's workouts. Reverts to the server data
  // (revalidated by the action) once the transition settles.
  const [visible, applyOptimistic] = useOptimistic(
    workouts,
    (current: Workout[], change: OptimisticChange) => {
      if (change.kind === "delete") return current.filter((w) => w.id !== change.id);
      // Moved to another day: drop it here; the target cell picks it up on revalidate.
      if (change.workout.date !== day.iso) return current.filter((w) => w.id !== change.workout.id);
      return current.map((w) => (w.id === change.workout.id ? change.workout : w));
    },
  );

  const openDialog = (workout?: Workout) => {
    setEditing(workout);
    setSession((n) => n + 1);
    setOpen(true);
  };

  return (
    <>
      <div
        role="gridcell"
        aria-label={`${day.iso}, ${visible.length} workout${visible.length === 1 ? "" : "s"}`}
        aria-current={isToday ? "date" : undefined}
        tabIndex={0}
        onClick={() => openDialog()}
        onKeyDown={(e) => {
          if (e.target !== e.currentTarget) return;
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            openDialog();
          }
        }}
        className={cn(
          "bg-card hover:bg-muted focus-visible:ring-ring/50 flex min-h-14 cursor-pointer flex-col gap-1 rounded-lg border p-1 transition-colors outline-none focus-visible:ring-3 sm:min-h-24 sm:p-2",
          !day.inMonth && "text-muted-foreground/50 bg-transparent",
          isToday && "border-brand ring-brand/25 ring-2",
        )}
      >
        <span
          className={cn(
            "inline-flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-medium tabular-nums sm:text-sm",
            isToday && "bg-brand text-brand-foreground",
          )}
        >
          {day.day}
        </span>
        {visible.length > 0 && (
          <div className="flex min-w-0 flex-col gap-0.5">
            {visible.map((w) => (
              <WorkoutCard key={w.id} workout={w} onEdit={() => openDialog(w)} />
            ))}
          </div>
        )}
      </div>
      <WorkoutDialog
        key={session}
        dateIso={day.iso}
        workout={editing}
        open={open}
        onOpenChange={setOpen}
        onOptimistic={applyOptimistic}
      />
    </>
  );
}
