"use client";

import { useOptimistic, useTransition } from "react";
import { Check } from "lucide-react";
import { setWorkoutDone } from "@/app/app/actions";
import type { Workout } from "@/db/schema";
import { summarize } from "@/lib/workout-structure";
import { WORKOUT_TYPE_META } from "@/lib/workout-types";
import { cn } from "@/lib/utils";

type Props = {
  workout: Workout;
  /** Opens the edit dialog. */
  onEdit: () => void;
};

export function WorkoutCard({ workout, onEdit }: Props) {
  const meta = WORKOUT_TYPE_META[workout.type];
  const Icon = meta.icon;
  const summary = workout.structure ? summarize(workout.structure) : null;
  const heading = summary ? `${meta.label} · ${summary}` : meta.label;

  // Flip immediately; React drops the optimistic value when the transition
  // ends and the revalidated server data (or the unchanged prop, on error)
  // takes over.
  const [done, setOptimisticDone] = useOptimistic(workout.done);
  const [pending, startTransition] = useTransition();

  const toggle = () => {
    const next = !done;
    startTransition(async () => {
      setOptimisticDone(next);
      const result = await setWorkoutDone(workout.id, next);
      if (!result.ok) console.error("[workout] setDone failed:", result.message);
    });
  };

  return (
    <div
      data-slot="workout-card"
      data-done={done || undefined}
      title={workout.notes ? `${heading}: ${workout.notes}` : heading}
      // Pointer users can tap anywhere on the card; keyboard users get the
      // labelled button below. Stop propagation so the day's "add" doesn't fire.
      onClick={(e) => {
        e.stopPropagation();
        onEdit();
      }}
      className={cn(
        "cursor-pointer hover:brightness-95",
        "flex min-w-0 items-center gap-1 rounded-md px-0.5 py-0.5 text-[0.65rem] leading-tight font-medium transition-opacity sm:px-1 sm:text-xs",
        meta.cardClass,
        done && "opacity-55",
      )}
    >
      <button
        type="button"
        role="checkbox"
        aria-checked={done}
        aria-label={done ? `Mark ${meta.label} as not done` : `Mark ${meta.label} as done`}
        aria-busy={pending || undefined}
        // Don't let the click bubble to the day cell (which opens the dialog).
        onClick={(e) => {
          e.stopPropagation();
          toggle();
        }}
        onKeyDown={(e) => e.stopPropagation()}
        className={cn(
          "focus-visible:ring-ring/60 relative grid size-3.5 shrink-0 place-items-center rounded-full border border-current outline-none focus-visible:ring-2 sm:size-4",
          // Enlarge the hit area beyond the visual circle for touch.
          "after:absolute after:-inset-1.5 after:content-['']",
          done && "bg-current",
        )}
      >
        {done ? (
          <Check className="text-background size-2.5 sm:size-3" strokeWidth={3} aria-hidden />
        ) : (
          <Icon className="size-2 sm:size-2.5" aria-hidden />
        )}
      </button>
      <button
        type="button"
        aria-label={`Edit ${heading}${workout.notes ? `: ${workout.notes}` : ""}`}
        onClick={(e) => {
          e.stopPropagation();
          onEdit();
        }}
        onKeyDown={(e) => e.stopPropagation()}
        className={cn(
          "focus-visible:ring-ring/60 min-w-0 flex-1 rounded-sm text-left outline-none focus-visible:ring-2",
          "sr-only sm:not-sr-only sm:truncate",
          done && "line-through",
        )}
      >
        <span className="block truncate">{meta.label}</span>
        {summary && (
          <span className="block truncate text-[0.65rem] font-normal opacity-75">{summary}</span>
        )}
      </button>
    </div>
  );
}
