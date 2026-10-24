"use client";

import { useActionState, useState, useTransition } from "react";
import { Plus, Save, Trash2 } from "lucide-react";
import { removePlanDay, savePlanDay, type PlanDayFormState } from "@/app/app/plans/actions";
import type { PlanDay } from "@/db/schema";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FieldGroup } from "@/components/ui/field";
import { useWorkoutFields, WorkoutFields } from "@/components/workout-form/workout-fields";
import { WORKOUT_TYPE_META } from "@/lib/workout-types";
import { dayName } from "./weekdays";

const initial: PlanDayFormState = { status: "idle" };

type Props = {
  planId: string;
  weekIndex: number;
  dayOfWeek: number;
  /** Present in edit mode. */
  day?: PlanDay;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/**
 * Add or edit a workout inside a plan: the same fields as a calendar workout
 * (type, notes, structure). The parent remounts this per opening via `key`.
 */
export function PlanDayDialog({ planId, weekIndex, dayOfWeek, day, open, onOpenChange }: Props) {
  const editing = day !== undefined;
  const fields = useWorkoutFields(day ? { type: day.type, structure: day.structure } : undefined);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, startDelete] = useTransition();
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [state, formAction, pending] = useActionState(
    async (prev: PlanDayFormState, formData: FormData) => {
      const result = await savePlanDay(prev, formData);
      if (result.status === "success") onOpenChange(false);
      return result;
    },
    initial,
  );

  const confirmDelete = () => {
    if (!day) return;
    setDeleteError(null);
    startDelete(async () => {
      const result = await removePlanDay(planId, day.id);
      if (result.ok) {
        setConfirmOpen(false);
        onOpenChange(false);
      } else {
        setDeleteError(result.message);
      }
    });
  };

  const errors = state.status === "error" ? state.fieldErrors : undefined;
  const structureErrors = state.status === "error" ? state.structureErrors : undefined;
  const busy = pending || deleting;
  const when = `Week ${weekIndex + 1} · ${dayName(dayOfWeek)}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] grid-rows-[auto_minmax(0,1fr)_auto] transition-[scale,opacity] data-[nested-dialog-open]:scale-95 data-[nested-dialog-open]:opacity-40 sm:max-w-md">
        <form action={formAction} className="contents">
          <input type="hidden" name="planId" value={planId} />
          {day ? (
            <input type="hidden" name="dayId" value={day.id} />
          ) : (
            <>
              <input type="hidden" name="weekIndex" value={weekIndex} />
              <input type="hidden" name="dayOfWeek" value={dayOfWeek} />
            </>
          )}
          <input type="hidden" name="structure" value={fields.structureJson} />
          <DialogHeader>
            <DialogTitle>{editing ? "Edit plan workout" : "Add plan workout"}</DialogTitle>
            <DialogDescription>{when}</DialogDescription>
          </DialogHeader>

          {/* Only the body scrolls, so header and actions stay visible on small screens. */}
          <div className="-mx-4 flex min-h-0 flex-col gap-4 overflow-y-auto px-4 py-0.5">
            <FieldGroup>
              <WorkoutFields
                idPrefix="plan-day"
                fields={fields}
                defaultNotes={day?.notes}
                errors={errors}
                structureErrors={structureErrors}
                disabled={busy}
              />
            </FieldGroup>
            {state.status === "error" && !errors && (
              <p role="alert" className="text-destructive text-sm">
                {state.message}
              </p>
            )}
          </div>

          <DialogFooter className="sm:justify-between">
            {editing ? (
              <Button
                type="button"
                variant="destructive"
                onClick={() => setConfirmOpen(true)}
                disabled={busy}
              >
                <Trash2 data-icon="inline-start" />
                Remove
              </Button>
            ) : (
              <span className="hidden sm:block" />
            )}
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
                disabled={busy}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={busy || !fields.type}>
                {editing ? <Save data-icon="inline-start" /> : <Plus data-icon="inline-start" />}
                {pending ? "Saving…" : editing ? "Save changes" : "Add to plan"}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>

      {day && (
        <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove this plan workout?</AlertDialogTitle>
              <AlertDialogDescription>
                {`${WORKOUT_TYPE_META[day.type].label} on ${when} will be removed from the plan. Workouts already on your calendar stay.`}
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
                {deleting ? "Removing…" : "Remove"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </Dialog>
  );
}
