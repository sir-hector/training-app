import { redirect } from "next/navigation";
import { format } from "date-fns";
import { auth } from "@/auth";
import { AppNav } from "@/components/app-nav";
import { MonthGrid } from "@/components/calendar/month-grid";
import { MonthNav } from "@/components/calendar/month-nav";
import { getMonthGrid } from "@/lib/calendar-grid";
import { workoutsRepo } from "@/lib/workouts-repo";

const MONTH_PARAM = /^(\d{4})-(\d{2})$/;

function resolveMonth(param: string | undefined, now: Date): { year: number; month: number } {
  const m = param?.match(MONTH_PARAM);
  if (m) {
    const year = Number(m[1]);
    const month = Number(m[2]);
    if (month >= 1 && month <= 12 && year >= 1970 && year <= 2200) return { year, month };
  }
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

export default async function AppPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  // The proxy already redirects anonymous visitors, but verify again here —
  // the proxy is an optimistic check, not the source of truth.
  const [session, params] = await Promise.all([auth(), searchParams]);
  if (!session) redirect("/?callbackUrl=/app");

  // "Today" is the server's clock (UTC on Fly). Good enough for v1; revisit if
  // the highlight is off near midnight.
  const now = new Date();
  const { year, month } = resolveMonth(params.month, now);
  const grid = getMonthGrid(year, month);

  // Fetch the whole visible range so padding days show their workouts too.
  const days = grid.weeks.flat();
  const workouts = await workoutsRepo.listByDateRange(
    session.user.id,
    days[0].iso,
    days[days.length - 1].iso,
  );

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-5xl flex-col gap-5 px-3 py-4 sm:p-8">
      <header className="flex items-center justify-between gap-2">
        <h1 className="font-heading text-2xl font-bold tracking-tight sm:text-3xl">Training</h1>
        <AppNav current="calendar" />
      </header>
      <MonthNav year={year} month={month} />
      <MonthGrid grid={grid} todayIso={format(now, "yyyy-MM-dd")} workouts={workouts} />
    </main>
  );
}
