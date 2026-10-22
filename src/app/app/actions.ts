"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/auth";
import { WORKOUT_TYPES } from "@/lib/workout-types";
import { workoutsRepo } from "@/lib/workouts-repo";

const createWorkoutSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date"),
  type: z.enum(WORKOUT_TYPES, { message: "Pick a workout type" }),
  notes: z.string().trim().max(2000, "Notes are too long").optional(),
});

export type CreateWorkoutState =
  | { status: "idle" }
  | {
      status: "error";
      message: string;
      fieldErrors?: Partial<Record<"date" | "type" | "notes", string>>;
    }
  | { status: "success"; workoutId: string };

export async function createWorkout(
  _prev: CreateWorkoutState,
  formData: FormData,
): Promise<CreateWorkoutState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { status: "error", message: "You must be signed in." };
  }

  const parsed = createWorkoutSchema.safeParse({
    date: formData.get("date"),
    type: formData.get("type"),
    notes: formData.get("notes") ?? undefined,
  });
  if (!parsed.success) {
    const flat = z.flattenError(parsed.error);
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors: {
        date: flat.fieldErrors.date?.[0],
        type: flat.fieldErrors.type?.[0],
        notes: flat.fieldErrors.notes?.[0],
      },
    };
  }

  const workout = await workoutsRepo.create(session.user.id, parsed.data);
  revalidatePath("/app");
  return { status: "success", workoutId: workout.id };
}
