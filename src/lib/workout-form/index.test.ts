import { describe, expect, it } from "vitest";
import { z } from "zod";
import { WORKOUT_TYPES } from "@/lib/workout-types";
import { parseWorkoutForm } from "./index";

const schema = z.object({
  type: z.enum(WORKOUT_TYPES, { message: "Pick a workout type" }),
  notes: z.string().trim().max(10, "Notes are too long").optional(),
  weekIndex: z.coerce.number().int().min(0),
});

describe("parseWorkoutForm", () => {
  it("parses fields and a matching structure", () => {
    const r = parseWorkoutForm(
      schema,
      { type: "run", notes: " easy ", weekIndex: "1" },
      JSON.stringify({ kind: "endurance", distanceKm: 18 }),
    );
    expect(r).toEqual({
      ok: true,
      data: {
        type: "run",
        notes: "easy",
        weekIndex: 1,
        structure: { kind: "endurance", distanceKm: 18 },
      },
    });
  });

  it("treats a missing or empty structure as none", () => {
    for (const raw of [null, "", "null"]) {
      const r = parseWorkoutForm(schema, { type: "mobility", weekIndex: 0 }, raw);
      expect(r.ok && r.data.structure).toBeNull();
    }
  });

  it("reports the first error for any field, including extra ones", () => {
    const r = parseWorkoutForm(schema, { type: "nope", notes: "x".repeat(11), weekIndex: -1 }, "");
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.fieldErrors).toMatchObject({
      type: "Pick a workout type",
      notes: "Notes are too long",
    });
    expect(r.error.fieldErrors?.weekIndex).toBeTruthy();
  });

  it("rejects malformed JSON and a structure of the wrong kind", () => {
    const bad = parseWorkoutForm(schema, { type: "run", weekIndex: 0 }, "{");
    expect(!bad.ok && bad.error.fieldErrors?.structure).toBe("Workout details are malformed.");

    const wrong = parseWorkoutForm(
      schema,
      { type: "run", weekIndex: 0 },
      JSON.stringify({ kind: "strength", exercises: [{ name: "Squat", sets: [{ reps: 5 }] }] }),
    );
    expect(wrong.ok).toBe(false);
    expect(!wrong.ok && wrong.error.fieldErrors?.structure).toBeTruthy();
  });
});
