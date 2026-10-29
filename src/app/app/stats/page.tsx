import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getToday } from "@/lib/today/server";
import { AppNav } from "@/components/app-nav";
import { StatTile } from "@/components/stats/stat-tile";
import { TypeBreakdown } from "@/components/stats/type-breakdown";
import { WeeklyChart } from "@/components/stats/weekly-chart";
import { computeWorkoutStats, lastWeeksRange, totalsOf } from "@/lib/workout-stats";
import { workoutsRepo } from "@/lib/workouts-repo";

export const metadata: Metadata = {
  title: "Stats · Training App",
};

const WEEKS = 12;

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

export default async function StatsPage() {
  // The proxy already redirects anonymous visitors; this is the real check.
  const session = await auth();
  if (!session) redirect("/?callbackUrl=/app/stats");

  // Same "today" as the calendar: the user's timezone (see lib/today).
  const today = await getToday();
  const range = lastWeeksRange(today, WEEKS);
  const workouts = await workoutsRepo.listByDateRange(session.user.id, range.from, range.to);
  const stats = computeWorkoutStats(workouts, { ...range, today });

  const thisWeek = stats.weeks[stats.weeks.length - 1];
  const lastFour = totalsOf(stats.weeks.slice(-4));
  const due = lastFour.done + lastFour.missed;
  const { streak } = stats;

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-5xl flex-col gap-6 px-3 py-4 sm:p-8">
      <header className="flex items-center justify-between gap-2">
        <h1 className="font-heading text-2xl font-bold tracking-tight sm:text-3xl">Stats</h1>
        <AppNav current="stats" />
      </header>

      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        <StatTile
          label="This week"
          value={`${thisWeek.done} / ${thisWeek.planned}`}
          detail={thisWeek.planned === 0 ? "Nothing planned" : "workouts done"}
        />
        <StatTile
          label="Last 4 weeks"
          value={
            lastFour.completionRate === null ? "–" : `${Math.round(lastFour.completionRate * 100)}%`
          }
          detail={due === 0 ? "Nothing due yet" : `${lastFour.done} of ${due} done`}
        />
        <StatTile
          label="Current streak"
          value={`${streak.weeks}${streak.reachesRangeStart ? "+" : ""}`}
          unit={streak.weeks === 1 ? "week" : "weeks"}
          detail={streak.weeks === 0 ? "Finish a workout to start" : "in a row"}
        />
      </div>

      <div className="bg-card rounded-xl border p-3 sm:p-5">
        <WeeklyChart weeks={stats.weeks} currentWeekStart={thisWeek.start} />
      </div>

      <div className="bg-card rounded-xl border p-3 sm:p-5">
        <TypeBreakdown byType={stats.totals.byType} weeks={WEEKS} />
      </div>

      <p className="text-muted-foreground text-xs">
        Last {WEEKS} weeks: {plural(stats.totals.done, "workout")} done of {stats.totals.planned}{" "}
        planned. Workouts from today on never count as missed.
      </p>
    </main>
  );
}
