"use client";

import { useActionState, useState } from "react";
import { format, parseISO } from "date-fns";
import { Plus } from "lucide-react";
import { createWorkout, type CreateWorkoutState } from "@/app/app/actions";
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
import { WORKOUT_TYPES, WORKOUT_TYPE_META, type WorkoutType } from "@/lib/workout-types";

const initial: CreateWorkoutState = { status: "idle" };

// Lets the select trigger show "Long run" rather than the raw "long_run".
const TYPE_ITEMS = WORKOUT_TYPES.map((t) => ({ value: t, label: WORKOUT_TYPE_META[t].label }));

type Props = {
  /** "YYYY-MM-DD" */
  dateIso: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function AddWorkoutDialog({ dateIso, open, onOpenChange }: Props) {
  const [type, setType] = useState<WorkoutType | null>(null);

  // Close from inside the action once the server confirms. The action
  // revalidates /app, so the new card appears via the router refresh
  // without a full page reload. Parent remounts this component on every
  // open (see DayCell), so form state never leaks between openings.
  const [state, formAction, pending] = useActionState(
    async (prev: CreateWorkoutState, formData: FormData) => {
      const result = await createWorkout(prev, formData);
      if (result.status === "success") onOpenChange(false);
      return result;
    },
    initial,
  );

  const errors = state.status === "error" ? state.fieldErrors : undefined;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form action={formAction} className="contents">
          <input type="hidden" name="date" value={dateIso} />
          <DialogHeader>
            <DialogTitle>Add workout</DialogTitle>
            <DialogDescription>{format(parseISO(dateIso), "EEEE, d MMMM yyyy")}</DialogDescription>
          </DialogHeader>

          <FieldGroup>
            <Field data-invalid={errors?.type ? true : undefined}>
              <FieldLabel htmlFor="workout-type">Type</FieldLabel>
              <Select
                items={TYPE_ITEMS}
                name="type"
                value={type}
                onValueChange={(v) => setType(v as WorkoutType | null)}
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
              />
              {errors?.notes && <FieldError>{errors.notes}</FieldError>}
            </Field>
          </FieldGroup>

          {state.status === "error" && !errors && (
            <p role="alert" className="text-destructive text-sm">
              {state.message}
            </p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={pending || !type}>
              <Plus data-icon="inline-start" />
              {pending ? "Saving…" : "Add workout"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
