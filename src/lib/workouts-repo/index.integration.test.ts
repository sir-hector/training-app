/**
 * Integration tests against a real Postgres (Neon branch in CI, your own
 * branch locally via DATABASE_URL). Creates two throwaway users and deletes
 * them afterwards; workouts cascade.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { users, workouts } from "@/db/schema";
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

  it("deleting a user cascades their workouts", async () => {
    const tmp = `test-c-${run}`;
    await db.insert(users).values({ id: tmp, email: `${tmp}@test.invalid` });
    await workoutsRepo.create(tmp, { date: "2026-10-20", type: "other" });
    await db.delete(users).where(eq(users.id, tmp));
    const left = await db.select().from(workouts).where(eq(workouts.userId, tmp));
    expect(left).toHaveLength(0);
  });
});
