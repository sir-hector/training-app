import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import type { AdapterAccountType } from "next-auth/adapters";
import { PLAN_MAX_WEEKS } from "@/lib/plan-dates";
import type { WorkoutStructure } from "@/lib/workout-structure";
import { WORKOUT_TYPES } from "@/lib/workout-types";

// Auth.js tables. Shape follows the Drizzle adapter's expected schema:
// https://authjs.dev/getting-started/adapters/drizzle

export const users = pgTable("users", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").unique(),
  emailVerified: timestamp("email_verified", { mode: "date" }),
  image: text("image"),
});

export const accounts = pgTable(
  "accounts",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<AdapterAccountType>().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (account) => [primaryKey({ columns: [account.provider, account.providerAccountId] })],
);

export const sessions = pgTable("sessions", {
  sessionToken: text("session_token").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (vt) => [primaryKey({ columns: [vt.identifier, vt.token] })],
);

export const authenticators = pgTable(
  "authenticators",
  {
    credentialID: text("credential_id").notNull().unique(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    providerAccountId: text("provider_account_id").notNull(),
    credentialPublicKey: text("credential_public_key").notNull(),
    counter: integer("counter").notNull(),
    credentialDeviceType: text("credential_device_type").notNull(),
    credentialBackedUp: boolean("credential_backed_up").notNull(),
    transports: text("transports"),
  },
  (authenticator) => [primaryKey({ columns: [authenticator.userId, authenticator.credentialID] })],
);

// ---------------------------------------------------------------------------
// App tables
// ---------------------------------------------------------------------------

export const workoutTypeEnum = pgEnum("workout_type", WORKOUT_TYPES);

export const workouts = pgTable(
  "workouts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** Day precision, stored as a DATE; read/written as "YYYY-MM-DD". */
    date: date("date", { mode: "string" }).notNull(),
    type: workoutTypeEnum("type").notNull(),
    notes: text("notes"),
    /** Optional sets/reps, intervals or distance targets; validated by `workout-structure`. */
    structure: jsonb("structure").$type<WorkoutStructure>(),
    done: boolean("done").notNull().default(false),
    completedAt: timestamp("completed_at", { withTimezone: true, mode: "date" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [index("workouts_user_id_date_idx").on(t.userId, t.date)],
);

export type Workout = typeof workouts.$inferSelect;
export type NewWorkout = typeof workouts.$inferInsert;

// ---------------------------------------------------------------------------
// Plan templates: reusable multi-week programs, stamped onto the calendar.
// ---------------------------------------------------------------------------

export { PLAN_MAX_WEEKS };

export const plans = pgTable(
  "plans",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    /** Length of the program, 1–26 weeks. */
    weeks: integer("weeks").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("plans_user_id_idx").on(t.userId),
    check("plans_weeks_range", sql`${t.weeks} between 1 and ${sql.raw(String(PLAN_MAX_WEEKS))}`),
  ],
);

export const planDays = pgTable(
  "plan_days",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    planId: uuid("plan_id")
      .notNull()
      .references(() => plans.id, { onDelete: "cascade" }),
    /** 0-based week of the plan. */
    weekIndex: integer("week_index").notNull(),
    /** 0 = Monday … 6 = Sunday. */
    dayOfWeek: integer("day_of_week").notNull(),
    type: workoutTypeEnum("type").notNull(),
    notes: text("notes"),
    /** Same shape as `workouts.structure`; validated by `workout-structure`. */
    structure: jsonb("structure").$type<WorkoutStructure>(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    // Not unique: a plan day can hold several workouts.
    index("plan_days_plan_week_day_idx").on(t.planId, t.weekIndex, t.dayOfWeek),
    check(
      "plan_days_week_index_range",
      sql`${t.weekIndex} between 0 and ${sql.raw(String(PLAN_MAX_WEEKS - 1))}`,
    ),
    check("plan_days_day_of_week_range", sql`${t.dayOfWeek} between 0 and 6`),
  ],
);

export type Plan = typeof plans.$inferSelect;
export type PlanDay = typeof planDays.$inferSelect;
