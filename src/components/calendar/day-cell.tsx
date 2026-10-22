"use client";

import { useState } from "react";
import type { Workout } from "@/db/schema";
import type { GridDay } from "@/lib/calendar-grid";
import { cn } from "@/lib/utils";
import { AddWorkoutDialog } from "./add-workout-dialog";
import { WorkoutCard } from "./workout-card";

type Props = {
  day: GridDay;
  isToday: boolean;
  workouts: Workout[];
};

/**
 * One calendar cell. Click (or Enter/Space) opens the Add Workout dialog.
 */
export function DayCell({ day, isToday, workouts }: Props) {
  const [open, setOpen] = useState(false);
  // Bumped on every open so the dialog remounts with a fresh form.
  const [session, setSession] = useState(0);
  const openDialog = () => {
    setSession((n) => n + 1);
    setOpen(true);
  };

  return (
    <>
      <div
        role="gridcell"
        aria-label={`${day.iso}, ${workouts.length} workout${workouts.length === 1 ? "" : "s"}`}
        aria-current={isToday ? "date" : undefined}
        tabIndex={0}
        onClick={openDialog}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            openDialog();
          }
        }}
        className={cn(
          "bg-card hover:bg-muted focus-visible:ring-ring/50 flex aspect-square min-h-12 cursor-pointer flex-col gap-1 rounded-lg border p-1.5 transition-colors outline-none focus-visible:ring-3 sm:aspect-[5/4] sm:p-2",
          !day.inMonth && "text-muted-foreground/50 bg-transparent",
          isToday && "border-primary",
        )}
      >
        <span
          className={cn(
            "inline-flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-medium tabular-nums sm:text-sm",
            isToday && "bg-primary text-primary-foreground",
          )}
        >
          {day.day}
        </span>
        {workouts.length > 0 && (
          <div className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-hidden">
            {workouts.map((w) => (
              <WorkoutCard key={w.id} workout={w} />
            ))}
          </div>
        )}
      </div>
      <AddWorkoutDialog key={session} dateIso={day.iso} open={open} onOpenChange={setOpen} />
    </>
  );
}
