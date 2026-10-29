import { and, asc, count, desc, eq, getTableColumns, gte, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { planDays, plans, workouts, type Plan, type PlanDay } from "@/db/schema";
import { PLAN_MAX_WEEKS, planDayDate } from "@/lib/plan-dates";
import { withoutExerciseDone, type WorkoutStructure } from "@/lib/workout-structure";
import type { WorkoutType } from "@/lib/workout-types";

export type { Plan, PlanDay };
export { PLAN_MAX_WEEKS };

export type PlanSummary = Plan & { dayCount: number };
export type PlanWithDays = Plan & { days: PlanDay[] };

export type CreatePlanInput = { name: string; weeks: number };
export type UpdatePlanPatch = { name?: string; weeks?: number };

export type PlanDayInput = {
  /** 0-based; must be below the plan's `weeks`. */
  weekIndex: number;
  /** 0 = Monday … 6 = Sunday. */
  dayOfWeek: number;
  type: WorkoutType;
  notes?: string | null;
  /** Validate with `workout-structure` before calling. */
  structure?: WorkoutStructure | null;
};

export type UpdatePlanDayPatch = {
  type?: WorkoutType;
  notes?: string | null;
  /** `null` clears it; omit to leave it unchanged. */
  structure?: WorkoutStructure | null;
};

function normalizeNotes(notes: string | null | undefined): string | null {
  const trimmed = notes?.trim();
  return trimmed ? trimmed : null;
}

function checkWeeks(weeks: number): void {
  if (!Number.isInteger(weeks) || weeks < 1 || weeks > PLAN_MAX_WEEKS) {
    throw new RangeError(`weeks must be an integer 1–${PLAN_MAX_WEEKS}, got ${weeks}`);
  }
}

function checkDayPosition(weekIndex: number, dayOfWeek: number): void {
  if (!Number.isInteger(weekIndex) || weekIndex < 0 || weekIndex >= PLAN_MAX_WEEKS) {
    throw new RangeError(`weekIndex out of range: ${weekIndex}`);
  }
  if (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
    throw new RangeError(`dayOfWeek must be 0–6, got ${dayOfWeek}`);
  }
}

/** Ids of the plans `userId` owns, as a subquery for scoping plan_days writes. */
function ownedPlanIds(userId: string) {
  return db.select({ id: plans.id }).from(plans).where(eq(plans.userId, userId));
}

/**
 * Data access for plan templates. **Every method takes `userId` first and
 * scopes its query to it**, exactly like `workoutsRepo`: a plan (and its days)
 * that `userId` doesn't own behaves as if it doesn't exist.
 *
 * Plan days don't carry a `user_id`; they are scoped through their plan.
 */
export const plansRepo = {
  async create(userId: string, input: CreatePlanInput): Promise<Plan> {
    checkWeeks(input.weeks);
    const [row] = await db
      .insert(plans)
      .values({ userId, name: input.name.trim(), weeks: input.weeks })
      .returning();
    return row;
  },

  /** The user's plans, newest first, each with its number of plan workouts. */
  async list(userId: string): Promise<PlanSummary[]> {
    return db
      .select({ ...getTableColumns(plans), dayCount: count(planDays.id) })
      .from(plans)
      .leftJoin(planDays, eq(planDays.planId, plans.id))
      .where(eq(plans.userId, userId))
      .groupBy(plans.id)
      .orderBy(desc(plans.createdAt), desc(plans.id));
  },

  /** A plan with its days ordered by week, weekday, then creation. */
  async findById(userId: string, id: string): Promise<PlanWithDays | null> {
    const [plan] = await db
      .select()
      .from(plans)
      .where(and(eq(plans.userId, userId), eq(plans.id, id)))
      .limit(1);
    if (!plan) return null;
    const days = await db
      .select()
      .from(planDays)
      .where(eq(planDays.planId, plan.id))
      .orderBy(asc(planDays.weekIndex), asc(planDays.dayOfWeek), asc(planDays.createdAt));
    return { ...plan, days };
  },

  /**
   * Rename and/or resize a plan. Shrinking `weeks` removes the plan days in
   * the dropped weeks, in the same transaction. Returns null when the plan
   * doesn't exist for this user (nothing is written).
   */
  async update(userId: string, id: string, patch: UpdatePlanPatch): Promise<Plan | null> {
    const set: Partial<typeof plans.$inferInsert> = {};
    if (patch.name !== undefined) set.name = patch.name.trim();
    if (patch.weeks !== undefined) {
      checkWeeks(patch.weeks);
      set.weeks = patch.weeks;
    }
    if (Object.keys(set).length === 0) {
      const [row] = await db
        .select()
        .from(plans)
        .where(and(eq(plans.userId, userId), eq(plans.id, id)))
        .limit(1);
      return row ?? null;
    }

    const update = db
      .update(plans)
      .set(set)
      .where(and(eq(plans.userId, userId), eq(plans.id, id)))
      .returning();
    if (patch.weeks === undefined) {
      const [row] = await update;
      return row ?? null;
    }
    // neon-http has no interactive transactions; `batch` runs both
    // statements in one transaction.
    const [updated] = await db.batch([
      update,
      db
        .delete(planDays)
        .where(
          and(
            eq(planDays.planId, id),
            inArray(planDays.planId, ownedPlanIds(userId)),
            gte(planDays.weekIndex, patch.weeks),
          ),
        ),
    ]);
    return updated[0] ?? null;
  },

  /** Delete a plan and its days. Returns false when it doesn't exist for this user. */
  async delete(userId: string, id: string): Promise<boolean> {
    const rows = await db
      .delete(plans)
      .where(and(eq(plans.userId, userId), eq(plans.id, id)))
      .returning({ id: plans.id });
    return rows.length > 0;
  },

  /**
   * Add a workout to a plan day. One statement: the row is only inserted
   * when the plan belongs to `userId` and `weekIndex` is inside the plan.
   * Returns null otherwise.
   */
  async addDay(userId: string, planId: string, input: PlanDayInput): Promise<PlanDay | null> {
    checkDayPosition(input.weekIndex, input.dayOfWeek);
    const notes = normalizeNotes(input.notes);
    // Ticking exercises off is a calendar-only concept: templates never carry it.
    const structure = input.structure ? JSON.stringify(withoutExerciseDone(input.structure)) : null;
    const [row] = await db
      .insert(planDays)
      .select(
        db
          .select({
            // Same keys, same order as the table definition.
            id: sql`gen_random_uuid()`.as("id"),
            planId: plans.id,
            weekIndex: sql`${input.weekIndex}::integer`.as("week_index"),
            dayOfWeek: sql`${input.dayOfWeek}::integer`.as("day_of_week"),
            type: sql`${input.type}::workout_type`.as("type"),
            notes: sql`${notes}::text`.as("notes"),
            structure: sql`${structure}::jsonb`.as("structure"),
            createdAt: sql`now()`.as("created_at"),
          })
          .from(plans)
          .where(
            and(
              eq(plans.userId, userId),
              eq(plans.id, planId),
              sql`${plans.weeks} > ${input.weekIndex}`,
            ),
          ),
      )
      .returning();
    return row ?? null;
  },

  /** Returns null when the day doesn't exist in one of this user's plans. */
  async updateDay(
    userId: string,
    dayId: string,
    patch: UpdatePlanDayPatch,
  ): Promise<PlanDay | null> {
    const set: Partial<typeof planDays.$inferInsert> = {};
    if (patch.type !== undefined) set.type = patch.type;
    if (patch.notes !== undefined) set.notes = normalizeNotes(patch.notes);
    if (patch.structure !== undefined) set.structure = withoutExerciseDone(patch.structure);
    const scope = and(eq(planDays.id, dayId), inArray(planDays.planId, ownedPlanIds(userId)));
    if (Object.keys(set).length === 0) {
      const [row] = await db.select().from(planDays).where(scope).limit(1);
      return row ?? null;
    }
    const [row] = await db.update(planDays).set(set).where(scope).returning();
    return row ?? null;
  },

  /** Returns false when the day doesn't exist in one of this user's plans. */
  async removeDay(userId: string, dayId: string): Promise<boolean> {
    const rows = await db
      .delete(planDays)
      .where(and(eq(planDays.id, dayId), inArray(planDays.planId, ownedPlanIds(userId))))
      .returning({ id: planDays.id });
    return rows.length > 0;
  },

  /**
   * Stamp the plan onto the calendar: one workout per plan day, dated
   * `startMonday + weekIndex * 7 + dayOfWeek`. All rows go in a single
   * multi-row INSERT, so it is atomic: every workout is created or none is.
   *
   * Exercise `done` flags are stripped, so every stamped workout starts
   * with nothing ticked off.
   *
   * Returns the number of workouts created, or null when the plan doesn't
   * exist for this user (nothing is written). Throws a RangeError when
   * `startMonday` isn't a Monday.
   */
  async applyToCalendar(
    userId: string,
    planId: string,
    startMonday: string,
  ): Promise<number | null> {
    // Validate before touching the database (throws for a non-Monday).
    planDayDate(startMonday, 0, 0);
    const plan = await this.findById(userId, planId);
    if (!plan) return null;
    if (plan.days.length === 0) return 0;

    const rows = await db
      .insert(workouts)
      .values(
        plan.days.map((d) => ({
          userId,
          date: planDayDate(startMonday, d.weekIndex, d.dayOfWeek),
          type: d.type,
          notes: d.notes,
          // Fresh workouts start with nothing ticked off (also guards rows
          // written before plan days stripped the flag).
          structure: withoutExerciseDone(d.structure),
        })),
      )
      .returning({ id: workouts.id });
    return rows.length;
  },
};

export type PlansRepo = typeof plansRepo;
