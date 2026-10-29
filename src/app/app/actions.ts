"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/auth";
import type { Workout } from "@/db/schema";
import { parseWorkoutForm, type WorkoutFormError } from "@/lib/workout-form";
import { WORKOUT_TYPES } from "@/lib/workout-types";
import { workoutsRepo } from "@/lib/workouts-repo";

const createWorkoutSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date"),
  type: z.enum(WORKOUT_TYPES, { message: "Pick a workout type" }),
  notes: z.string().trim().max(2000, "Notes are too long").optional(),
});

const updateWorkoutSchema = createWorkoutSchema.extend({
  workoutId: z.uuid(),
});

export type CreateWorkoutState =
  { status: "idle" } | WorkoutFormError | { status: "success"; workoutId: string };

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
  if (!parsed.ok) return parsed.error;

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

const setExerciseDoneSchema = z.object({
  workoutId: z.uuid(),
  exerciseIndex: z.number().int().nonnegative(),
  done: z.boolean(),
});

export type SetExerciseDoneResult = { ok: true; workout: Workout } | { ok: false; message: string };

/**
 * Tick one exercise of a strength workout off (or back on). Ticking the last
 * one marks the workout done; unticking any marks it not done.
 */
export async function setExerciseDone(
  workoutId: string,
  exerciseIndex: number,
  done: boolean,
): Promise<SetExerciseDoneResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, message: "You must be signed in." };
  }

  const parsed = setExerciseDoneSchema.safeParse({ workoutId, exerciseIndex, done });
  if (!parsed.success) {
    return { ok: false, message: "Invalid request." };
  }

  const updated = await workoutsRepo.setExerciseDone(
    session.user.id,
    parsed.data.workoutId,
    parsed.data.exerciseIndex,
    parsed.data.done,
  );
  if (!updated) {
    return { ok: false, message: "Exercise not found." };
  }

  revalidatePath("/app");
  return { ok: true, workout: updated };
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
  if (!parsed.ok) return parsed.error;

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
