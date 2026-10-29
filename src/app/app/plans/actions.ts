"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { auth } from "@/auth";
import { isMonday, monthOf, planDateRange } from "@/lib/plan-dates";
import { PLAN_MAX_WEEKS, plansRepo } from "@/lib/plans-repo";
import { parseWorkoutForm, type WorkoutFormError } from "@/lib/workout-form";
import { WORKOUT_TYPES } from "@/lib/workout-types";

const NOT_SIGNED_IN = "You must be signed in.";

async function currentUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}

// ---------------------------------------------------------------------------
// Plans
// ---------------------------------------------------------------------------

const planFieldsSchema = z.object({
  name: z.string().trim().min(1, "Give the plan a name").max(100, "Name is too long"),
  weeks: z.coerce
    .number({ message: "Enter the number of weeks" })
    .int("Weeks must be a whole number")
    .min(1, "At least 1 week")
    .max(PLAN_MAX_WEEKS, `At most ${PLAN_MAX_WEEKS} weeks`),
});

export type PlanFormState =
  | { status: "idle" }
  | {
      status: "error";
      message: string;
      fieldErrors?: Partial<Record<"name" | "weeks", string>>;
    }
  | { status: "success" };

function planFieldErrors(error: z.ZodError<z.infer<typeof planFieldsSchema>>): PlanFormState {
  const flat = z.flattenError(error);
  return {
    status: "error",
    message: "Please fix the highlighted fields.",
    fieldErrors: { name: flat.fieldErrors.name?.[0], weeks: flat.fieldErrors.weeks?.[0] },
  };
}

/** Create a plan, then open its editor. */
export async function createPlan(_prev: PlanFormState, formData: FormData): Promise<PlanFormState> {
  const userId = await currentUserId();
  if (!userId) return { status: "error", message: NOT_SIGNED_IN };

  const parsed = planFieldsSchema.safeParse({
    name: formData.get("name"),
    weeks: formData.get("weeks"),
  });
  if (!parsed.success) return planFieldErrors(parsed.error);

  const plan = await plansRepo.create(userId, parsed.data);
  revalidatePath("/app/plans");
  redirect(`/app/plans/${plan.id}`);
}

/** Rename and/or resize a plan. Shrinking drops the workouts in removed weeks. */
export async function updatePlan(_prev: PlanFormState, formData: FormData): Promise<PlanFormState> {
  const userId = await currentUserId();
  if (!userId) return { status: "error", message: NOT_SIGNED_IN };

  const planId = z.uuid().safeParse(formData.get("planId"));
  if (!planId.success) return { status: "error", message: "Invalid request." };
  const parsed = planFieldsSchema.safeParse({
    name: formData.get("name"),
    weeks: formData.get("weeks"),
  });
  if (!parsed.success) return planFieldErrors(parsed.error);

  const updated = await plansRepo.update(userId, planId.data, parsed.data);
  if (!updated) return { status: "error", message: "Plan not found." };

  revalidatePath("/app/plans");
  revalidatePath(`/app/plans/${updated.id}`);
  return { status: "success" };
}

export type ActionResult = { ok: true } | { ok: false; message: string };

/** Delete a plan (and its workouts), then go back to the list. */
export async function deletePlan(planId: string): Promise<ActionResult> {
  const userId = await currentUserId();
  if (!userId) return { ok: false, message: NOT_SIGNED_IN };

  const parsed = z.uuid().safeParse(planId);
  if (!parsed.success) return { ok: false, message: "Invalid request." };

  const deleted = await plansRepo.delete(userId, parsed.data);
  if (!deleted) return { ok: false, message: "Plan not found." };

  revalidatePath("/app/plans");
  redirect("/app/plans");
}

// ---------------------------------------------------------------------------
// Plan days (the workouts inside a plan)
// ---------------------------------------------------------------------------

const planDayFieldsSchema = z.object({
  type: z.enum(WORKOUT_TYPES, { message: "Pick a workout type" }),
  notes: z.string().trim().max(2000, "Notes are too long").optional(),
});

const addPlanDaySchema = planDayFieldsSchema.extend({
  planId: z.uuid(),
  weekIndex: z.coerce
    .number()
    .int()
    .min(0)
    .max(PLAN_MAX_WEEKS - 1),
  dayOfWeek: z.coerce.number().int().min(0).max(6),
});

const updatePlanDaySchema = planDayFieldsSchema.extend({
  planId: z.uuid(),
  dayId: z.uuid(),
});

export type PlanDayFormState =
  { status: "idle" } | WorkoutFormError | { status: "success"; dayId: string };

/** Add a workout to a plan day, or edit one when `dayId` is present. */
export async function savePlanDay(
  _prev: PlanDayFormState,
  formData: FormData,
): Promise<PlanDayFormState> {
  const userId = await currentUserId();
  if (!userId) return { status: "error", message: NOT_SIGNED_IN };

  const base = { type: formData.get("type"), notes: formData.get("notes") ?? undefined };
  const rawStructure = formData.get("structure");

  if (formData.get("dayId")) {
    const parsed = parseWorkoutForm(
      updatePlanDaySchema,
      { ...base, planId: formData.get("planId"), dayId: formData.get("dayId") },
      rawStructure,
    );
    if (!parsed.ok) return parsed.error;
    const { planId, dayId, type, notes, structure } = parsed.data;
    const updated = await plansRepo.updateDay(userId, dayId, {
      type,
      notes: notes ?? null,
      structure,
    });
    if (!updated) return { status: "error", message: "Workout not found." };
    revalidatePath(`/app/plans/${planId}`);
    return { status: "success", dayId: updated.id };
  }

  const parsed = parseWorkoutForm(
    addPlanDaySchema,
    {
      ...base,
      planId: formData.get("planId"),
      weekIndex: formData.get("weekIndex"),
      dayOfWeek: formData.get("dayOfWeek"),
    },
    rawStructure,
  );
  if (!parsed.ok) return parsed.error;
  const { planId, ...input } = parsed.data;
  const created = await plansRepo.addDay(userId, planId, input);
  if (!created) return { status: "error", message: "Plan not found." };
  revalidatePath(`/app/plans/${planId}`);
  revalidatePath("/app/plans");
  return { status: "success", dayId: created.id };
}

const removePlanDaySchema = z.object({ planId: z.uuid(), dayId: z.uuid() });

export async function removePlanDay(planId: string, dayId: string): Promise<ActionResult> {
  const userId = await currentUserId();
  if (!userId) return { ok: false, message: NOT_SIGNED_IN };

  const parsed = removePlanDaySchema.safeParse({ planId, dayId });
  if (!parsed.success) return { ok: false, message: "Invalid request." };

  const removed = await plansRepo.removeDay(userId, parsed.data.dayId);
  if (!removed) return { ok: false, message: "Workout not found." };

  revalidatePath(`/app/plans/${parsed.data.planId}`);
  revalidatePath("/app/plans");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Apply to calendar
// ---------------------------------------------------------------------------

const applyPlanSchema = z.object({
  planId: z.uuid(),
  startMonday: z.string().refine(isMonday, "Pick a Monday to start on"),
});

function applyInputError(error: z.ZodError<z.infer<typeof applyPlanSchema>>): string {
  return z.flattenError(error).fieldErrors.startMonday?.[0] ?? "Invalid request.";
}

export type ApplyPlanPreview =
  | {
      ok: true;
      /** Plan workouts that would be added. */
      toAdd: number;
      /** Plan workouts already on the calendar (same date and type); skipped. */
      skipped: number;
      /** Other existing workouts in the plan's weeks; left as they are. */
      untouched: number;
    }
  | { ok: false; message: string };

/** Read-only: what applying the plan from `startMonday` would add and skip. */
export async function previewApplyPlan(
  planId: string,
  startMonday: string,
): Promise<ApplyPlanPreview> {
  const userId = await currentUserId();
  if (!userId) return { ok: false, message: NOT_SIGNED_IN };

  const parsed = applyPlanSchema.safeParse({ planId, startMonday });
  if (!parsed.success) return { ok: false, message: applyInputError(parsed.error) };

  const preview = await plansRepo.previewApply(userId, parsed.data.planId, parsed.data.startMonday);
  if (!preview) return { ok: false, message: "Plan not found." };
  const { toAdd, skipped, untouched } = preview;
  return { ok: true, toAdd, skipped, untouched };
}

export type ApplyPlanResult =
  | {
      ok: true;
      /** Workouts added to the calendar. */
      created: number;
      /** Plan workouts skipped because they were already on the calendar. */
      skipped: number;
      /** First and last day the plan covers, "YYYY-MM-DD". */
      from: string;
      to: string;
      /** "YYYY-MM" of the start, for linking to the calendar. */
      month: string;
    }
  | { ok: false; message: string };

/**
 * Stamp the plan onto the calendar from `startMonday`, skipping workouts
 * already there. All or nothing.
 */
export async function applyPlan(planId: string, startMonday: string): Promise<ApplyPlanResult> {
  const userId = await currentUserId();
  if (!userId) return { ok: false, message: NOT_SIGNED_IN };

  const parsed = applyPlanSchema.safeParse({ planId, startMonday });
  if (!parsed.success) return { ok: false, message: applyInputError(parsed.error) };

  const plan = await plansRepo.findById(userId, parsed.data.planId);
  if (!plan) return { ok: false, message: "Plan not found." };
  if (plan.days.length === 0) return { ok: false, message: "Add a workout to the plan first." };

  const result = await plansRepo.applyToCalendar(userId, plan.id, parsed.data.startMonday);
  if (!result) return { ok: false, message: "Plan not found." };

  if (result.created > 0) {
    revalidatePath("/app");
    revalidatePath("/app/stats");
  }
  const range = planDateRange(parsed.data.startMonday, plan.weeks);
  return { ok: true, ...result, ...range, month: monthOf(parsed.data.startMonday) };
}
