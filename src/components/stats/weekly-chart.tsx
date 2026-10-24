import type { WeekBucket } from "@/lib/workout-stats";

const PLOT_HEIGHT = 160;
const AXIS_HEIGHT = 34;
const BAR_WIDTH = 16;
const RADIUS = 4;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function monthOf(iso: string): number {
  return Number(iso.slice(5, 7)) - 1;
}

function dayOf(iso: string): number {
  return Number(iso.slice(8, 10));
}

/** "Oct 19" — short, timezone-free label for a week's Monday. */
export function weekLabel(iso: string): string {
  return `${MONTHS[monthOf(iso)]} ${dayOf(iso)}`;
}

/** Integer ticks from 0 up to a clean maximum, at most ~5 of them. */
function ticksFor(max: number): number[] {
  const step = max <= 5 ? 1 : max <= 10 ? 2 : Math.ceil(max / 20) * 5;
  const top = Math.max(step * Math.ceil(max / step), 2);
  const ticks: number[] = [];
  for (let v = 0; v <= top; v += step) ticks.push(v);
  return ticks;
}

/** A column with a 4px rounded top and a square base, in a BAR_WIDTH-wide slot. */
function columnPath(height: number): string {
  const top = PLOT_HEIGHT - height;
  const r = Math.min(RADIUS, height, BAR_WIDTH / 2);
  return [
    `M0,${PLOT_HEIGHT}`,
    `V${top + r}`,
    `Q0,${top} ${r},${top}`,
    `H${BAR_WIDTH - r}`,
    `Q${BAR_WIDTH},${top} ${BAR_WIDTH},${top + r}`,
    `V${PLOT_HEIGHT}`,
    "Z",
  ].join(" ");
}

type Props = {
  weeks: WeekBucket[];
  /** Monday of the current week, highlighted on the axis. */
  currentWeekStart: string;
};

/**
 * Planned vs done per week, as server-rendered inline SVG. Each column's
 * height is what was planned; the brand-colored part is what got done (done
 * is always a subset of planned, so it never overflows). A table with the
 * same numbers sits underneath for screen readers and anyone who prefers it.
 *
 * Horizontal positions are percentages so the chart fills any width without
 * scaling its text; each column is a nested SVG that centers a fixed-width bar.
 */
export function WeeklyChart({ weeks, currentWeekStart }: Props) {
  const ticks = ticksFor(Math.max(0, ...weeks.map((w) => w.planned)));
  const yMax = ticks[ticks.length - 1];
  const y = (v: number) => PLOT_HEIGHT - (v / yMax) * PLOT_HEIGHT;
  const slot = 100 / weeks.length;
  const planned = weeks.reduce((n, w) => n + w.planned, 0);
  const done = weeks.reduce((n, w) => n + w.done, 0);

  return (
    <figure className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <figcaption className="font-heading text-base font-semibold tracking-tight sm:text-lg">
          Planned vs done per week
        </figcaption>
        <ul className="text-muted-foreground flex gap-3 text-xs sm:text-sm" aria-label="Legend">
          <li className="flex items-center gap-1.5">
            <span className="bg-muted-foreground/25 size-2.5 rounded-sm" aria-hidden />
            Planned
          </li>
          <li className="flex items-center gap-1.5">
            <span className="bg-brand size-2.5 rounded-sm" aria-hidden />
            Done
          </li>
        </ul>
      </div>

      <div className="flex gap-1.5">
        {/* Y axis: HTML so the labels never scale with the SVG. */}
        <div
          className="text-muted-foreground relative w-5 shrink-0 text-right text-[0.7rem] tabular-nums"
          style={{ height: PLOT_HEIGHT }}
          aria-hidden
        >
          {ticks.map((t) => (
            <span key={t} className="absolute right-0 -translate-y-1/2" style={{ top: y(t) }}>
              {t}
            </span>
          ))}
        </div>

        <svg
          width="100%"
          height={PLOT_HEIGHT + AXIS_HEIGHT}
          className="min-w-0 flex-1 overflow-visible"
          role="img"
          aria-label={`Planned vs done per week for the last ${weeks.length} weeks: ${done} of ${planned} workouts done. The table below lists each week.`}
        >
          {ticks.map((t) => (
            <line
              key={t}
              x1="0"
              x2="100%"
              y1={y(t) - 0.5}
              y2={y(t) - 0.5}
              className={t === 0 ? "stroke-muted-foreground/40" : "stroke-border"}
              strokeWidth={1}
              shapeRendering="crispEdges"
            />
          ))}

          {weeks.map((w, i) => {
            const isCurrent = w.start === currentWeekStart;
            const newMonth = i === 0 || monthOf(w.start) !== monthOf(weeks[i - 1].start);
            const center = `${(i + 0.5) * slot}%`;
            return (
              <g key={w.start}>
                <svg
                  x={`${i * slot}%`}
                  y={0}
                  width={`${slot}%`}
                  height={PLOT_HEIGHT}
                  viewBox={`0 0 ${BAR_WIDTH} ${PLOT_HEIGHT}`}
                  preserveAspectRatio="xMidYMax meet"
                  overflow="visible"
                >
                  {w.planned > 0 && (
                    <path
                      d={columnPath(PLOT_HEIGHT - y(w.planned))}
                      className="fill-muted-foreground/25"
                    />
                  )}
                  {w.done > 0 && (
                    <path d={columnPath(PLOT_HEIGHT - y(w.done))} className="fill-brand" />
                  )}
                </svg>
                <text
                  x={center}
                  y={PLOT_HEIGHT + 14}
                  textAnchor="middle"
                  className={
                    isCurrent
                      ? "fill-foreground text-[0.7rem] font-semibold tabular-nums"
                      : "fill-muted-foreground text-[0.7rem] tabular-nums"
                  }
                >
                  {dayOf(w.start)}
                </text>
                {newMonth && (
                  <text
                    x={center}
                    y={PLOT_HEIGHT + 28}
                    textAnchor="middle"
                    className="fill-muted-foreground text-[0.65rem] font-medium"
                  >
                    {MONTHS[monthOf(w.start)]}
                  </text>
                )}
                {/* Hover target: the whole slot, with a native tooltip. */}
                <rect
                  x={`${i * slot}%`}
                  y={0}
                  width={`${slot}%`}
                  height={PLOT_HEIGHT}
                  fill="transparent"
                >
                  <title>{`Week of ${weekLabel(w.start)}: ${w.done} of ${w.planned} done`}</title>
                </rect>
              </g>
            );
          })}
        </svg>
      </div>

      <details className="text-sm">
        <summary className="text-muted-foreground hover:text-foreground w-fit cursor-pointer select-none">
          Show as table
        </summary>
        <table className="mt-2 w-full text-left tabular-nums" aria-label="Workouts per week">
          <thead className="text-muted-foreground">
            <tr className="border-b">
              <th scope="col" className="py-1.5 font-medium">
                Week of
              </th>
              <th scope="col" className="py-1.5 text-right font-medium">
                Planned
              </th>
              <th scope="col" className="py-1.5 text-right font-medium">
                Done
              </th>
            </tr>
          </thead>
          <tbody>
            {weeks.map((w) => (
              <tr key={w.start} className="border-b last:border-0">
                <th scope="row" className="py-1.5 font-normal">
                  {weekLabel(w.start)}
                  {w.start === currentWeekStart && (
                    <span className="text-muted-foreground"> (this week)</span>
                  )}
                </th>
                <td className="py-1.5 text-right">{w.planned}</td>
                <td className="py-1.5 text-right">{w.done}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
