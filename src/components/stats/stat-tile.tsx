import { useId } from "react";

type Props = {
  label: string;
  value: string;
  /** Optional unit after the value, set smaller so narrow tiles don't wrap. */
  unit?: string;
  detail: string;
};

/** One headline number. The label names the tile's region for assistive tech. */
export function StatTile({ label, value, unit, detail }: Props) {
  const id = useId();
  return (
    <section
      aria-labelledby={id}
      className="bg-card flex min-w-0 flex-col gap-1 rounded-xl border p-3 sm:p-4"
    >
      <h2 id={id} className="text-muted-foreground text-xs font-medium sm:text-sm">
        {label}
      </h2>
      <p className="font-heading text-2xl font-semibold tracking-tight sm:text-4xl">
        {value}
        {unit && (
          <>
            {" "}
            <span className="text-base font-medium sm:text-2xl">{unit}</span>
          </>
        )}
      </p>
      <p className="text-muted-foreground text-xs leading-snug sm:text-sm">{detail}</p>
    </section>
  );
}
