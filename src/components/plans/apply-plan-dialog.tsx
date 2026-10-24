"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { CalendarCheck, CalendarPlus } from "lucide-react";
import { applyPlan, type ApplyPlanResult } from "@/app/app/plans/actions";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { isIsoDate, nextMondayOnOrAfter, planDateRange, snapToMonday } from "@/lib/plan-dates";
import { cn } from "@/lib/utils";

type Props = {
  planId: string;
  planName: string;
  weeks: number;
  workoutCount: number;
  /** Server's "today", "YYYY-MM-DD"; the default start is the next Monday. */
  todayIso: string;
};

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
const long = (iso: string) => format(parseISO(iso), "EEE d MMM yyyy");

/** Pick a start (snapped to its week's Monday), preview, confirm. */
export function ApplyPlanDialog({ planId, planName, weeks, workoutCount, todayIso }: Props) {
  const [open, setOpen] = useState(false);
  const [session, setSession] = useState(0);
  const empty = workoutCount === 0;

  return (
    <>
      <Button
        type="button"
        onClick={() => {
          setSession((n) => n + 1);
          setOpen(true);
        }}
        disabled={empty}
        title={empty ? "Add a workout to the plan first" : undefined}
      >
        <CalendarPlus data-icon="inline-start" />
        Apply to calendar
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] grid-rows-[auto_minmax(0,1fr)_auto] sm:max-w-md">
          {/* Remount per opening so a finished apply never lingers. */}
          <ApplyBody
            key={session}
            planId={planId}
            planName={planName}
            weeks={weeks}
            workoutCount={workoutCount}
            todayIso={todayIso}
            onClose={() => setOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

function ApplyBody({
  planId,
  planName,
  weeks,
  workoutCount,
  todayIso,
  onClose,
}: Props & { onClose: () => void }) {
  const [date, setDate] = useState(() => nextMondayOnOrAfter(todayIso));
  const [result, setResult] = useState<ApplyPlanResult | null>(null);
  const [pending, startApply] = useTransition();

  const valid = isIsoDate(date);
  const start = valid ? snapToMonday(date) : null;
  const range = start ? planDateRange(start, weeks) : null;
  const done = result?.ok ? result : null;

  const confirm = () => {
    if (!start) return;
    startApply(async () => setResult(await applyPlan(planId, start)));
  };

  if (done) {
    return (
      <>
        <DialogHeader>
          <DialogTitle>Plan applied</DialogTitle>
          <DialogDescription>
            {plural(done.count, "workout")} added to your calendar, {long(done.from)} to{" "}
            {long(done.to)}.
          </DialogDescription>
        </DialogHeader>
        <div />
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose}>
            Close
          </Button>
          <Link
            href={`/app?month=${done.month}`}
            className={cn(buttonVariants({ variant: "default" }))}
          >
            <CalendarCheck data-icon="inline-start" aria-hidden />
            Open {format(parseISO(done.from), "MMMM yyyy")}
          </Link>
        </DialogFooter>
      </>
    );
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Apply to calendar</DialogTitle>
        <DialogDescription>
          Adds every workout in “{planName}” to your calendar. Existing workouts stay as they are.
        </DialogDescription>
      </DialogHeader>

      <div className="-mx-4 flex min-h-0 flex-col gap-4 overflow-y-auto px-4 py-0.5">
        <Field>
          <FieldLabel htmlFor="apply-start">Start date</FieldLabel>
          <input
            id="apply-start"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
            aria-invalid={!valid}
            className="border-input focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:border-destructive dark:bg-input/30 h-8 w-full rounded-lg border bg-transparent px-2.5 text-sm outline-none focus-visible:ring-3"
          />
          <FieldDescription>
            Plans start on a Monday.
            {start && start !== date && ` Starts ${long(start)}, the Monday of that week.`}
          </FieldDescription>
        </Field>

        {range ? (
          <dl
            aria-label="Preview"
            className="bg-muted grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded-lg p-3 text-sm"
          >
            <dt className="text-muted-foreground">From</dt>
            <dd data-testid="apply-from">{long(range.from)}</dd>
            <dt className="text-muted-foreground">To</dt>
            <dd data-testid="apply-to">{long(range.to)}</dd>
            <dt className="text-muted-foreground">Adds</dt>
            <dd data-testid="apply-count">
              {plural(workoutCount, "workout")} over {plural(weeks, "week")}
            </dd>
          </dl>
        ) : (
          <p className="text-destructive text-sm">Pick a valid date.</p>
        )}

        {result && !result.ok && (
          <p role="alert" className="text-destructive text-sm">
            {result.message}
          </p>
        )}
      </div>

      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onClose} disabled={pending}>
          Cancel
        </Button>
        <Button type="button" onClick={confirm} disabled={pending || !start}>
          <CalendarPlus data-icon="inline-start" />
          {pending ? "Adding…" : `Add ${plural(workoutCount, "workout")}`}
        </Button>
      </DialogFooter>
    </>
  );
}
