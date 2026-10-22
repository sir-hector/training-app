import { and, asc, eq, gte, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import { workouts, type Workout } from "@/db/schema";
import type { WorkoutType } from "@/lib/workout-types";

export type { Workout };

export type CreateWorkoutInput = {
  /** "YYYY-MM-DD" */
  date: string;
  type: WorkoutType;
  notes?: string | null;
};

/**
 * Data access for workouts. **Every method takes `userId` first and scopes
 * its query to it.** No method here can return or touch another user's rows;
 * that invariant is the one security-critical rule in the app (see PRD).
 *
 * Callers (server actions, route handlers) resolve `userId` from `auth()`
 * and never touch Drizzle directly.
 */
export const workoutsRepo = {
  async create(userId: string, input: CreateWorkoutInput): Promise<Workout> {
    const [row] = await db
      .insert(workouts)
      .values({
        userId,
        date: input.date,
        type: input.type,
        notes: input.notes?.trim() ? input.notes.trim() : null,
      })
      .returning();
    return row;
  },

  /**
   * Workouts for `userId` with `from <= date <= to` (both "YYYY-MM-DD",
   * inclusive), ordered by date then creation time.
   */
  async listByDateRange(userId: string, from: string, to: string): Promise<Workout[]> {
    return db
      .select()
      .from(workouts)
      .where(and(eq(workouts.userId, userId), gte(workouts.date, from), lte(workouts.date, to)))
      .orderBy(asc(workouts.date), asc(workouts.createdAt));
  },

  /**
   * Mark a workout done or not done. Turning it on stamps `completed_at`
   * (keeping the original stamp if it was already done); turning it off
   * clears it. Returns null when the workout doesn't exist for this user.
   */
  async setDone(userId: string, id: string, done: boolean): Promise<Workout | null> {
    const [row] = await db
      .update(workouts)
      .set({
        done,
        completedAt: done ? sql`coalesce(${workouts.completedAt}, now())` : null,
      })
      .where(and(eq(workouts.userId, userId), eq(workouts.id, id)))
      .returning();
    return row ?? null;
  },

  async findById(userId: string, id: string): Promise<Workout | null> {
    const [row] = await db
      .select()
      .from(workouts)
      .where(and(eq(workouts.userId, userId), eq(workouts.id, id)))
      .limit(1);
    return row ?? null;
  },
};

export type WorkoutsRepo = typeof workoutsRepo;
