CREATE TABLE "plan_days" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_id" uuid NOT NULL,
	"week_index" integer NOT NULL,
	"day_of_week" integer NOT NULL,
	"type" "workout_type" NOT NULL,
	"notes" text,
	"structure" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "plan_days_week_index_range" CHECK ("plan_days"."week_index" between 0 and 25),
	CONSTRAINT "plan_days_day_of_week_range" CHECK ("plan_days"."day_of_week" between 0 and 6)
);
--> statement-breakpoint
CREATE TABLE "plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"weeks" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "plans_weeks_range" CHECK ("plans"."weeks" between 1 and 26)
);
--> statement-breakpoint
ALTER TABLE "plan_days" ADD CONSTRAINT "plan_days_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plans" ADD CONSTRAINT "plans_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "plan_days_plan_week_day_idx" ON "plan_days" USING btree ("plan_id","week_index","day_of_week");--> statement-breakpoint
CREATE INDEX "plans_user_id_idx" ON "plans" USING btree ("user_id");