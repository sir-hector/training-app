"use client";

import { useState } from "react";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { StructureEditor } from "@/components/workout-structure/structure-editor";
import type { WorkoutFieldErrors } from "@/lib/workout-form";
import {
  draftFromStructure,
  isDraftEmpty,
  structureFromDraft,
  type StructureDraft,
  type StructureErrors,
  type WorkoutStructure,
} from "@/lib/workout-structure";
import {
  WORKOUT_TYPES,
  WORKOUT_TYPE_META,
  structureKindOf,
  type WorkoutType,
} from "@/lib/workout-types";

// Lets the select trigger show "Long run" rather than the raw "long_run".
const TYPE_ITEMS = WORKOUT_TYPES.map((t) => ({ value: t, label: WORKOUT_TYPE_META[t].label }));

export type WorkoutFieldsState = ReturnType<typeof useWorkoutFields>;

/**
 * Type + structure draft state for a workout form. Switching to a type with
 * a different structure format drops the draft and explains why.
 */
export function useWorkoutFields(initial?: {
  type: WorkoutType;
  structure: WorkoutStructure | null;
}) {
  const [type, setType] = useState<WorkoutType | null>(initial?.type ?? null);
  const [draft, setDraftState] = useState<StructureDraft | null>(() =>
    initial?.structure ? draftFromStructure(initial.structure) : null,
  );
  // Explains why details disappeared after switching to an incompatible type.
  const [notice, setNotice] = useState<string | null>(null);
  const structureKind = type ? structureKindOf(type) : null;

  const changeType = (next: WorkoutType | null) => {
    const nextKind = next ? structureKindOf(next) : null;
    if (draft && draft.kind !== nextKind && type) {
      setDraftState(null);
      if (!isDraftEmpty(draft))
        setNotice(
          `${WORKOUT_TYPE_META[type].label} details were removed: ${
            next ? WORKOUT_TYPE_META[next].label : "this type"
          } ${nextKind ? "uses a different format" : "doesn't take details"}.`,
        );
    }
    setType(next);
  };

  const setDraft = (next: StructureDraft | null) => {
    setDraftState(next);
    setNotice(null);
  };

  return {
    type,
    changeType,
    draft,
    setDraft,
    notice,
    structureKind,
    /** Value for the hidden `structure` form field; validated server-side. */
    structureJson: JSON.stringify(structureFromDraft(structureKind ? draft : null)),
  };
}

type Props = {
  /** Prefix for input ids, so two forms never collide. */
  idPrefix: string;
  fields: WorkoutFieldsState;
  defaultNotes?: string | null;
  errors?: WorkoutFieldErrors;
  structureErrors?: StructureErrors;
  disabled?: boolean;
};

/**
 * Type select, notes and the structure editor. Render inside a `FieldGroup`
 * in a form that also carries a hidden `structure` input with
 * `fields.structureJson`.
 */
export function WorkoutFields({
  idPrefix,
  fields,
  defaultNotes,
  errors,
  structureErrors,
  disabled,
}: Props) {
  const { type, changeType, draft, setDraft, notice, structureKind } = fields;
  return (
    <>
      <Field data-invalid={errors?.type ? true : undefined}>
        <FieldLabel htmlFor={`${idPrefix}-type`}>Type</FieldLabel>
        <Select
          items={TYPE_ITEMS}
          name="type"
          value={type}
          onValueChange={(v) => changeType(v as WorkoutType | null)}
          required
        >
          <SelectTrigger id={`${idPrefix}-type`} aria-invalid={!!errors?.type}>
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
        <FieldLabel htmlFor={`${idPrefix}-notes`}>Notes</FieldLabel>
        <Textarea
          id={`${idPrefix}-notes`}
          name="notes"
          placeholder="e.g. 5 × 1000m @ 4:00, 90s rest"
          rows={3}
          maxLength={2000}
          defaultValue={defaultNotes ?? ""}
        />
        {errors?.notes && <FieldError>{errors.notes}</FieldError>}
      </Field>

      {structureKind ? (
        <div className="flex flex-col gap-2">
          <StructureEditor
            kind={structureKind}
            value={draft}
            onChange={setDraft}
            errors={structureErrors}
            notice={notice}
            disabled={disabled}
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
    </>
  );
}
