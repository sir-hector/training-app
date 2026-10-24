import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { format } from "date-fns";
import { ChevronLeft } from "lucide-react";
import { z } from "zod";
import { auth } from "@/auth";
import { AppNav } from "@/components/app-nav";
import { ApplyPlanDialog } from "@/components/plans/apply-plan-dialog";
import { PlanGrid } from "@/components/plans/plan-grid";
import { PlanSettings } from "@/components/plans/plan-settings";
import { plansRepo } from "@/lib/plans-repo";

export const metadata: Metadata = {
  title: "Plan · Training App",
};

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

export default async function PlanPage({ params }: { params: Promise<{ id: string }> }) {
  const [session, { id }] = await Promise.all([auth(), params]);
  // The proxy already redirects anonymous visitors; this is the real check.
  if (!session) redirect(`/?callbackUrl=/app/plans/${encodeURIComponent(id)}`);

  // A malformed id would make Postgres reject the uuid comparison.
  if (!z.uuid().safeParse(id).success) notFound();
  const plan = await plansRepo.findById(session.user.id, id);
  // Someone else's plan looks exactly like a missing one.
  if (!plan) notFound();

  // Same "today" as the calendar: the server's local date.
  const today = format(new Date(), "yyyy-MM-dd");

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-5xl flex-col gap-5 px-3 py-4 sm:p-8">
      <header className="flex items-center justify-between gap-2">
        <Link
          href="/app/plans"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
        >
          <ChevronLeft className="size-4" aria-hidden />
          All plans
        </Link>
        <AppNav current="plans" />
      </header>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="font-heading truncate text-2xl font-bold tracking-tight sm:text-3xl">
            {plan.name}
          </h1>
          <p className="text-muted-foreground text-sm">
            {plural(plan.weeks, "week")} · {plural(plan.days.length, "workout")}
          </p>
        </div>
        <ApplyPlanDialog
          planId={plan.id}
          planName={plan.name}
          weeks={plan.weeks}
          workoutCount={plan.days.length}
          todayIso={today}
        />
      </div>

      <PlanSettings
        key={`${plan.name}:${plan.weeks}`}
        planId={plan.id}
        name={plan.name}
        weeks={plan.weeks}
        dayWeekIndexes={plan.days.map((d) => d.weekIndex)}
      />

      <PlanGrid planId={plan.id} weeks={plan.weeks} days={plan.days} />
    </main>
  );
}
