import type { LucideIcon } from "lucide-react";
import type { StructureKind } from "@/lib/workout-structure";
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
  /**
   * Solid fill for charts (stats page bars and swatches). Literal classes,
   * like `cardClass`, and a step stronger so a thin bar reads on the surface.
   */
  chartClass: string;
  icon: LucideIcon;
  /**
   * Which kind of structure (sets/reps, intervals, distance) this type takes,
   * or null when it only has notes.
   */
  structureKind: StructureKind | null;
};

export const WORKOUT_TYPE_META: Record<WorkoutType, WorkoutTypeMeta> = {
  gym: {
    label: "Gym",
    cardClass: "bg-violet-100 text-violet-900 dark:bg-violet-950 dark:text-violet-200",
    chartClass: "bg-violet-500 dark:bg-violet-400",
    icon: Dumbbell,
    structureKind: "strength",
  },
  run: {
    label: "Run",
    cardClass: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
    chartClass: "bg-emerald-500 dark:bg-emerald-400",
    icon: Footprints,
    structureKind: "endurance",
  },
  bike: {
    label: "Bike",
    cardClass: "bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200",
    chartClass: "bg-sky-500 dark:bg-sky-400",
    icon: Bike,
    structureKind: "endurance",
  },
  interval: {
    label: "Intervals",
    cardClass: "bg-rose-100 text-rose-900 dark:bg-rose-950 dark:text-rose-200",
    chartClass: "bg-rose-500 dark:bg-rose-400",
    icon: Activity,
    structureKind: "intervals",
  },
  tempo: {
    label: "Tempo",
    cardClass: "bg-orange-100 text-orange-900 dark:bg-orange-950 dark:text-orange-200",
    chartClass: "bg-orange-500 dark:bg-orange-400",
    icon: Gauge,
    structureKind: "intervals",
  },
  long_run: {
    label: "Long run",
    cardClass: "bg-teal-100 text-teal-900 dark:bg-teal-950 dark:text-teal-200",
    chartClass: "bg-teal-500 dark:bg-teal-400",
    icon: Mountain,
    structureKind: "endurance",
  },
  strength: {
    label: "Strength",
    cardClass: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
    chartClass: "bg-amber-500 dark:bg-amber-400",
    icon: Flame,
    structureKind: "strength",
  },
  mobility: {
    label: "Mobility",
    cardClass: "bg-lime-100 text-lime-900 dark:bg-lime-950 dark:text-lime-200",
    chartClass: "bg-lime-500 dark:bg-lime-400",
    icon: StretchHorizontal,
    structureKind: null,
  },
  other: {
    label: "Other",
    cardClass: "bg-neutral-200 text-neutral-900 dark:bg-neutral-800 dark:text-neutral-200",
    chartClass: "bg-neutral-500 dark:bg-neutral-400",
    icon: MoreHorizontal,
    structureKind: null,
  },
};

export function isWorkoutType(value: unknown): value is WorkoutType {
  return typeof value === "string" && (WORKOUT_TYPES as readonly string[]).includes(value);
}

export function structureKindOf(type: WorkoutType): StructureKind | null {
  return WORKOUT_TYPE_META[type].structureKind;
}
