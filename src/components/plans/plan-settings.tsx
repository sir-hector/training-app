"use client";

import { useActionState, useState, useTransition } from "react";
import { Save, Trash2 } from "lucide-react";
import { deletePlan, updatePlan, type PlanFormState } from "@/app/app/plans/actions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { PLAN_MAX_WEEKS } from "@/lib/plan-dates";

const initial: PlanFormState = { status: "idle" };

type Props = {
  planId: string;
  name: string;
  weeks: number;
  /** weekIndex of every plan workout, to warn before shrinking. */
  dayWeekIndexes: number[];
};

/** Rename / resize a plan, or delete it. */
export function PlanSettings({ planId, name, weeks, dayWeekIndexes }: Props) {
  const [state, formAction, pending] = useActionState(updatePlan, initial);
  const [weeksValue, setWeeksValue] = useState(String(weeks));
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, startDelete] = useTransition();
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const errors = state.status === "error" ? state.fieldErrors : undefined;

  const nextWeeks = Number(weeksValue);
  const dropped =
    Number.isInteger(nextWeeks) && nextWeeks >= 1 && nextWeeks < weeks
      ? dayWeekIndexes.filter((w) => w >= nextWeeks).length
      : 0;

  const confirmDelete = () => {
    setDeleteError(null);
    startDelete(async () => {
      // Redirects to the list on success.
      const result = await deletePlan(planId);
      if (!result.ok) setDeleteError(result.message);
    });
  };

  return (
    <form
      action={formAction}
      aria-label="Plan details"
      className="bg-card flex flex-col gap-3 rounded-xl border p-3 sm:p-4"
    >
      <input type="hidden" name="planId" value={planId} />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        {/* Side by side on phones; joins the parent row from sm up. */}
        <div className="grid grid-cols-[minmax(0,1fr)_5.5rem] items-start gap-3 sm:contents">
          <Field data-invalid={errors?.name ? true : undefined} className="sm:flex-1">
            <FieldLabel htmlFor="plan-settings-name">Name</FieldLabel>
            <Input
              id="plan-settings-name"
              name="name"
              required
              maxLength={100}
              defaultValue={name}
              aria-invalid={!!errors?.name}
            />
            {errors?.name && <FieldError>{errors.name}</FieldError>}
          </Field>
          <Field data-invalid={errors?.weeks ? true : undefined} className="sm:w-28">
            <FieldLabel htmlFor="plan-settings-weeks">Weeks</FieldLabel>
            <Input
              id="plan-settings-weeks"
              name="weeks"
              type="number"
              inputMode="numeric"
              min={1}
              max={PLAN_MAX_WEEKS}
              required
              value={weeksValue}
              onChange={(e) => setWeeksValue(e.target.value)}
              aria-invalid={!!errors?.weeks}
            />
            {errors?.weeks && <FieldError>{errors.weeks}</FieldError>}
          </Field>
        </div>
        <div className="flex gap-2 sm:mt-6">
          <Button type="submit" variant="outline" disabled={pending} className="flex-1">
            <Save data-icon="inline-start" />
            {pending ? "Saving…" : "Save"}
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={() => setConfirmOpen(true)}
            disabled={pending || deleting}
            className="flex-1"
          >
            <Trash2 data-icon="inline-start" />
            Delete
          </Button>
        </div>
      </div>
      {dropped > 0 && (
        <p role="status" className="text-destructive text-xs">
          Saving removes {dropped} workout{dropped === 1 ? "" : "s"} from weeks {nextWeeks + 1}–
          {weeks}.
        </p>
      )}
      {state.status === "error" && !errors && (
        <p role="alert" className="text-destructive text-sm">
          {state.message}
        </p>
      )}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this plan?</AlertDialogTitle>
            <AlertDialogDescription>
              {`"${name}" and its workouts will be deleted. Workouts already applied to your calendar stay. This can't be undone.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteError && (
            <p role="alert" className="text-destructive text-sm">
              {deleteError}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={confirmDelete} disabled={deleting}>
              {deleting ? "Deleting…" : "Delete plan"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </form>
  );
}
