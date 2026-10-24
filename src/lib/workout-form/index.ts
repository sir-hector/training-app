import { z } from "zod";
import {
  parseStructure,
  type StructureErrors,
  type WorkoutStructure,
} from "@/lib/workout-structure";
import { structureKindOf, type WorkoutType } from "@/lib/workout-types";

/**
 * Server-side parsing shared by every form that edits a workout's fields
 * (type, notes, structure): calendar workouts and plan-day workouts. Pure:
 * no I/O, so server actions stay thin.
 */

/** First error per form field, plus "structure" for the hidden JSON field. */
export type WorkoutFieldErrors = Partial<Record<string, string>>;

export type WorkoutFormError = {
  status: "error";
  message: string;
  fieldErrors?: WorkoutFieldErrors;
  /** Per-input errors inside the structure editor, keyed by path. */
  structureErrors?: StructureErrors;
};

export type ParsedWorkoutForm<T> =
  | { ok: true; data: T & { structure: WorkoutStructure | null } }
  | { ok: false; error: WorkoutFormError };

function fieldErrorsFrom(error: z.ZodError): WorkoutFieldErrors {
  const flat = z.flattenError(error);
  const out: WorkoutFieldErrors = {};
  for (const [key, messages] of Object.entries(flat.fieldErrors)) {
    const first = (messages as string[] | undefined)?.[0];
    if (first) out[key] = first;
  }
  return out;
}

/**
 * Validate the base fields with `schema`, then the hidden `structure` JSON
 * field against the type's `structureKind`. Missing or empty structure means
 * none (the dialogs always send the field, so an edit can clear it).
 */
export function parseWorkoutForm<S extends z.ZodType<{ type: WorkoutType; notes?: string }>>(
  schema: S,
  input: Record<string, unknown>,
  rawStructure: FormDataEntryValue | null,
): ParsedWorkoutForm<z.infer<S>> {
  const parsed = schema.safeParse(input);
  const fieldErrors: WorkoutFieldErrors = parsed.success ? {} : fieldErrorsFrom(parsed.error);

  let structureJson: unknown = null;
  let structureErrors: StructureErrors | undefined;
  if (typeof rawStructure === "string" && rawStructure.trim() !== "") {
    try {
      structureJson = JSON.parse(rawStructure);
    } catch {
      fieldErrors.structure = "Workout details are malformed.";
    }
  }

  let structure: WorkoutStructure | null = null;
  // Only check structure against the type once the type itself is valid.
  if (parsed.success && !fieldErrors.structure) {
    const result = parseStructure(structureJson, structureKindOf(parsed.data.type));
    if (result.ok) {
      structure = result.structure;
    } else {
      fieldErrors.structure = result.message;
      structureErrors = result.errors;
    }
  }

  if (!parsed.success || fieldErrors.structure) {
    return {
      ok: false,
      error: {
        status: "error",
        message: "Please fix the highlighted fields.",
        fieldErrors,
        structureErrors,
      },
    };
  }
  return { ok: true, data: { ...parsed.data, structure } };
}
