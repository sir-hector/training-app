import { and, asc, eq, gte, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import { workouts, type Workout } from "@/db/schema";
import type { WorkoutStructure } from "@/lib/workout-structure";
import type { WorkoutType } from "@/lib/workout-types";

export type { Workout };

export type UpdateWorkoutPatch = {
  /** "YYYY-MM-DD" */
  date?: string;
  type?: WorkoutType;
  notes?: string | null;
  /** `null` clears it; omit to leave it unchanged. Validate before calling. */
  structure?: WorkoutStructure | null;
};

export type CreateWorkoutInput = {
  /** "YYYY-MM-DD" */
  date: string;
  type: WorkoutType;
  notes?: string | null;
  /** Validate with `workout-structure` before calling. */
  structure?: WorkoutStructure | null;
};

function normalizeNotes(notes: string | null | undefined): string | null {
  const trimmed = notes?.trim();
  return trimmed ? trimmed : null;
}

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
        notes: normalizeNotes(input.notes),
        structure: input.structure ?? null,
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
   * Apply a partial update. Returns the updated row, or null when the
   * workout doesn't exist for this user (nothing is written).
   */
  async update(userId: string, id: string, patch: UpdateWorkoutPatch): Promise<Workout | null> {
    const set: Partial<typeof workouts.$inferInsert> = {};
    if (patch.date !== undefined) set.date = patch.date;
    if (patch.type !== undefined) set.type = patch.type;
    if (patch.notes !== undefined) set.notes = normalizeNotes(patch.notes);
    if (patch.structure !== undefined) set.structure = patch.structure;
    if (Object.keys(set).length === 0) return this.findById(userId, id);

    const [row] = await db
      .update(workouts)
      .set(set)
      .where(and(eq(workouts.userId, userId), eq(workouts.id, id)))
      .returning();
    return row ?? null;
  },

  /** Delete a workout. Returns false when it doesn't exist for this user. */
  async delete(userId: string, id: string): Promise<boolean> {
    const rows = await db
      .delete(workouts)
      .where(and(eq(workouts.userId, userId), eq(workouts.id, id)))
      .returning({ id: workouts.id });
    return rows.length > 0;
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

  /**
   * Tick exercise `index` of a strength workout off (or back on) and apply
   * the rule linking exercises to the workout:
   * - ticking the last unticked exercise marks the workout done (stamping
   *   `completed_at` like `setDone`, keeping an existing stamp);
   * - unticking any exercise of a done workout marks it not done.
   * Otherwise `done`/`completed_at` are left alone.
   *
   * One UPDATE scoped by user and id: the jsonb is patched in place with
   * `jsonb_set` / `#-` (only that exercise's `done` key), so two quick ticks
   * on different exercises can't overwrite each other the way a read-modify-
   * write of the whole structure could, and the "all done?" check reads the
   * row under the UPDATE's row lock. Returns null (nothing written) when the
   * workout doesn't exist for this user, isn't a strength workout, or
   * `index` is out of range.
   */
  async setExerciseDone(
    userId: string,
    id: string,
    index: number,
    done: boolean,
  ): Promise<Workout | null> {
    if (!Number.isInteger(index) || index < 0) return null;
    const path = sql`array['exercises', ${String(index)}, 'done']::text[]`;
    // Every *other* exercise is already done (column refs in SET see the old row).
    const othersDone = sql`not exists (
      select 1
      from jsonb_array_elements(${workouts.structure} -> 'exercises') with ordinality as e(ex, ord)
      where e.ord <> ${index + 1}::bigint
        and (e.ex -> 'done') is distinct from 'true'::jsonb
    )`;
    const set = done
      ? {
          structure: sql`jsonb_set(${workouts.structure}, ${path}, 'true'::jsonb)`,
          done: sql`${workouts.done} or ${othersDone}`,
          completedAt: sql`case when ${workouts.done} or ${othersDone}
            then coalesce(${workouts.completedAt}, now()) else ${workouts.completedAt} end`,
        }
      : {
          structure: sql`${workouts.structure} #- ${path}`,
          done: false,
          completedAt: null,
        };
    const [row] = await db
      .update(workouts)
      .set(set)
      .where(
        and(
          eq(workouts.userId, userId),
          eq(workouts.id, id),
          sql`${workouts.structure} ->> 'kind' = 'strength'`,
          sql`jsonb_array_length(${workouts.structure} -> 'exercises') > ${index}::integer`,
        ),
      )
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
