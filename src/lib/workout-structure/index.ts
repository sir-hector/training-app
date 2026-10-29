import { z } from "zod";
import { withDoneFlag } from "./draft";

/**
 * Optional structure attached to a workout (and, later, to plan days):
 * exercises with sets for gym work, repeats for interval sessions, targets
 * for endurance sessions. Pure module: Zod + plain functions, no DB or React
 * imports, so it can be shared by server actions, the editor and tests.
 */

export const STRUCTURE_KINDS = ["strength", "intervals", "endurance"] as const;
export type StructureKind = (typeof STRUCTURE_KINDS)[number];

export const STRUCTURE_LIMITS = {
  exercises: 20,
  setsPerExercise: 20,
  repeats: 20,
  exerciseName: 80,
  reps: 1000,
  weightKg: 1000,
  repeatCount: 100,
  distanceM: 100_000,
  durationS: 24 * 60 * 60,
  restS: 60 * 60,
  warmupMin: 300,
  cooldownMin: 300,
  distanceKm: 1000,
  durationMin: 24 * 60,
} as const;

const L = STRUCTURE_LIMITS;

/** Pace as "m:ss" per km, e.g. "4:30". */
const PACE_RE = /^\d{1,2}:[0-5]\d$/;

const positiveInt = (what: string, max: number) =>
  z
    .number({ error: `Enter ${what}` })
    .int(`${capitalize(what)} must be a whole number`)
    .positive(`${capitalize(what)} must be more than 0`)
    .max(max, `${capitalize(what)} must be at most ${max}`);

const positiveNumber = (what: string, max: number) =>
  z
    .number({ error: `Enter ${what}` })
    .positive(`${capitalize(what)} must be more than 0`)
    .max(max, `${capitalize(what)} must be at most ${max}`);

const pace = z
  .string({ error: "Enter a pace like 4:30" })
  .trim()
  .regex(PACE_RE, "Pace must look like 4:30 (min:sec per km)");

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export const strengthSetSchema = z.object({
  reps: positiveInt("reps", L.reps),
  weightKg: positiveNumber("weight", L.weightKg).optional(),
});

export const exerciseSchema = z.object({
  name: z
    .string({ error: "Name the exercise" })
    .trim()
    .min(1, "Name the exercise")
    .max(L.exerciseName, `Exercise name must be at most ${L.exerciseName} characters`),
  sets: z
    .array(strengthSetSchema)
    .min(1, "Add at least one set")
    .max(L.setsPerExercise, `At most ${L.setsPerExercise} sets per exercise`),
  /**
   * Ticked off on the calendar (absent = not done). Calendar workouts only:
   * plan days and freshly applied plans never carry it (see `withoutExerciseDone`).
   */
  done: z.boolean().optional(),
});

export const strengthStructureSchema = z.object({
  kind: z.literal("strength"),
  exercises: z
    .array(exerciseSchema)
    .min(1, "Add at least one exercise")
    .max(L.exercises, `At most ${L.exercises} exercises`),
});

export const intervalRepeatSchema = z
  .object({
    count: positiveInt("repeat count", L.repeatCount),
    distanceM: positiveInt("distance", L.distanceM).optional(),
    durationS: positiveInt("time", L.durationS).optional(),
    targetPace: pace.optional(),
    restS: positiveInt("rest", L.restS).optional(),
  })
  .refine((r) => r.distanceM !== undefined || r.durationS !== undefined, {
    message: "Add a distance or a time",
    path: ["distanceM"],
  });

export const intervalsStructureSchema = z.object({
  kind: z.literal("intervals"),
  warmupMin: positiveInt("warm-up", L.warmupMin).optional(),
  repeats: z
    .array(intervalRepeatSchema)
    .min(1, "Add at least one repeat")
    .max(L.repeats, `At most ${L.repeats} repeats`),
  cooldownMin: positiveInt("cool-down", L.cooldownMin).optional(),
});

export const enduranceStructureSchema = z
  .object({
    kind: z.literal("endurance"),
    distanceKm: positiveNumber("distance", L.distanceKm).optional(),
    durationMin: positiveInt("duration", L.durationMin).optional(),
    targetPace: pace.optional(),
  })
  .refine(
    (e) => e.distanceKm !== undefined || e.durationMin !== undefined || e.targetPace !== undefined,
    { message: "Add a distance, a duration or a pace", path: ["distanceKm"] },
  );

export const workoutStructureSchema = z.discriminatedUnion(
  "kind",
  [strengthStructureSchema, intervalsStructureSchema, enduranceStructureSchema],
  { error: "Unknown workout details" },
);

export type WorkoutStructure = z.infer<typeof workoutStructureSchema>;
export type StrengthStructure = z.infer<typeof strengthStructureSchema>;
export type Exercise = z.infer<typeof exerciseSchema>;
export type IntervalsStructure = z.infer<typeof intervalsStructureSchema>;
export type EnduranceStructure = z.infer<typeof enduranceStructureSchema>;

/**
 * Field errors keyed by dotted path relative to the structure, e.g.
 * `"exercises.0.sets.1.reps"`. Root-level errors use the key `""`.
 * The first message per path wins.
 */
export type StructureErrors = Record<string, string>;

export function structureErrorsFrom(error: z.ZodError): StructureErrors {
  const out: StructureErrors = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".");
    if (!(key in out)) out[key] = issue.message;
  }
  return out;
}

export type ParseStructureResult =
  | { ok: true; structure: WorkoutStructure | null }
  | { ok: false; message: string; errors: StructureErrors };

/**
 * Validate an untrusted structure (already JSON-decoded) against the kind the
 * workout type allows. `null`/`undefined` means "no structure" and is always
 * accepted. A structure for a type without a kind, or of the wrong kind, is
 * rejected.
 */
export function parseStructure(
  raw: unknown,
  expectedKind: StructureKind | null,
): ParseStructureResult {
  if (raw === null || raw === undefined) return { ok: true, structure: null };
  const parsed = workoutStructureSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Check the workout details.",
      errors: structureErrorsFrom(parsed.error),
    };
  }
  if (parsed.data.kind !== expectedKind) {
    const message =
      expectedKind === null
        ? "This workout type doesn't take details."
        : "These details don't match the workout type.";
    return { ok: false, message, errors: { "": message } };
  }
  return { ok: true, structure: parsed.data };
}

// ---------------------------------------------------------------------------
// Summary labels for cards
// ---------------------------------------------------------------------------

function fmtNumber(n: number): string {
  return String(Math.round(n * 100) / 100);
}

function fmtDistanceM(m: number): string {
  return m >= 1000 ? `${fmtNumber(m / 1000)}km` : `${m}m`;
}

function fmtDurationS(s: number): string {
  if (s < 60) return `${s}s`;
  if (s % 60 === 0) return `${s / 60}min`;
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function fmtDurationMin(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

/**
 * A short label for cards, e.g. `3 ex · 12 sets`, `6×800m`, `18 km`.
 */
export function summarize(structure: WorkoutStructure): string {
  switch (structure.kind) {
    case "strength": {
      const ex = structure.exercises.length;
      const sets = structure.exercises.reduce((n, e) => n + e.sets.length, 0);
      return `${ex} ex · ${sets} ${sets === 1 ? "set" : "sets"}`;
    }
    case "intervals": {
      const blocks = structure.repeats.map((r) => {
        const what =
          r.distanceM !== undefined ? fmtDistanceM(r.distanceM) : fmtDurationS(r.durationS ?? 0);
        return `${r.count}×${what}`;
      });
      return blocks.length <= 2 ? blocks.join(" + ") : `${blocks[0]} + ${blocks.length - 1} more`;
    }
    case "endurance": {
      if (structure.distanceKm !== undefined) return `${fmtNumber(structure.distanceKm)} km`;
      if (structure.durationMin !== undefined) return fmtDurationMin(structure.durationMin);
      return `@ ${structure.targetPace}/km`;
    }
  }
}

// ---------------------------------------------------------------------------
// Per-exercise completion (strength only)
// ---------------------------------------------------------------------------

export type ExerciseProgress = { done: number; total: number };

/**
 * How many exercises of a strength structure are ticked off. Null for other
 * kinds (and for no structure), which have nothing to tick.
 */
export function exerciseProgress(
  structure: WorkoutStructure | null | undefined,
): ExerciseProgress | null {
  if (!structure || structure.kind !== "strength") return null;
  return {
    done: structure.exercises.filter((e) => e.done === true).length,
    total: structure.exercises.length,
  };
}

/**
 * Card label with exercise progress: `2/3 ex · 9 sets` once anything is
 * ticked, otherwise exactly `summarize()`.
 */
export function summarizeWithProgress(structure: WorkoutStructure): string {
  const progress = exerciseProgress(structure);
  if (!progress || progress.done === 0) return summarize(structure);
  return summarize(structure).replace(/^\d+ ex/, `${progress.done}/${progress.total} ex`);
}

/**
 * The structure with exercise `index` ticked (`done: true`) or unticked (flag
 * removed). Null when it isn't a strength structure or the index is out of
 * range. Pure; mirrors what `workoutsRepo.setExerciseDone` writes.
 */
export function withExerciseDone(
  structure: WorkoutStructure | null | undefined,
  index: number,
  done: boolean,
): StrengthStructure | null {
  if (!structure || structure.kind !== "strength") return null;
  if (!Number.isInteger(index) || index < 0 || index >= structure.exercises.length) return null;
  return {
    ...structure,
    exercises: structure.exercises.map((e, i) => (i === index ? withDoneFlag(e, done) : e)),
  };
}

/**
 * The same structure with every exercise `done` flag removed. Used wherever a
 * structure becomes a template (plan days) or a fresh workout from one.
 */
export function withoutExerciseDone<T extends WorkoutStructure | null | undefined>(
  structure: T,
): T {
  if (!structure || structure.kind !== "strength") return structure;
  return {
    ...structure,
    exercises: structure.exercises.map((e) => withDoneFlag(e, false)),
  } as T;
}

function fmtSet(s: Exercise["sets"][number]): string {
  return s.weightKg !== undefined ? `${s.reps} @ ${fmtNumber(s.weightKg)} kg` : `${s.reps}`;
}

/**
 * Compact set summary for one exercise: `3 × 5 @ 80 kg` when every set is
 * the same, otherwise runs of equal sets, e.g. `2 × 5 @ 80 kg, 1 × 3 @ 90 kg`.
 */
export function summarizeSets(exercise: Exercise): string {
  const runs: { label: string; count: number }[] = [];
  for (const set of exercise.sets) {
    const label = fmtSet(set);
    const last = runs.at(-1);
    if (last && last.label === label) last.count += 1;
    else runs.push({ label, count: 1 });
  }
  return runs.map((r) => `${r.count} × ${r.label}`).join(", ");
}

export * from "./draft";
