"use client";

import { useActionState, useState, useTransition } from "react";
import { format, parseISO } from "date-fns";
import { Plus, Save, Trash2 } from "lucide-react";
import {
  createWorkout,
  deleteWorkout,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { StructureEditor } from "@/components/workout-structure/structure-editor";
import {
  draftFromStructure,
  isDraftEmpty,
  structureFromDraft,
  workoutStructureSchema,
  type StructureDraft,
} from "@/lib/workout-structure";
import {
  WORKOUT_TYPES,
  WORKOUT_TYPE_META,
  structureKindOf,
  type WorkoutType,
} from "@/lib/workout-types";

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

// Lets the select trigger show "Long run" rather than the raw "long_run".
const TYPE_ITEMS = WORKOUT_TYPES.map((t) => ({ value: t, label: WORKOUT_TYPE_META[t].label }));

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
  const [type, setType] = useState<WorkoutType | null>(workout?.type ?? null);
  const [draft, setDraft] = useState<StructureDraft | null>(() =>
    workout?.structure ? draftFromStructure(workout.structure) : null,
  );
  // Explains why details disappeared after switching to an incompatible type.
  const [notice, setNotice] = useState<string | null>(null);
  const structureKind = type ? structureKindOf(type) : null;

  const changeType = (next: WorkoutType | null) => {
    const nextKind = next ? structureKindOf(next) : null;
    if (draft && draft.kind !== nextKind && type) {
      setDraft(null);
      if (!isDraftEmpty(draft))
        setNotice(
          `${WORKOUT_TYPE_META[type].label} details were removed: ${
            next ? WORKOUT_TYPE_META[next].label : "this type"
          } ${nextKind ? "uses a different format" : "doesn't take details"}.`,
        );
    }
    setType(next);
  };
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

  const errors = state.status === "error" ? state.fieldErrors : undefined;
  const structureErrors = state.status === "error" ? state.structureErrors : undefined;
  const structureJson = JSON.stringify(structureFromDraft(structureKind ? draft : null));
  const busy = pending || deleting;
  const displayDate = workout?.date ?? dateIso;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] grid-rows-[auto_minmax(0,1fr)_auto] transition-[scale,opacity] data-[nested-dialog-open]:scale-95 data-[nested-dialog-open]:opacity-40 sm:max-w-md">
        <form action={formAction} className="contents">
          {workout && <input type="hidden" name="workoutId" value={workout.id} />}
          {!editing && <input type="hidden" name="date" value={dateIso} />}
          <input type="hidden" name="structure" value={structureJson} />
          <DialogHeader>
            <DialogTitle>{editing ? "Edit workout" : "Add workout"}</DialogTitle>
            <DialogDescription>
              {format(parseISO(displayDate), "EEEE, d MMMM yyyy")}
            </DialogDescription>
          </DialogHeader>

          {/* Only the body scrolls, so header and actions stay visible on small screens. */}
          <div className="-mx-4 flex min-h-0 flex-col gap-4 overflow-y-auto px-4 py-0.5">
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

              <Field data-invalid={errors?.type ? true : undefined}>
                <FieldLabel htmlFor="workout-type">Type</FieldLabel>
                <Select
                  items={TYPE_ITEMS}
                  name="type"
                  value={type}
                  onValueChange={(v) => changeType(v as WorkoutType | null)}
                  required
                >
                  <SelectTrigger id="workout-type" aria-invalid={!!errors?.type}>
                    <SelectValue placeholder="Pick a type" />
                  </SelectTrigger>
                  <SelectContent>
                    {WORKOUT_TYPES.map((t) => {
                      const Icon = WORKOUT_TYPE_META[t].icon;
                      return (
                        <SelectItem key={t} value={t}>
                          <Icon className="size-4" aria-hidden />
                          {WORKOUT_TYPE_META[t].label}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
                {errors?.type && <FieldError>{errors.type}</FieldError>}
              </Field>

              <Field data-invalid={errors?.notes ? true : undefined}>
                <FieldLabel htmlFor="workout-notes">Notes</FieldLabel>
                <Textarea
                  id="workout-notes"
                  name="notes"
                  placeholder="e.g. 5 × 1000m @ 4:00, 90s rest"
                  rows={3}
                  maxLength={2000}
                  defaultValue={workout?.notes ?? ""}
                />
                {errors?.notes && <FieldError>{errors.notes}</FieldError>}
              </Field>

              {structureKind ? (
                <div className="flex flex-col gap-2">
                  <StructureEditor
                    kind={structureKind}
                    value={draft}
                    onChange={(next) => {
                      setDraft(next);
                      setNotice(null);
                    }}
                    errors={structureErrors}
                    notice={notice}
                    disabled={busy}
                  />
                  {errors?.structure && !structureErrors?.[""] && (
                    <FieldError>{errors.structure}</FieldError>
                  )}
                </div>
              ) : (
                notice && (
                  <p
                    role="status"
                    className="text-muted-foreground bg-muted rounded-md px-2.5 py-1.5 text-xs"
                  >
                    {notice}
                  </p>
                )
              )}
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
              <Button type="submit" disabled={busy || !type}>
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
