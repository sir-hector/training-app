/**
 * Integration tests against a real Postgres (see workouts-repo's test).
 * Creates two throwaway users and deletes them afterwards; plans, plan days
 * and workouts cascade.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { planDays, plans, users, workouts } from "@/db/schema";
import type { WorkoutStructure } from "@/lib/workout-structure";
import { plansRepo } from "./index";

const run = crypto.randomUUID().slice(0, 8);
const userA = `test-pa-${run}`;
const userB = `test-pb-${run}`;

const gym: WorkoutStructure = {
  kind: "strength",
  exercises: [{ name: "Squat", sets: [{ reps: 5, weightKg: 100 }] }],
};
const intervals: WorkoutStructure = {
  kind: "intervals",
  repeats: [{ count: 6, distanceM: 800, restS: 90 }],
};

beforeAll(async () => {
  await db.insert(users).values([
    { id: userA, email: `${userA}@test.invalid`, name: "Plan User A" },
    { id: userB, email: `${userB}@test.invalid`, name: "Plan User B" },
  ]);
});

afterAll(async () => {
  await db.delete(users).where(inArray(users.id, [userA, userB]));
});

async function workoutsOf(userId: string, from: string, to: string) {
  const rows = await db.select().from(workouts).where(eq(workouts.userId, userId));
  return rows
    .filter((w) => w.date >= from && w.date <= to)
    .sort((a, b) => a.date.localeCompare(b.date) || a.type.localeCompare(b.type));
}

describe("plansRepo CRUD", () => {
  it("create → findById → list round-trips", async () => {
    const plan = await plansRepo.create(userA, { name: "  10k block  ", weeks: 6 });
    expect(plan).toMatchObject({ userId: userA, name: "10k block", weeks: 6 });

    const found = await plansRepo.findById(userA, plan.id);
    expect(found).toMatchObject({ id: plan.id, name: "10k block", weeks: 6, days: [] });

    await plansRepo.addDay(userA, plan.id, { weekIndex: 0, dayOfWeek: 1, type: "run" });
    const listed = await plansRepo.list(userA);
    const summary = listed.find((p) => p.id === plan.id);
    expect(summary?.dayCount).toBe(1);
    expect(listed.every((p) => p.userId === userA)).toBe(true);
  });

  it("rejects weeks outside 1–26", async () => {
    await expect(plansRepo.create(userA, { name: "x", weeks: 0 })).rejects.toThrow(RangeError);
    await expect(plansRepo.create(userA, { name: "x", weeks: 27 })).rejects.toThrow(RangeError);
  });

  it("update renames and resizes; shrinking drops days in removed weeks", async () => {
    const plan = await plansRepo.create(userA, { name: "Base", weeks: 4 });
    await plansRepo.addDay(userA, plan.id, { weekIndex: 0, dayOfWeek: 0, type: "run" });
    await plansRepo.addDay(userA, plan.id, { weekIndex: 1, dayOfWeek: 2, type: "gym" });
    await plansRepo.addDay(userA, plan.id, { weekIndex: 3, dayOfWeek: 6, type: "long_run" });

    const renamed = await plansRepo.update(userA, plan.id, { name: "Base v2" });
    expect(renamed).toMatchObject({ name: "Base v2", weeks: 4 });

    const shrunk = await plansRepo.update(userA, plan.id, { weeks: 2 });
    expect(shrunk?.weeks).toBe(2);
    const after = await plansRepo.findById(userA, plan.id);
    expect(after?.days.map((d) => [d.weekIndex, d.dayOfWeek])).toEqual([
      [0, 0],
      [1, 2],
    ]);
  });

  it("addDay allows several workouts on one day and orders days by week/day", async () => {
    const plan = await plansRepo.create(userA, { name: "Double days", weeks: 2 });
    const a = await plansRepo.addDay(userA, plan.id, {
      weekIndex: 1,
      dayOfWeek: 3,
      type: "gym",
      notes: "  pm  ",
      structure: gym,
    });
    const b = await plansRepo.addDay(userA, plan.id, { weekIndex: 1, dayOfWeek: 3, type: "run" });
    const c = await plansRepo.addDay(userA, plan.id, { weekIndex: 0, dayOfWeek: 5, type: "bike" });
    expect(a).toMatchObject({ planId: plan.id, notes: "pm", structure: gym, type: "gym" });
    expect(b?.structure).toBeNull();
    expect(b?.notes).toBeNull();

    const found = await plansRepo.findById(userA, plan.id);
    expect(found?.days.map((d) => d.id)).toEqual([c!.id, a!.id, b!.id]);
  });

  it("addDay refuses a week outside the plan", async () => {
    const plan = await plansRepo.create(userA, { name: "Short", weeks: 1 });
    expect(
      await plansRepo.addDay(userA, plan.id, { weekIndex: 1, dayOfWeek: 0, type: "run" }),
    ).toBeNull();
    await expect(
      plansRepo.addDay(userA, plan.id, { weekIndex: 0, dayOfWeek: 7, type: "run" }),
    ).rejects.toThrow(RangeError);
  });

  it("updateDay changes fields; null structure clears it; removeDay deletes", async () => {
    const plan = await plansRepo.create(userA, { name: "Edit days", weeks: 1 });
    const day = await plansRepo.addDay(userA, plan.id, {
      weekIndex: 0,
      dayOfWeek: 2,
      type: "gym",
      structure: gym,
    });
    const updated = await plansRepo.updateDay(userA, day!.id, {
      type: "interval",
      notes: "track",
      structure: intervals,
    });
    expect(updated).toMatchObject({ type: "interval", notes: "track", structure: intervals });
    const cleared = await plansRepo.updateDay(userA, day!.id, { structure: null, notes: "" });
    expect(cleared).toMatchObject({ structure: null, notes: null, type: "interval" });

    expect(await plansRepo.removeDay(userA, day!.id)).toBe(true);
    expect(await plansRepo.removeDay(userA, day!.id)).toBe(false);
    expect((await plansRepo.findById(userA, plan.id))?.days).toEqual([]);
  });

  it("delete removes the plan and cascades its days", async () => {
    const plan = await plansRepo.create(userA, { name: "Doomed", weeks: 1 });
    await plansRepo.addDay(userA, plan.id, { weekIndex: 0, dayOfWeek: 0, type: "run" });
    expect(await plansRepo.delete(userA, plan.id)).toBe(true);
    expect(await plansRepo.findById(userA, plan.id)).toBeNull();
    expect(await db.select().from(planDays).where(eq(planDays.planId, plan.id))).toHaveLength(0);
    expect(await plansRepo.delete(userA, plan.id)).toBe(false);
  });
});

describe("plansRepo.applyToCalendar", () => {
  it("creates one workout per plan day on the right dates, types, notes and structures", async () => {
    const plan = await plansRepo.create(userA, { name: "Apply me", weeks: 2 });
    await plansRepo.addDay(userA, plan.id, {
      weekIndex: 0,
      dayOfWeek: 0,
      type: "gym",
      notes: "heavy",
      structure: gym,
    });
    await plansRepo.addDay(userA, plan.id, {
      weekIndex: 0,
      dayOfWeek: 2,
      type: "interval",
      structure: intervals,
    });
    await plansRepo.addDay(userA, plan.id, { weekIndex: 1, dayOfWeek: 6, type: "long_run" });
    await plansRepo.addDay(userA, plan.id, { weekIndex: 1, dayOfWeek: 6, type: "mobility" });

    expect(await plansRepo.applyToCalendar(userA, plan.id, "2033-02-28")).toEqual({
      created: 4,
      skipped: 0,
    });

    const created = await workoutsOf(userA, "2033-02-28", "2033-03-13");
    expect(
      created.map((w) => ({
        date: w.date,
        type: w.type,
        notes: w.notes,
        structure: w.structure,
        done: w.done,
      })),
    ).toEqual([
      { date: "2033-02-28", type: "gym", notes: "heavy", structure: gym, done: false },
      { date: "2033-03-02", type: "interval", notes: null, structure: intervals, done: false },
      { date: "2033-03-13", type: "long_run", notes: null, structure: null, done: false },
      { date: "2033-03-13", type: "mobility", notes: null, structure: null, done: false },
    ]);

    // Applying again skips everything; the plan itself is untouched.
    expect(await plansRepo.applyToCalendar(userA, plan.id, "2033-02-28")).toEqual({
      created: 0,
      skipped: 4,
    });
    expect(await workoutsOf(userA, "2033-02-28", "2033-03-13")).toHaveLength(4);
    expect((await plansRepo.findById(userA, plan.id))?.days).toHaveLength(4);
  });

  it("strips exercise done flags: on addDay/updateDay and when stamping workouts", async () => {
    const ticked: WorkoutStructure = {
      kind: "strength",
      exercises: [
        { name: "Squat", sets: [{ reps: 5, weightKg: 100 }], done: true },
        { name: "Bench", sets: [{ reps: 8 }] },
      ],
    };
    const untickedStructure: WorkoutStructure = {
      kind: "strength",
      exercises: [
        { name: "Squat", sets: [{ reps: 5, weightKg: 100 }] },
        { name: "Bench", sets: [{ reps: 8 }] },
      ],
    };
    const plan = await plansRepo.create(userA, { name: "Ticked", weeks: 1 });
    const added = await plansRepo.addDay(userA, plan.id, {
      weekIndex: 0,
      dayOfWeek: 0,
      type: "gym",
      structure: ticked,
    });
    expect(added?.structure).toEqual(untickedStructure);
    const updated = await plansRepo.updateDay(userA, added!.id, { structure: ticked });
    expect(updated?.structure).toEqual(untickedStructure);

    // A plan day that somehow carries flags (written directly) still applies clean.
    await db.insert(planDays).values({
      planId: plan.id,
      weekIndex: 0,
      dayOfWeek: 1,
      type: "gym",
      structure: ticked,
    });
    expect(await plansRepo.applyToCalendar(userA, plan.id, "2036-01-07")).toEqual({
      created: 2,
      skipped: 0,
    });
    const created = await workoutsOf(userA, "2036-01-07", "2036-01-13");
    expect(created.map((w) => w.structure)).toEqual([untickedStructure, untickedStructure]);
  });

  it("skips exactly the plan workouts already on the calendar, by count", async () => {
    const plan = await plansRepo.create(userA, { name: "Partly there", weeks: 1 });
    await plansRepo.addDay(userA, plan.id, { weekIndex: 0, dayOfWeek: 1, type: "run" });
    await plansRepo.addDay(userA, plan.id, { weekIndex: 0, dayOfWeek: 1, type: "run" });
    await plansRepo.addDay(userA, plan.id, { weekIndex: 0, dayOfWeek: 3, type: "gym" });
    // One matching run, plus a bike on the gym day that must not block it.
    await db.insert(workouts).values([
      { userId: userA, date: "2033-06-07", type: "run", notes: "already here" },
      { userId: userA, date: "2033-06-09", type: "bike" },
    ]);

    expect(await plansRepo.previewApply(userA, plan.id, "2033-06-06")).toEqual({
      from: "2033-06-06",
      to: "2033-06-12",
      toAdd: 2,
      skipped: 1,
      untouched: 1,
    });
    expect(await plansRepo.applyToCalendar(userA, plan.id, "2033-06-06")).toEqual({
      created: 2,
      skipped: 1,
    });
    const after = await workoutsOf(userA, "2033-06-06", "2033-06-12");
    // Two runs on the same date: compare without relying on their order.
    expect(after.map((w) => [w.date, w.type, w.notes]).sort()).toEqual([
      ["2033-06-07", "run", null],
      ["2033-06-07", "run", "already here"],
      ["2033-06-09", "bike", null],
      ["2033-06-09", "gym", null],
    ]);
  });

  it("previewApply writes nothing and counts only the user's own workouts", async () => {
    const plan = await plansRepo.create(userA, { name: "Preview", weeks: 2 });
    await plansRepo.addDay(userA, plan.id, { weekIndex: 0, dayOfWeek: 0, type: "run" });
    await plansRepo.addDay(userA, plan.id, { weekIndex: 1, dayOfWeek: 2, type: "tempo" });
    await db.insert(workouts).values([
      // Another user's matching workouts must not count.
      { userId: userB, date: "2033-09-05", type: "run" },
      { userId: userB, date: "2033-09-14", type: "tempo" },
      { userId: userB, date: "2033-09-10", type: "gym" },
      // userA: one match, one other workout in range, one match just outside.
      { userId: userA, date: "2033-09-14", type: "tempo" },
      { userId: userA, date: "2033-09-07", type: "mobility" },
      { userId: userA, date: "2033-09-19", type: "run" },
    ]);

    expect(await plansRepo.previewApply(userA, plan.id, "2033-09-05")).toEqual({
      from: "2033-09-05",
      to: "2033-09-18",
      toAdd: 1,
      skipped: 1,
      untouched: 1,
    });
    expect(await workoutsOf(userA, "2033-09-05", "2033-09-18")).toHaveLength(2);
    await expect(plansRepo.previewApply(userA, plan.id, "2033-09-06")).rejects.toThrow(RangeError);
  });

  it("returns 0 for a plan with no days", async () => {
    const plan = await plansRepo.create(userA, { name: "Empty", weeks: 3 });
    expect(await plansRepo.applyToCalendar(userA, plan.id, "2034-01-02")).toEqual({
      created: 0,
      skipped: 0,
    });
  });

  it("rejects a start that isn't a Monday and writes nothing", async () => {
    const plan = await plansRepo.create(userA, { name: "Tuesday", weeks: 1 });
    await plansRepo.addDay(userA, plan.id, { weekIndex: 0, dayOfWeek: 0, type: "run" });
    await expect(plansRepo.applyToCalendar(userA, plan.id, "2034-02-07")).rejects.toThrow(
      RangeError,
    );
    expect(await workoutsOf(userA, "2034-02-01", "2034-02-28")).toHaveLength(0);
  });
});

describe("CRITICAL: cross-user access is refused for every method", () => {
  it("findById / list never expose another user's plan", async () => {
    const b = await plansRepo.create(userB, { name: "B's secret", weeks: 2 });
    expect(await plansRepo.findById(userA, b.id)).toBeNull();
    expect((await plansRepo.list(userA)).map((p) => p.id)).not.toContain(b.id);
    expect((await plansRepo.list(userB)).map((p) => p.id)).toContain(b.id);
  });

  it("update cannot rename or shrink another user's plan (days survive)", async () => {
    const b = await plansRepo.create(userB, { name: "B plan", weeks: 3 });
    await plansRepo.addDay(userB, b.id, { weekIndex: 2, dayOfWeek: 0, type: "run" });
    expect(await plansRepo.update(userA, b.id, { name: "hijacked" })).toBeNull();
    expect(await plansRepo.update(userA, b.id, { weeks: 1 })).toBeNull();
    expect(await plansRepo.update(userA, b.id, {})).toBeNull();
    const still = await plansRepo.findById(userB, b.id);
    expect(still).toMatchObject({ name: "B plan", weeks: 3 });
    expect(still?.days).toHaveLength(1);
  });

  it("delete cannot remove another user's plan", async () => {
    const b = await plansRepo.create(userB, { name: "Keep", weeks: 1 });
    expect(await plansRepo.delete(userA, b.id)).toBe(false);
    expect(await plansRepo.findById(userB, b.id)).not.toBeNull();
  });

  it("addDay cannot add to another user's plan", async () => {
    const b = await plansRepo.create(userB, { name: "No additions", weeks: 1 });
    expect(
      await plansRepo.addDay(userA, b.id, { weekIndex: 0, dayOfWeek: 0, type: "gym" }),
    ).toBeNull();
    expect((await plansRepo.findById(userB, b.id))?.days).toEqual([]);
  });

  it("updateDay / removeDay cannot touch another user's plan day", async () => {
    const b = await plansRepo.create(userB, { name: "Hands off", weeks: 1 });
    const day = await plansRepo.addDay(userB, b.id, {
      weekIndex: 0,
      dayOfWeek: 4,
      type: "gym",
      notes: "mine",
      structure: gym,
    });
    expect(await plansRepo.updateDay(userA, day!.id, { notes: "hijacked" })).toBeNull();
    expect(await plansRepo.updateDay(userA, day!.id, { structure: null })).toBeNull();
    expect(await plansRepo.updateDay(userA, day!.id, {})).toBeNull();
    expect(await plansRepo.removeDay(userA, day!.id)).toBe(false);
    const [row] = await db.select().from(planDays).where(eq(planDays.id, day!.id));
    expect(row).toMatchObject({ notes: "mine", structure: gym });
  });

  it("applyToCalendar refuses another user's plan and inserts nothing", async () => {
    const b = await plansRepo.create(userB, { name: "Not yours", weeks: 1 });
    await plansRepo.addDay(userB, b.id, { weekIndex: 0, dayOfWeek: 0, type: "run" });
    await plansRepo.addDay(userB, b.id, { weekIndex: 0, dayOfWeek: 3, type: "bike" });

    expect(await plansRepo.applyToCalendar(userA, b.id, "2035-01-01")).toBeNull();
    expect(await plansRepo.previewApply(userA, b.id, "2035-01-01")).toBeNull();
    expect(await workoutsOf(userA, "2035-01-01", "2035-01-07")).toHaveLength(0);
    expect(await workoutsOf(userB, "2035-01-01", "2035-01-07")).toHaveLength(0);
  });

  it("deleting a user cascades their plans and plan days", async () => {
    const tmp = `test-pc-${run}`;
    await db.insert(users).values({ id: tmp, email: `${tmp}@test.invalid` });
    const p = await plansRepo.create(tmp, { name: "tmp", weeks: 1 });
    await plansRepo.addDay(tmp, p.id, { weekIndex: 0, dayOfWeek: 0, type: "other" });
    await db.delete(users).where(eq(users.id, tmp));
    expect(await db.select().from(plans).where(eq(plans.userId, tmp))).toHaveLength(0);
    expect(
      await db
        .select()
        .from(planDays)
        .where(and(eq(planDays.planId, p.id))),
    ).toHaveLength(0);
  });
});
