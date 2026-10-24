/**
 * Integration tests against a real Postgres (Neon branch in CI, your own
 * branch locally via DATABASE_URL). Creates two throwaway users and deletes
 * them afterwards; workouts cascade.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/db";
import { users, workouts } from "@/db/schema";
import type { WorkoutStructure } from "@/lib/workout-structure";
import { workoutsRepo } from "./index";

const run = crypto.randomUUID().slice(0, 8);
const userA = `test-a-${run}`;
const userB = `test-b-${run}`;

beforeAll(async () => {
  await db.insert(users).values([
    { id: userA, email: `${userA}@test.invalid`, name: "User A" },
    { id: userB, email: `${userB}@test.invalid`, name: "User B" },
  ]);
});

afterAll(async () => {
  await db.delete(users).where(inArray(users.id, [userA, userB]));
});

describe("workoutsRepo", () => {
  it("create → listByDateRange round-trips", async () => {
    const created = await workoutsRepo.create(userA, {
      date: "2026-10-15",
      type: "run",
      notes: "  easy 5k  ",
    });
    expect(created.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(created.userId).toBe(userA);
    expect(created.date).toBe("2026-10-15");
    expect(created.type).toBe("run");
    expect(created.notes).toBe("easy 5k");
    expect(created.done).toBe(false);
    expect(created.completedAt).toBeNull();

    const listed = await workoutsRepo.listByDateRange(userA, "2026-10-01", "2026-10-31");
    expect(listed.map((w) => w.id)).toContain(created.id);
  });

  it("stores empty notes as null", async () => {
    const w = await workoutsRepo.create(userA, { date: "2026-10-16", type: "gym", notes: "   " });
    expect(w.notes).toBeNull();
  });

  it("listByDateRange is inclusive on both ends and excludes outside days", async () => {
    await workoutsRepo.create(userA, { date: "2026-11-01", type: "bike" });
    await workoutsRepo.create(userA, { date: "2026-11-30", type: "bike" });
    await workoutsRepo.create(userA, { date: "2026-12-01", type: "bike" });

    const nov = await workoutsRepo.listByDateRange(userA, "2026-11-01", "2026-11-30");
    expect(nov.map((w) => w.date).sort()).toEqual(["2026-11-01", "2026-11-30"]);
    expect(nov.every((w) => w.userId === userA)).toBe(true);
  });

  it("CRITICAL: never returns another user's workouts", async () => {
    const a = await workoutsRepo.create(userA, { date: "2026-09-10", type: "tempo" });
    const b = await workoutsRepo.create(userB, { date: "2026-09-10", type: "tempo" });

    const forA = await workoutsRepo.listByDateRange(userA, "2026-09-01", "2026-09-30");
    const forB = await workoutsRepo.listByDateRange(userB, "2026-09-01", "2026-09-30");

    expect(forA.map((w) => w.id)).toEqual([a.id]);
    expect(forB.map((w) => w.id)).toEqual([b.id]);

    // findById with the wrong user must behave as "not found", not leak.
    expect(await workoutsRepo.findById(userA, b.id)).toBeNull();
    expect(await workoutsRepo.findById(userB, b.id)).not.toBeNull();
  });

  it("setDone stamps completed_at on true and clears it on false", async () => {
    const w = await workoutsRepo.create(userA, { date: "2026-08-01", type: "run" });

    const on = await workoutsRepo.setDone(userA, w.id, true);
    expect(on?.done).toBe(true);
    expect(on?.completedAt).toBeInstanceOf(Date);
    const firstStamp = on!.completedAt!.getTime();

    // Re-marking done keeps the original completion time.
    const again = await workoutsRepo.setDone(userA, w.id, true);
    expect(again?.completedAt?.getTime()).toBe(firstStamp);

    const off = await workoutsRepo.setDone(userA, w.id, false);
    expect(off?.done).toBe(false);
    expect(off?.completedAt).toBeNull();

    const onAgain = await workoutsRepo.setDone(userA, w.id, true);
    expect(onAgain?.done).toBe(true);
    expect(onAgain?.completedAt?.getTime()).toBeGreaterThanOrEqual(firstStamp);

    // Persisted, not just returned.
    const reread = await workoutsRepo.findById(userA, w.id);
    expect(reread?.done).toBe(true);
    expect(reread?.completedAt).not.toBeNull();
  });

  it("CRITICAL: setDone cannot touch another user's workout", async () => {
    const b = await workoutsRepo.create(userB, { date: "2026-08-02", type: "bike" });
    expect(await workoutsRepo.setDone(userA, b.id, true)).toBeNull();
    const untouched = await workoutsRepo.findById(userB, b.id);
    expect(untouched?.done).toBe(false);
    expect(untouched?.completedAt).toBeNull();
  });

  it("update changes only the given fields and persists them", async () => {
    const w = await workoutsRepo.create(userA, { date: "2026-07-01", type: "run", notes: "old" });

    const updated = await workoutsRepo.update(userA, w.id, { type: "tempo", notes: "  new  " });
    expect(updated?.type).toBe("tempo");
    expect(updated?.notes).toBe("new");
    expect(updated?.date).toBe("2026-07-01");

    const moved = await workoutsRepo.update(userA, w.id, { date: "2026-07-03", notes: "" });
    expect(moved?.date).toBe("2026-07-03");
    expect(moved?.notes).toBeNull();
    expect(moved?.type).toBe("tempo");

    const reread = await workoutsRepo.findById(userA, w.id);
    expect(reread).toMatchObject({ date: "2026-07-03", type: "tempo", notes: null });
  });

  it("CRITICAL: update cannot touch another user's workout", async () => {
    const b = await workoutsRepo.create(userB, { date: "2026-07-05", type: "bike", notes: "mine" });
    expect(await workoutsRepo.update(userA, b.id, { notes: "hijacked", type: "gym" })).toBeNull();
    expect(await workoutsRepo.findById(userB, b.id)).toMatchObject({ notes: "mine", type: "bike" });
  });

  it("delete removes the workout", async () => {
    const w = await workoutsRepo.create(userA, { date: "2026-07-07", type: "gym" });
    expect(await workoutsRepo.delete(userA, w.id)).toBe(true);
    expect(await workoutsRepo.findById(userA, w.id)).toBeNull();
    expect(await workoutsRepo.delete(userA, w.id)).toBe(false);
  });

  it("CRITICAL: delete cannot remove another user's workout", async () => {
    const b = await workoutsRepo.create(userB, { date: "2026-07-08", type: "gym" });
    expect(await workoutsRepo.delete(userA, b.id)).toBe(false);
    expect(await workoutsRepo.findById(userB, b.id)).not.toBeNull();
  });

  it("creates without structure by default (existing behaviour unchanged)", async () => {
    const w = await workoutsRepo.create(userA, { date: "2026-06-01", type: "run", notes: "easy" });
    expect(w.structure).toBeNull();
  });

  it("structure round-trips through create and update; null clears it", async () => {
    const gym: WorkoutStructure = {
      kind: "strength",
      exercises: [
        {
          name: "Squat",
          sets: [
            { reps: 5, weightKg: 100 },
            { reps: 5, weightKg: 100 },
          ],
        },
        { name: "Pull-up", sets: [{ reps: 8 }] },
      ],
    };
    const created = await workoutsRepo.create(userA, {
      date: "2026-06-02",
      type: "gym",
      structure: gym,
    });
    expect(created.structure).toEqual(gym);
    expect((await workoutsRepo.findById(userA, created.id))?.structure).toEqual(gym);

    const tempo: WorkoutStructure = {
      kind: "intervals",
      warmupMin: 15,
      repeats: [{ count: 3, durationS: 600, targetPace: "4:05", restS: 120 }],
    };
    const updated = await workoutsRepo.update(userA, created.id, {
      type: "tempo",
      structure: tempo,
    });
    expect(updated?.structure).toEqual(tempo);

    // Updating other fields leaves the structure alone.
    const notesOnly = await workoutsRepo.update(userA, created.id, { notes: "felt good" });
    expect(notesOnly?.structure).toEqual(tempo);

    const cleared = await workoutsRepo.update(userA, created.id, { structure: null });
    expect(cleared?.structure).toBeNull();
    // Stored as SQL NULL, not a JSON null.
    const [row] = await db
      .select({ id: workouts.id })
      .from(workouts)
      .where(and(eq(workouts.id, created.id), isNull(workouts.structure)));
    expect(row?.id).toBe(created.id);
  });

  it("CRITICAL: update cannot change another user's structure", async () => {
    const mine: WorkoutStructure = { kind: "endurance", distanceKm: 18 };
    const b = await workoutsRepo.create(userB, {
      date: "2026-06-03",
      type: "long_run",
      structure: mine,
    });
    expect(await workoutsRepo.update(userA, b.id, { structure: null })).toBeNull();
    expect(
      await workoutsRepo.update(userA, b.id, {
        structure: { kind: "endurance", distanceKm: 1 },
      }),
    ).toBeNull();
    expect((await workoutsRepo.findById(userB, b.id))?.structure).toEqual(mine);
  });

  it("deleting a user cascades their workouts", async () => {
    const tmp = `test-c-${run}`;
    await db.insert(users).values({ id: tmp, email: `${tmp}@test.invalid` });
    await workoutsRepo.create(tmp, { date: "2026-10-20", type: "other" });
    await db.delete(users).where(eq(users.id, tmp));
    const left = await db.select().from(workouts).where(eq(workouts.userId, tmp));
    expect(left).toHaveLength(0);
  });
});
