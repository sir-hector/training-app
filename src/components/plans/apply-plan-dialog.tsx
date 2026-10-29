"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { CalendarCheck, CalendarPlus, CalendarX2, Loader2 } from "lucide-react";
import {
  applyPlan,
  previewApplyPlan,
  type ApplyPlanPreview,
  type ApplyPlanResult,
} from "@/app/app/plans/actions";
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

/** Per start Monday: undefined while loading, or the server's answer. */
type Previews = Record<string, ApplyPlanPreview>;

const PREVIEW_FAILED: ApplyPlanPreview = { ok: false, message: "Preview unavailable." };

function ApplyBody({
  planId,
  planName,
  weeks,
  workoutCount,
  todayIso,
  onClose,
}: Props & { onClose: () => void }) {
  const [date, setDate] = useState(() => nextMondayOnOrAfter(todayIso));
  const [previews, setPreviews] = useState<Previews>({});
  const [result, setResult] = useState<ApplyPlanResult | null>(null);
  const [pending, startApply] = useTransition();
  const requested = useRef(new Set<string>());

  const valid = isIsoDate(date);
  const start = valid ? snapToMonday(date) : null;
  const range = start ? planDateRange(start, weeks) : null;
  const done = result?.ok ? result : null;

  // Fetch each start's preview once. State is only set when the request
  // settles, so the loading state is simply "no answer for this start yet".
  const requestPreview = useCallback(
    (monday: string) => {
      if (requested.current.has(monday)) return;
      requested.current.add(monday);
      const settle = (preview: ApplyPlanPreview) =>
        setPreviews((prev) => ({ ...prev, [monday]: preview }));
      previewApplyPlan(planId, monday).then(settle, () => settle(PREVIEW_FAILED));
    },
    [planId],
  );

  // The initial start date; later ones are requested from the change handler.
  const initialStart = useRef(start);
  useEffect(() => {
    if (initialStart.current) requestPreview(initialStart.current);
  }, [requestPreview]);

  const changeDate = (value: string) => {
    setDate(value);
    if (isIsoDate(value)) requestPreview(snapToMonday(value));
  };

  const preview = start ? previews[start] : undefined;
  const loaded = preview?.ok ? preview : null;
  // If the preview fails, fall back to the plan's own count and let the
  // server skip duplicates anyway.
  const toAdd = loaded ? loaded.toAdd : workoutCount;
  const nothingToAdd = loaded !== null && loaded.toAdd === 0;

  const confirm = () => {
    if (!start) return;
    startApply(async () => setResult(await applyPlan(planId, start)));
  };

  if (done) {
    return (
      <>
        <DialogHeader>
          <DialogTitle>Plan applied</DialogTitle>
          <DialogDescription data-testid="apply-result">
            Added {plural(done.created, "workout")}
            {done.skipped > 0 && `, skipped ${done.skipped} already on your calendar`}.{" "}
            {long(done.from)} to {long(done.to)}.
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
          Adds the workouts in “{planName}” to your calendar. Any already there are skipped.
        </DialogDescription>
      </DialogHeader>

      <div className="-mx-4 flex min-h-0 flex-col gap-4 overflow-y-auto px-4 py-0.5">
        <Field>
          <FieldLabel htmlFor="apply-start">Start date</FieldLabel>
          <input
            id="apply-start"
            type="date"
            value={date}
            onChange={(e) => changeDate(e.target.value)}
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
          <div className="bg-muted flex flex-col gap-2 rounded-lg p-3 text-sm">
            <dl aria-label="Preview" className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
              <dt className="text-muted-foreground">From</dt>
              <dd data-testid="apply-from">{long(range.from)}</dd>
              <dt className="text-muted-foreground">To</dt>
              <dd data-testid="apply-to">{long(range.to)}</dd>
              <dt className="text-muted-foreground">Adds</dt>
              <dd data-testid="apply-count">
                {plural(toAdd, "workout")} over {plural(weeks, "week")}
              </dd>
            </dl>
            <div aria-live="polite" className="flex flex-col gap-1 empty:hidden">
              {!preview && (
                <p className="text-muted-foreground flex items-center gap-1.5">
                  <Loader2 className="size-3.5 animate-spin" aria-hidden />
                  Checking your calendar…
                </p>
              )}
              {preview && !preview.ok && (
                <p className="text-muted-foreground">
                  Couldn’t check your calendar. Workouts already there are still skipped.
                </p>
              )}
              {loaded && loaded.skipped > 0 && (
                <p data-testid="apply-skipped" className="flex items-start gap-1.5">
                  <CalendarX2 className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                  {loaded.skipped} already on your calendar will be skipped.
                </p>
              )}
              {loaded && loaded.untouched > 0 && (
                <p data-testid="apply-untouched" className="text-muted-foreground">
                  {plural(loaded.untouched, "other workout")} in these weeks{" "}
                  {loaded.untouched === 1 ? "stays" : "stay"} as{" "}
                  {loaded.untouched === 1 ? "it is" : "they are"}.
                </p>
              )}
            </div>
          </div>
        ) : (
          <p className="text-destructive text-sm">Pick a valid date.</p>
        )}

        {nothingToAdd && (
          <p data-testid="apply-nothing" className="text-sm font-medium">
            Every workout in this plan is already on your calendar for these weeks. Pick a different
            start date.
          </p>
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
        <Button type="button" onClick={confirm} disabled={pending || !start || nothingToAdd}>
          <CalendarPlus data-icon="inline-start" />
          {pending
            ? "Adding…"
            : nothingToAdd
              ? "Nothing to add"
              : `Add ${plural(toAdd, "workout")}`}
        </Button>
      </DialogFooter>
    </>
  );
}
