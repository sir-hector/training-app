"use client";

import { useActionState, useState, useTransition } from "react";
import { format, parseISO } from "date-fns";
import { Check, CircleCheck, Plus, RotateCcw, Save, Trash2 } from "lucide-react";
import {
  createWorkout,
  deleteWorkout,
  setWorkoutDone,
  updateWorkout,
  type CreateWorkoutState,
} from "@/app/app/actions";
import type { Workout } from "@/db/schema";
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
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { useWorkoutFields, WorkoutFields } from "@/components/workout-form/workout-fields";
import { workoutStructureSchema } from "@/lib/workout-structure";
import { cn } from "@/lib/utils";
import { WORKOUT_TYPE_META, type WorkoutType } from "@/lib/workout-types";

const initial: CreateWorkoutState = { status: "idle" };

/** The structure the card should show while the save is in flight. */
function optimisticStructure(raw: FormDataEntryValue | null, fallback: Workout["structure"]) {
  if (typeof raw !== "string") return fallback;
  try {
    const value: unknown = JSON.parse(raw);
    if (value === null) return null;
    const parsed = workoutStructureSchema.safeParse(value);
    return parsed.success ? parsed.data : fallback;
  } catch {
    return fallback;
  }
}

export type OptimisticChange =
  { kind: "update"; workout: Workout } | { kind: "delete"; id: string };

type Props = {
  /** "YYYY-MM-DD" of the cell that opened the dialog (create mode). */
  dateIso: string;
  /** Present in edit mode. */
  workout?: Workout;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called inside a transition so the cell can reflect the change at once. */
  onOptimistic: (change: OptimisticChange) => void;
};

/**
 * Add or edit a workout. The parent remounts this per opening (via `key`),
 * so form state never leaks between openings.
 */
export function WorkoutDialog({ dateIso, workout, open, onOpenChange, onOptimistic }: Props) {
  const editing = workout !== undefined;
  const fields = useWorkoutFields(
    workout ? { type: workout.type, structure: workout.structure } : undefined,
  );
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, startDelete] = useTransition();
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [state, formAction, pending] = useActionState(
    async (prev: CreateWorkoutState, formData: FormData) => {
      if (workout) {
        onOptimistic({
          kind: "update",
          workout: {
            ...workout,
            date: String(formData.get("date") ?? workout.date),
            type: (formData.get("type") as WorkoutType) ?? workout.type,
            notes: String(formData.get("notes") ?? "").trim() || null,
            structure: optimisticStructure(formData.get("structure"), workout.structure),
          },
        });
      }
      const result = await (workout ? updateWorkout : createWorkout)(prev, formData);
      if (result.status === "success") onOpenChange(false);
      return result;
    },
    initial,
  );

  const confirmDelete = () => {
    if (!workout) return;
    setDeleteError(null);
    startDelete(async () => {
      onOptimistic({ kind: "delete", id: workout.id });
      const result = await deleteWorkout(workout.id);
      if (result.ok) {
        setConfirmOpen(false);
        onOpenChange(false);
      } else {
        setDeleteError(result.message);
      }
    });
  };

  // Mark done / not done straight from the dialog: the obvious place on every
  // device, since the card's own toggle is small (and hover-only on desktop).
  const [toggling, startToggle] = useTransition();
  const [toggleError, setToggleError] = useState<string | null>(null);
  const toggleDone = () => {
    if (!workout) return;
    const next = !workout.done;
    setToggleError(null);
    startToggle(async () => {
      onOptimistic({
        kind: "update",
        workout: { ...workout, done: next, completedAt: next ? new Date() : null },
      });
      const result = await setWorkoutDone(workout.id, next);
      if (result.ok) onOpenChange(false);
      else setToggleError(result.message);
    });
  };

  const errors = state.status === "error" ? state.fieldErrors : undefined;
  const structureErrors = state.status === "error" ? state.structureErrors : undefined;
  const busy = pending || deleting || toggling;
  const displayDate = workout?.date ?? dateIso;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] grid-rows-[auto_minmax(0,1fr)_auto] transition-[scale,opacity] data-[nested-dialog-open]:scale-95 data-[nested-dialog-open]:opacity-40 sm:max-w-md">
        <form action={formAction} className="contents">
          {workout && <input type="hidden" name="workoutId" value={workout.id} />}
          {!editing && <input type="hidden" name="date" value={dateIso} />}
          <input type="hidden" name="structure" value={fields.structureJson} />
          <DialogHeader>
            <DialogTitle>{editing ? "Edit workout" : "Add workout"}</DialogTitle>
            <DialogDescription>
              {format(parseISO(displayDate), "EEEE, d MMMM yyyy")}
            </DialogDescription>
          </DialogHeader>

          {/* Only the body scrolls, so header and actions stay visible on small screens. */}
          <div className="-mx-4 flex min-h-0 flex-col gap-4 overflow-y-auto px-4 py-0.5">
            {workout && (
              <div
                data-slot="workout-status"
                className={cn(
                  "flex items-center justify-between gap-3 rounded-lg border px-3 py-2",
                  workout.done && "bg-muted",
                )}
              >
                <div className="flex min-w-0 items-center gap-2 text-sm">
                  {workout.done ? (
                    <CircleCheck className="text-brand size-4 shrink-0" aria-hidden />
                  ) : (
                    <span className="size-4 shrink-0 rounded-full border-2" aria-hidden />
                  )}
                  <span className="truncate">
                    {workout.done
                      ? workout.completedAt
                        ? `Done on ${format(new Date(workout.completedAt), "d MMM")}`
                        : "Done"
                      : "Planned"}
                  </span>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant={workout.done ? "ghost" : "outline"}
                  onClick={toggleDone}
                  disabled={busy}
                >
                  {workout.done ? (
                    <RotateCcw data-icon="inline-start" />
                  ) : (
                    <Check data-icon="inline-start" />
                  )}
                  {toggling ? "Saving…" : workout.done ? "Mark as not done" : "Mark as done"}
                </Button>
              </div>
            )}
            {toggleError && (
              <p role="alert" className="text-destructive text-sm">
                {toggleError}
              </p>
            )}
            <FieldGroup>
              {editing && (
                <Field data-invalid={errors?.date ? true : undefined}>
                  <FieldLabel htmlFor="workout-date">Date</FieldLabel>
                  <input
                    id="workout-date"
                    name="date"
                    type="date"
                    required
                    defaultValue={workout.date}
                    aria-invalid={!!errors?.date}
                    className="border-input focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:border-destructive dark:bg-input/30 h-8 w-full rounded-lg border bg-transparent px-2.5 text-sm outline-none focus-visible:ring-3"
                  />
                  {errors?.date && <FieldError>{errors.date}</FieldError>}
                </Field>
              )}

              <WorkoutFields
                idPrefix="workout"
                fields={fields}
                defaultNotes={workout?.notes}
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
                Delete
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
                {pending ? "Saving…" : editing ? "Save changes" : "Add workout"}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>

      {workout && (
        <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this workout?</AlertDialogTitle>
              <AlertDialogDescription>
                {`${WORKOUT_TYPE_META[workout.type].label} on ${format(parseISO(workout.date), "d MMMM yyyy")} will be removed. This can't be undone.`}
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
                {deleting ? "Deleting…" : "Delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </Dialog>
  );
}
