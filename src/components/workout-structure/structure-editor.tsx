"use client";

import { useId } from "react";
import { ListPlus, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  STRUCTURE_LIMITS,
  draftId,
  emptyDraft,
  emptyExercise,
  emptyRepeat,
  emptySet,
  type EnduranceDraft,
  type IntervalRepeatDraft,
  type IntervalsDraft,
  type StrengthDraft,
  type StructureDraft,
  type StructureErrors,
  type StructureKind,
} from "@/lib/workout-structure";

const KIND_TITLE: Record<StructureKind, string> = {
  strength: "Exercises",
  intervals: "Intervals",
  endurance: "Targets",
};

export type StructureEditorProps = {
  /** Which kind of structure to edit. A `value` of another kind is ignored. */
  kind: StructureKind;
  /** `null` = no structure: the editor shows a collapsed "Add details" button. */
  value: StructureDraft | null;
  onChange: (next: StructureDraft | null) => void;
  /** Server-side errors keyed by path (see `parseStructure`). `""` is the root. */
  errors?: StructureErrors;
  /** Shown above the editor, e.g. "Gym details were removed". */
  notice?: string | null;
  disabled?: boolean;
};

/**
 * Controlled editor for a workout structure (sets/reps, intervals, targets).
 * Knows nothing about workouts or the database: callers own the draft state
 * and convert it with `structureFromDraft` before saving.
 */
export function StructureEditor({
  kind,
  value,
  onChange,
  errors = {},
  notice,
  disabled,
}: StructureEditorProps) {
  const draft = value?.kind === kind ? value : null;
  const rootError = errors[""];

  return (
    <section
      aria-label="Workout details"
      data-slot="structure-editor"
      className="flex flex-col gap-3"
    >
      {notice && (
        <p
          role="status"
          className="text-muted-foreground bg-muted rounded-md px-2.5 py-1.5 text-xs"
        >
          {notice}
        </p>
      )}
      {!draft ? (
        <Button
          type="button"
          variant="outline"
          className="self-start"
          onClick={() => onChange(emptyDraft(kind))}
          disabled={disabled}
        >
          <ListPlus data-icon="inline-start" />
          Add details
        </Button>
      ) : (
        <>
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-medium">{KIND_TITLE[kind]}</h3>
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={() => onChange(null)}
              disabled={disabled}
            >
              <X data-icon="inline-start" />
              Remove details
            </Button>
          </div>
          {rootError && <ErrorText>{rootError}</ErrorText>}
          {draft.kind === "strength" && (
            <StrengthEditor draft={draft} onChange={onChange} errors={errors} disabled={disabled} />
          )}
          {draft.kind === "intervals" && (
            <IntervalsEditor
              draft={draft}
              onChange={onChange}
              errors={errors}
              disabled={disabled}
            />
          )}
          {draft.kind === "endurance" && (
            <EnduranceEditor
              draft={draft}
              onChange={onChange}
              errors={errors}
              disabled={disabled}
            />
          )}
        </>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------

type SubProps<D> = {
  draft: D;
  onChange: (next: StructureDraft) => void;
  errors: StructureErrors;
  disabled?: boolean;
};

function ErrorText({ children }: { children: React.ReactNode }) {
  return <p className="text-destructive text-xs">{children}</p>;
}

/** Unique messages for keys starting with `prefix` (e.g. "exercises.0."). */
function errorsUnder(errors: StructureErrors, prefix: string): string[] {
  return [
    ...new Set(Object.entries(errors).flatMap(([k, v]) => (k.startsWith(prefix) ? [v] : []))),
  ];
}

function ErrorList({ messages }: { messages: string[] }) {
  if (messages.length === 0) return null;
  return (
    <ul className="flex flex-col gap-0.5">
      {messages.map((m) => (
        <li key={m}>
          <ErrorText>{m}</ErrorText>
        </li>
      ))}
    </ul>
  );
}

const numberInput = "h-8 px-2 tabular-nums";

function StrengthEditor({ draft, onChange, errors, disabled }: SubProps<StrengthDraft>) {
  const L = STRUCTURE_LIMITS;
  const setExercises = (exercises: StrengthDraft["exercises"]) => onChange({ ...draft, exercises });
  const listError = errors["exercises"];

  return (
    <div className="flex flex-col gap-3">
      {listError && <ErrorText>{listError}</ErrorText>}
      <ol className="flex flex-col gap-3">
        {draft.exercises.map((ex, i) => {
          const n = i + 1;
          const updateEx = (patch: Partial<typeof ex>) =>
            setExercises(draft.exercises.map((e) => (e.id === ex.id ? { ...e, ...patch } : e)));
          const path = `exercises.${i}`;
          return (
            <li key={ex.id} className="bg-muted/40 flex flex-col gap-2 rounded-lg border p-2.5">
              <div className="flex items-center gap-1.5">
                <Input
                  aria-label={`Exercise ${n} name`}
                  placeholder={`Exercise ${n}, e.g. Back squat`}
                  value={ex.name}
                  maxLength={L.exerciseName}
                  onChange={(e) => updateEx({ name: e.target.value })}
                  aria-invalid={!!errors[`${path}.name`] || undefined}
                  disabled={disabled}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Remove exercise ${n}`}
                  onClick={() => setExercises(draft.exercises.filter((e) => e.id !== ex.id))}
                  disabled={disabled}
                >
                  <Trash2 />
                </Button>
              </div>

              <div
                className="text-muted-foreground grid grid-cols-[2.5rem_1fr_1fr_1.75rem] items-center gap-1.5 text-xs"
                aria-hidden
              >
                <span>Set</span>
                <span>Reps</span>
                <span>Weight (kg)</span>
                <span />
              </div>
              <ol className="flex flex-col gap-1.5">
                {ex.sets.map((set, j) => {
                  const s = j + 1;
                  const updateSet = (patch: Partial<typeof set>) =>
                    updateEx({
                      sets: ex.sets.map((x) => (x.id === set.id ? { ...x, ...patch } : x)),
                    });
                  return (
                    <li
                      key={set.id}
                      className="grid grid-cols-[2.5rem_1fr_1fr_1.75rem] items-center gap-1.5"
                    >
                      <span className="text-muted-foreground text-xs tabular-nums">{s}</span>
                      <Input
                        type="number"
                        inputMode="numeric"
                        min={1}
                        step={1}
                        aria-label={`Exercise ${n}, set ${s} reps`}
                        value={set.reps}
                        onChange={(e) => updateSet({ reps: e.target.value })}
                        aria-invalid={!!errors[`${path}.sets.${j}.reps`] || undefined}
                        className={numberInput}
                        disabled={disabled}
                      />
                      <Input
                        type="number"
                        inputMode="decimal"
                        min={0}
                        step="any"
                        aria-label={`Exercise ${n}, set ${s} weight (kg)`}
                        placeholder="—"
                        value={set.weightKg}
                        onChange={(e) => updateSet({ weightKg: e.target.value })}
                        aria-invalid={!!errors[`${path}.sets.${j}.weightKg`] || undefined}
                        className={numberInput}
                        disabled={disabled}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        aria-label={`Remove set ${s} from exercise ${n}`}
                        onClick={() => updateEx({ sets: ex.sets.filter((x) => x.id !== set.id) })}
                        disabled={disabled}
                      >
                        <X />
                      </Button>
                    </li>
                  );
                })}
              </ol>
              <ErrorList messages={errorsUnder(errors, `${path}.`)} />
              <Button
                type="button"
                variant="ghost"
                size="xs"
                className="self-start"
                aria-label={`Add set to exercise ${n}`}
                onClick={() => {
                  // Copy the last set: most programmes repeat the same reps/weight.
                  const last = ex.sets.at(-1);
                  updateEx({
                    sets: [...ex.sets, last ? { ...last, id: draftId() } : emptySet()],
                  });
                }}
                disabled={disabled || ex.sets.length >= L.setsPerExercise}
              >
                <Plus data-icon="inline-start" />
                Add set
              </Button>
            </li>
          );
        })}
      </ol>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="self-start"
        onClick={() => setExercises([...draft.exercises, emptyExercise()])}
        disabled={disabled || draft.exercises.length >= L.exercises}
      >
        <Plus data-icon="inline-start" />
        Add exercise
      </Button>
    </div>
  );
}

type NumberFieldProps = {
  label: string;
  value: string;
  onChange: (v: string) => void;
  invalid?: boolean;
  disabled?: boolean;
  /** Text input (for paces) instead of a number input. */
  text?: boolean;
  placeholder?: string;
  decimal?: boolean;
  className?: string;
};

function SmallField({
  label,
  value,
  onChange,
  invalid,
  disabled,
  text,
  placeholder,
  decimal,
  className,
}: NumberFieldProps) {
  const id = useId();
  return (
    <div className={cn("flex min-w-0 flex-col gap-1", className)}>
      <Label htmlFor={id} className="text-muted-foreground text-xs font-normal">
        {label}
      </Label>
      <Input
        id={id}
        type={text ? "text" : "number"}
        inputMode={text ? "text" : decimal ? "decimal" : "numeric"}
        min={text ? undefined : 0}
        step={text ? undefined : decimal ? "any" : 1}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={invalid || undefined}
        className={numberInput}
        disabled={disabled}
      />
    </div>
  );
}

function IntervalsEditor({ draft, onChange, errors, disabled }: SubProps<IntervalsDraft>) {
  const set = (patch: Partial<IntervalsDraft>) => onChange({ ...draft, ...patch });
  const updateRepeat = (rid: string, patch: Partial<IntervalRepeatDraft>) =>
    set({ repeats: draft.repeats.map((r) => (r.id === rid ? { ...r, ...patch } : r)) });

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2">
        <SmallField
          label="Warm-up (min)"
          value={draft.warmupMin}
          onChange={(v) => set({ warmupMin: v })}
          invalid={!!errors["warmupMin"]}
          disabled={disabled}
        />
        <SmallField
          label="Cool-down (min)"
          value={draft.cooldownMin}
          onChange={(v) => set({ cooldownMin: v })}
          invalid={!!errors["cooldownMin"]}
          disabled={disabled}
        />
      </div>
      <ErrorList
        messages={[errors["warmupMin"], errors["cooldownMin"], errors["repeats"]].filter(
          (m): m is string => !!m,
        )}
      />
      <ol className="flex flex-col gap-3">
        {draft.repeats.map((r, i) => {
          const n = i + 1;
          const path = `repeats.${i}`;
          return (
            <li
              key={r.id}
              aria-label={`Repeat ${n}`}
              className="bg-muted/40 flex flex-col gap-2 rounded-lg border p-2.5"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium">Repeat {n}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  aria-label={`Remove repeat ${n}`}
                  onClick={() => set({ repeats: draft.repeats.filter((x) => x.id !== r.id) })}
                  disabled={disabled}
                >
                  <Trash2 />
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                <SmallField
                  label="Times"
                  value={r.count}
                  onChange={(v) => updateRepeat(r.id, { count: v })}
                  invalid={!!errors[`${path}.count`]}
                  disabled={disabled}
                />
                <SmallField
                  label="Distance (m)"
                  value={r.distanceM}
                  onChange={(v) => updateRepeat(r.id, { distanceM: v })}
                  invalid={!!errors[`${path}.distanceM`]}
                  disabled={disabled}
                />
                <SmallField
                  label="Time (s)"
                  value={r.durationS}
                  onChange={(v) => updateRepeat(r.id, { durationS: v })}
                  invalid={!!errors[`${path}.durationS`]}
                  disabled={disabled}
                />
                <SmallField
                  label="Pace (min/km)"
                  text
                  placeholder="m:ss"
                  value={r.targetPace}
                  onChange={(v) => updateRepeat(r.id, { targetPace: v })}
                  invalid={!!errors[`${path}.targetPace`]}
                  disabled={disabled}
                />
                <SmallField
                  label="Rest (s)"
                  value={r.restS}
                  onChange={(v) => updateRepeat(r.id, { restS: v })}
                  invalid={!!errors[`${path}.restS`]}
                  disabled={disabled}
                />
              </div>
              <ErrorList messages={errorsUnder(errors, `${path}.`)} />
            </li>
          );
        })}
      </ol>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="self-start"
        onClick={() => set({ repeats: [...draft.repeats, emptyRepeat()] })}
        disabled={disabled || draft.repeats.length >= STRUCTURE_LIMITS.repeats}
      >
        <Plus data-icon="inline-start" />
        Add repeat
      </Button>
    </div>
  );
}

function EnduranceEditor({ draft, onChange, errors, disabled }: SubProps<EnduranceDraft>) {
  const set = (patch: Partial<EnduranceDraft>) => onChange({ ...draft, ...patch });
  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <SmallField
          label="Distance (km)"
          decimal
          value={draft.distanceKm}
          onChange={(v) => set({ distanceKm: v })}
          invalid={!!errors["distanceKm"]}
          disabled={disabled}
        />
        <SmallField
          label="Duration (min)"
          value={draft.durationMin}
          onChange={(v) => set({ durationMin: v })}
          invalid={!!errors["durationMin"]}
          disabled={disabled}
        />
        <SmallField
          label="Pace (min/km)"
          text
          placeholder="m:ss"
          value={draft.targetPace}
          onChange={(v) => set({ targetPace: v })}
          invalid={!!errors["targetPace"]}
          disabled={disabled}
        />
      </div>
      <ErrorList
        messages={[errors["distanceKm"], errors["durationMin"], errors["targetPace"]].filter(
          (m): m is string => !!m,
        )}
      />
    </div>
  );
}
