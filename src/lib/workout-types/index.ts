import type { LucideIcon } from "lucide-react";
import {
  Activity,
  Bike,
  Dumbbell,
  Flame,
  Footprints,
  Gauge,
  MoreHorizontal,
  Mountain,
  StretchHorizontal,
} from "lucide-react";

/**
 * Single source of truth for workout types. Consumed by the DB enum,
 * input validation, the form select, and card rendering. Add new types
 * here and nowhere else (then `npm run db:generate` for the enum change).
 */
export const WORKOUT_TYPES = [
  "gym",
  "run",
  "bike",
  "interval",
  "tempo",
  "long_run",
  "strength",
  "mobility",
  "other",
] as const;

export type WorkoutType = (typeof WORKOUT_TYPES)[number];

export type WorkoutTypeMeta = {
  label: string;
  /**
   * Static Tailwind classes for the card. Must be literal strings so the
   * Tailwind scanner picks them up.
   */
  cardClass: string;
  icon: LucideIcon;
};

export const WORKOUT_TYPE_META: Record<WorkoutType, WorkoutTypeMeta> = {
  gym: {
    label: "Gym",
    cardClass: "bg-violet-100 text-violet-900 dark:bg-violet-950 dark:text-violet-200",
    icon: Dumbbell,
  },
  run: {
    label: "Run",
    cardClass: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
    icon: Footprints,
  },
  bike: {
    label: "Bike",
    cardClass: "bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200",
    icon: Bike,
  },
  interval: {
    label: "Intervals",
    cardClass: "bg-rose-100 text-rose-900 dark:bg-rose-950 dark:text-rose-200",
    icon: Activity,
  },
  tempo: {
    label: "Tempo",
    cardClass: "bg-orange-100 text-orange-900 dark:bg-orange-950 dark:text-orange-200",
    icon: Gauge,
  },
  long_run: {
    label: "Long run",
    cardClass: "bg-teal-100 text-teal-900 dark:bg-teal-950 dark:text-teal-200",
    icon: Mountain,
  },
  strength: {
    label: "Strength",
    cardClass: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
    icon: Flame,
  },
  mobility: {
    label: "Mobility",
    cardClass: "bg-lime-100 text-lime-900 dark:bg-lime-950 dark:text-lime-200",
    icon: StretchHorizontal,
  },
  other: {
    label: "Other",
    cardClass: "bg-neutral-200 text-neutral-900 dark:bg-neutral-800 dark:text-neutral-200",
    icon: MoreHorizontal,
  },
};

export function isWorkoutType(value: unknown): value is WorkoutType {
  return typeof value === "string" && (WORKOUT_TYPES as readonly string[]).includes(value);
}
