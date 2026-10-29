import type { StructureKind, WorkoutStructure } from "./index";

/**
 * Editable form state for a structure. Numbers are kept as the strings the
 * user typed (so "" and "2." survive while editing); each list item has a
 * client-only `id` for React keys. Convert with `structureFromDraft` before
 * sending, and validate the result with `parseStructure` / the Zod schema.
 */

export type StrengthSetDraft = { id: string; reps: string; weightKg: string };
export type ExerciseDraft = {
  id: string;
  name: string;
  sets: StrengthSetDraft[];
  /**
   * Ticked off on the calendar. Not editable in the structure editor; carried
   * through so saving the form doesn't wipe progress. It belongs to the draft
   * row, so it follows an exercise when it's renamed or its sets change, and
   * goes away with it when the row is removed.
   */
  done?: boolean;
};
export type StrengthDraft = { kind: "strength"; exercises: ExerciseDraft[] };

export type IntervalRepeatDraft = {
  id: string;
  count: string;
  distanceM: string;
  durationS: string;
  targetPace: string;
  restS: string;
};
export type IntervalsDraft = {
  kind: "intervals";
  warmupMin: string;
  repeats: IntervalRepeatDraft[];
  cooldownMin: string;
};

export type EnduranceDraft = {
  kind: "endurance";
  distanceKm: string;
  durationMin: string;
  targetPace: string;
};

export type StructureDraft = StrengthDraft | IntervalsDraft | EnduranceDraft;

let counter = 0;
/** Client-only key for list items. */
export function draftId(): string {
  counter += 1;
  return `d${counter}`;
}

const str = (n: number | undefined): string => (n === undefined ? "" : String(n));

export function emptySet(): StrengthSetDraft {
  return { id: draftId(), reps: "", weightKg: "" };
}

export function emptyExercise(): ExerciseDraft {
  return { id: draftId(), name: "", sets: [emptySet()] };
}

export function emptyRepeat(): IntervalRepeatDraft {
  return { id: draftId(), count: "", distanceM: "", durationS: "", targetPace: "", restS: "" };
}

export function emptyDraft(kind: StructureKind): StructureDraft {
  switch (kind) {
    case "strength":
      return { kind, exercises: [emptyExercise()] };
    case "intervals":
      return { kind, warmupMin: "", repeats: [emptyRepeat()], cooldownMin: "" };
    case "endurance":
      return { kind, distanceKm: "", durationMin: "", targetPace: "" };
  }
}

export function draftFromStructure(structure: WorkoutStructure): StructureDraft {
  switch (structure.kind) {
    case "strength":
      return {
        kind: "strength",
        exercises: structure.exercises.map((e) => ({
          id: draftId(),
          name: e.name,
          ...(e.done ? { done: true } : {}),
          sets: e.sets.map((s) => ({
            id: draftId(),
            reps: str(s.reps),
            weightKg: str(s.weightKg),
          })),
        })),
      };
    case "intervals":
      return {
        kind: "intervals",
        warmupMin: str(structure.warmupMin),
        cooldownMin: str(structure.cooldownMin),
        repeats: structure.repeats.map((r) => ({
          id: draftId(),
          count: str(r.count),
          distanceM: str(r.distanceM),
          durationS: str(r.durationS),
          targetPace: r.targetPace ?? "",
          restS: str(r.restS),
        })),
      };
    case "endurance":
      return {
        kind: "endurance",
        distanceKm: str(structure.distanceKm),
        durationMin: str(structure.durationMin),
        targetPace: structure.targetPace ?? "",
      };
  }
}

/** "" → undefined; otherwise a number (NaN for garbage, which the schema rejects). */
function num(s: string): number | undefined {
  const t = s.trim().replace(",", ".");
  return t === "" ? undefined : Number(t);
}

function text(s: string): string | undefined {
  const t = s.trim();
  return t === "" ? undefined : t;
}

/** Drop `undefined` keys so the JSON stays tidy. */
function compact<T extends Record<string, unknown>>(o: T): T {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;
}

/** True when nothing has been filled in, so the draft can be treated as "no structure". */
export function isDraftEmpty(draft: StructureDraft): boolean {
  switch (draft.kind) {
    case "strength":
      return draft.exercises.every(
        (e) => !e.name.trim() && e.sets.every((s) => !s.reps.trim() && !s.weightKg.trim()),
      );
    case "intervals":
      return (
        !draft.warmupMin.trim() &&
        !draft.cooldownMin.trim() &&
        draft.repeats.every(
          (r) =>
            !r.count.trim() &&
            !r.distanceM.trim() &&
            !r.durationS.trim() &&
            !r.targetPace.trim() &&
            !r.restS.trim(),
        )
      );
    case "endurance":
      return !draft.distanceKm.trim() && !draft.durationMin.trim() && !draft.targetPace.trim();
  }
}

/**
 * Turn a draft into the (unvalidated) structure shape. Returns null for an
 * empty draft. Empty fields become absent; numbers are parsed but not checked.
 */
export function structureFromDraft(draft: StructureDraft | null): unknown {
  if (!draft || isDraftEmpty(draft)) return null;
  switch (draft.kind) {
    case "strength":
      return {
        kind: "strength",
        exercises: draft.exercises.map((e) => ({
          name: e.name.trim(),
          sets: e.sets.map((s) => compact({ reps: num(s.reps), weightKg: num(s.weightKg) })),
          ...(e.done ? { done: true } : {}),
        })),
      };
    case "intervals":
      return compact({
        kind: "intervals",
        warmupMin: num(draft.warmupMin),
        repeats: draft.repeats.map((r) =>
          compact({
            count: num(r.count),
            distanceM: num(r.distanceM),
            durationS: num(r.durationS),
            targetPace: text(r.targetPace),
            restS: num(r.restS),
          }),
        ),
        cooldownMin: num(draft.cooldownMin),
      });
    case "endurance":
      return compact({
        kind: "endurance",
        distanceKm: num(draft.distanceKm),
        durationMin: num(draft.durationMin),
        targetPace: text(draft.targetPace),
      });
  }
}

/** A copy of `item` with `done: true`, or with the flag removed (absent = not done). */
export function withDoneFlag<T extends { done?: boolean }>(item: T, done: boolean): T {
  const copy = { ...item };
  delete copy.done;
  if (done) copy.done = true;
  return copy;
}

/**
 * Tick (or untick) the draft row `rowId`, so the form keeps a tick made
 * outside the editor. Returns the draft unchanged when the row is gone.
 */
export function withDraftExerciseDone(
  draft: StrengthDraft,
  rowId: string,
  done: boolean,
): StrengthDraft {
  return {
    ...draft,
    exercises: draft.exercises.map((e) => (e.id === rowId ? withDoneFlag(e, done) : e)),
  };
}
