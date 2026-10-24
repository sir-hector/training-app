import { z } from "zod";

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

export * from "./draft";
