"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/auth";
import {
  parseStructure,
  type StructureErrors,
  type WorkoutStructure,
} from "@/lib/workout-structure";
import { WORKOUT_TYPES, structureKindOf } from "@/lib/workout-types";
import { workoutsRepo } from "@/lib/workouts-repo";

const createWorkoutSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date"),
  type: z.enum(WORKOUT_TYPES, { message: "Pick a workout type" }),
  notes: z.string().trim().max(2000, "Notes are too long").optional(),
});

const updateWorkoutSchema = createWorkoutSchema.extend({
  workoutId: z.uuid(),
});

type FieldName = "date" | "type" | "notes" | "structure";
type FieldErrors = Partial<Record<FieldName, string>>;

function fieldErrorsFrom<T extends { date: unknown; type: unknown; notes?: unknown }>(
  error: z.ZodError<T>,
): FieldErrors {
  const flat = z.flattenError(error);
  return {
    date: flat.fieldErrors.date?.[0],
    type: flat.fieldErrors.type?.[0],
    notes: flat.fieldErrors.notes?.[0],
  };
}

export type CreateWorkoutState =
  | { status: "idle" }
  | {
      status: "error";
      message: string;
      fieldErrors?: FieldErrors;
      /** Per-input errors inside the structure editor, keyed by path. */
      structureErrors?: StructureErrors;
    }
  | { status: "success"; workoutId: string };

type ParsedForm<T> =
  | { ok: true; data: T & { structure: WorkoutStructure | null } }
  | { ok: false; state: CreateWorkoutState };

/**
 * Validate the base fields with `schema`, then the hidden `structure` JSON
 * field against the type's `structureKind`. Missing or empty structure means
 * none (the dialog always sends the field, so an edit can clear it).
 */
function parseWorkoutForm<
  S extends z.ZodType<{ date: string; type: (typeof WORKOUT_TYPES)[number]; notes?: string }>,
>(
  schema: S,
  input: Record<string, unknown>,
  rawStructure: FormDataEntryValue | null,
): ParsedForm<z.infer<S>> {
  const parsed = schema.safeParse(input);
  const fieldErrors: FieldErrors = parsed.success ? {} : fieldErrorsFrom(parsed.error);

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
      state: {
        status: "error",
        message: "Please fix the highlighted fields.",
        fieldErrors,
        structureErrors,
      },
    };
  }
  return { ok: true, data: { ...parsed.data, structure } };
}

export async function createWorkout(
  _prev: CreateWorkoutState,
  formData: FormData,
): Promise<CreateWorkoutState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { status: "error", message: "You must be signed in." };
  }

  const parsed = parseWorkoutForm(
    createWorkoutSchema,
    {
      date: formData.get("date"),
      type: formData.get("type"),
      notes: formData.get("notes") ?? undefined,
    },
    formData.get("structure"),
  );
  if (!parsed.ok) return parsed.state;

  const workout = await workoutsRepo.create(session.user.id, parsed.data);
  revalidatePath("/app");
  return { status: "success", workoutId: workout.id };
}

const setDoneSchema = z.object({
  workoutId: z.uuid(),
  done: z.boolean(),
});

export type SetDoneResult = { ok: true; done: boolean } | { ok: false; message: string };

export async function setWorkoutDone(workoutId: string, done: boolean): Promise<SetDoneResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, message: "You must be signed in." };
  }

  const parsed = setDoneSchema.safeParse({ workoutId, done });
  if (!parsed.success) {
    return { ok: false, message: "Invalid request." };
  }

  const updated = await workoutsRepo.setDone(
    session.user.id,
    parsed.data.workoutId,
    parsed.data.done,
  );
  if (!updated) {
    return { ok: false, message: "Workout not found." };
  }

  revalidatePath("/app");
  return { ok: true, done: updated.done };
}

/** Same state shape as create so the dialog can use either action. */
export async function updateWorkout(
  _prev: CreateWorkoutState,
  formData: FormData,
): Promise<CreateWorkoutState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { status: "error", message: "You must be signed in." };
  }

  const parsed = parseWorkoutForm(
    updateWorkoutSchema,
    {
      workoutId: formData.get("workoutId"),
      date: formData.get("date"),
      type: formData.get("type"),
      notes: formData.get("notes") ?? undefined,
    },
    formData.get("structure"),
  );
  if (!parsed.ok) return parsed.state;

  const { workoutId, ...patch } = parsed.data;
  const updated = await workoutsRepo.update(session.user.id, workoutId, {
    ...patch,
    notes: patch.notes ?? null,
  });
  if (!updated) {
    return { status: "error", message: "Workout not found." };
  }

  revalidatePath("/app");
  return { status: "success", workoutId: updated.id };
}

export type DeleteWorkoutResult = { ok: true } | { ok: false; message: string };

export async function deleteWorkout(workoutId: string): Promise<DeleteWorkoutResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, message: "You must be signed in." };
  }

  const parsed = z.uuid().safeParse(workoutId);
  if (!parsed.success) {
    return { ok: false, message: "Invalid request." };
  }

  const deleted = await workoutsRepo.delete(session.user.id, parsed.data);
  if (!deleted) {
    return { ok: false, message: "Workout not found." };
  }

  revalidatePath("/app");
  return { ok: true };
}
