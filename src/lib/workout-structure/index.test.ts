import { describe, expect, it } from "vitest";
import {
  STRUCTURE_LIMITS,
  draftFromStructure,
  emptyDraft,
  parseStructure,
  structureFromDraft,
  summarize,
  workoutStructureSchema,
  type StructureDraft,
  type WorkoutStructure,
} from "./index";
import { WORKOUT_TYPES, structureKindOf } from "@/lib/workout-types";

const strength: WorkoutStructure = {
  kind: "strength",
  exercises: [
    { name: "Squat", sets: [{ reps: 5, weightKg: 100 }, { reps: 5, weightKg: 100 }, { reps: 5 }] },
    { name: "Bench press", sets: [{ reps: 8, weightKg: 62.5 }] },
  ],
};

const intervals: WorkoutStructure = {
  kind: "intervals",
  warmupMin: 15,
  repeats: [{ count: 6, distanceM: 800, targetPace: "3:10", restS: 90 }],
  cooldownMin: 10,
};

const endurance: WorkoutStructure = { kind: "endurance", distanceKm: 18, targetPace: "5:00" };

const accepts = (v: unknown) => workoutStructureSchema.safeParse(v).success;

describe("workoutStructureSchema", () => {
  it("accepts valid structures of each kind", () => {
    expect(accepts(strength)).toBe(true);
    expect(accepts(intervals)).toBe(true);
    expect(accepts(endurance)).toBe(true);
    expect(accepts({ kind: "intervals", repeats: [{ count: 10, durationS: 60 }] })).toBe(true);
    expect(accepts({ kind: "endurance", durationMin: 90 })).toBe(true);
  });

  it("rejects unknown kinds and missing kind", () => {
    expect(accepts({ kind: "yoga" })).toBe(false);
    expect(accepts({ exercises: [] })).toBe(false);
    expect(accepts(null)).toBe(false);
  });

  it("strength: needs exercises, names, sets and positive whole reps", () => {
    expect(accepts({ kind: "strength", exercises: [] })).toBe(false);
    expect(accepts({ kind: "strength", exercises: [{ name: " ", sets: [{ reps: 5 }] }] })).toBe(
      false,
    );
    expect(accepts({ kind: "strength", exercises: [{ name: "Squat", sets: [] }] })).toBe(false);
    for (const reps of [0, -1, 2.5, "5", undefined]) {
      expect(accepts({ kind: "strength", exercises: [{ name: "Squat", sets: [{ reps }] }] })).toBe(
        false,
      );
    }
    expect(
      accepts({
        kind: "strength",
        exercises: [{ name: "Squat", sets: [{ reps: 5, weightKg: 0 }] }],
      }),
    ).toBe(false);
  });

  it("strength: enforces limits", () => {
    const set = { reps: 5 };
    const tooManySets = {
      kind: "strength",
      exercises: [{ name: "Squat", sets: Array(STRUCTURE_LIMITS.setsPerExercise + 1).fill(set) }],
    };
    const tooManyExercises = {
      kind: "strength",
      exercises: Array(STRUCTURE_LIMITS.exercises + 1).fill({ name: "Squat", sets: [set] }),
    };
    expect(accepts(tooManySets)).toBe(false);
    expect(accepts(tooManyExercises)).toBe(false);
    expect(accepts({ kind: "strength", exercises: [{ name: "x".repeat(81), sets: [set] }] })).toBe(
      false,
    );
  });

  it("intervals: each repeat needs a distance or a duration", () => {
    const r = workoutStructureSchema.safeParse({ kind: "intervals", repeats: [{ count: 6 }] });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0].path).toEqual(["repeats", 0, "distanceM"]);
    expect(accepts({ kind: "intervals", repeats: [] })).toBe(false);
    expect(accepts({ kind: "intervals", repeats: [{ count: 0, distanceM: 400 }] })).toBe(false);
    expect(
      accepts({
        kind: "intervals",
        repeats: Array(STRUCTURE_LIMITS.repeats + 1).fill({ count: 1, distanceM: 400 }),
      }),
    ).toBe(false);
  });

  it("validates pace format", () => {
    expect(accepts({ kind: "endurance", targetPace: "4:30" })).toBe(true);
    expect(accepts({ kind: "endurance", targetPace: "4:75" })).toBe(false);
    expect(accepts({ kind: "endurance", targetPace: "fast" })).toBe(false);
  });

  it("endurance: needs at least one target", () => {
    expect(accepts({ kind: "endurance" })).toBe(false);
    expect(accepts({ kind: "endurance", distanceKm: -5 })).toBe(false);
  });
});

describe("parseStructure", () => {
  it("treats null as no structure", () => {
    expect(parseStructure(null, "strength")).toEqual({ ok: true, structure: null });
    expect(parseStructure(undefined, null)).toEqual({ ok: true, structure: null });
  });

  it("rejects a structure whose kind doesn't match", () => {
    const r = parseStructure(strength, "endurance");
    expect(r.ok).toBe(false);
    const none = parseStructure(strength, null);
    expect(none.ok).toBe(false);
  });

  it("returns errors keyed by path", () => {
    const r = parseStructure(
      { kind: "strength", exercises: [{ name: "Squat", sets: [{ reps: 5 }, { reps: 0 }] }] },
      "strength",
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors["exercises.0.sets.1.reps"]).toMatch(/more than 0/);
  });

  it("trims names", () => {
    const r = parseStructure(
      { kind: "strength", exercises: [{ name: "  Squat ", sets: [{ reps: 5 }] }] },
      "strength",
    );
    expect(r.ok && r.structure?.kind === "strength" && r.structure.exercises[0].name).toBe("Squat");
  });
});

describe("summarize", () => {
  it("strength: exercises and total sets", () => {
    expect(summarize(strength)).toBe("2 ex · 4 sets");
    expect(
      summarize({ kind: "strength", exercises: [{ name: "Pull-up", sets: [{ reps: 8 }] }] }),
    ).toBe("1 ex · 1 set");
  });

  it("intervals: count × distance or time", () => {
    expect(summarize(intervals)).toBe("6×800m");
    expect(
      summarize({
        kind: "intervals",
        repeats: [
          { count: 4, distanceM: 1000 },
          { count: 4, durationS: 60 },
        ],
      }),
    ).toBe("4×1km + 4×1min");
    expect(summarize({ kind: "intervals", repeats: [{ count: 10, durationS: 30 }] })).toBe(
      "10×30s",
    );
    expect(summarize({ kind: "intervals", repeats: [{ count: 3, durationS: 90 }] })).toBe("3×1:30");
    expect(
      summarize({
        kind: "intervals",
        repeats: [
          { count: 1, distanceM: 1600 },
          { count: 2, distanceM: 800 },
          { count: 4, distanceM: 400 },
        ],
      }),
    ).toBe("1×1.6km + 2 more");
  });

  it("endurance: distance, else duration, else pace", () => {
    expect(summarize(endurance)).toBe("18 km");
    expect(summarize({ kind: "endurance", distanceKm: 21.1 })).toBe("21.1 km");
    expect(summarize({ kind: "endurance", durationMin: 45 })).toBe("45 min");
    expect(summarize({ kind: "endurance", durationMin: 90 })).toBe("1 h 30 min");
    expect(summarize({ kind: "endurance", durationMin: 120 })).toBe("2 h");
    expect(summarize({ kind: "endurance", targetPace: "4:30" })).toBe("@ 4:30/km");
  });
});

describe("drafts", () => {
  it("round-trip structure → draft → structure", () => {
    for (const s of [strength, intervals, endurance]) {
      expect(structureFromDraft(draftFromStructure(s))).toEqual(s);
    }
  });

  it("an untouched draft means no structure", () => {
    expect(structureFromDraft(emptyDraft("strength"))).toBeNull();
    expect(structureFromDraft(emptyDraft("intervals"))).toBeNull();
    expect(structureFromDraft(emptyDraft("endurance"))).toBeNull();
    expect(structureFromDraft(null)).toBeNull();
  });

  it("parses numbers (comma decimals too) and drops empty fields", () => {
    const draft: StructureDraft = {
      kind: "endurance",
      distanceKm: "12,5",
      durationMin: "",
      targetPace: " ",
    };
    expect(structureFromDraft(draft)).toEqual({ kind: "endurance", distanceKm: 12.5 });
  });
});

describe("workout types → structure kind", () => {
  it("maps every type", () => {
    expect(Object.fromEntries(WORKOUT_TYPES.map((t) => [t, structureKindOf(t)]))).toEqual({
      gym: "strength",
      strength: "strength",
      interval: "intervals",
      tempo: "intervals",
      run: "endurance",
      long_run: "endurance",
      bike: "endurance",
      mobility: null,
      other: null,
    });
  });
});
