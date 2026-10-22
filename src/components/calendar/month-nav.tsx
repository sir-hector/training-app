import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { nextMonth, previousMonth } from "@/lib/calendar-grid";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export function monthHref({ year, month }: { year: number; month: number }) {
  return `/app?month=${year}-${String(month).padStart(2, "0")}`;
}

export function MonthNav({ year, month }: { year: number; month: number }) {
  return (
    <nav className="flex items-center justify-between gap-2" aria-label="Month navigation">
      <Button
        variant="outline"
        size="icon"
        aria-label="Previous month"
        nativeButton={false}
        render={<Link href={monthHref(previousMonth(year, month))} />}
      >
        <ChevronLeft />
      </Button>
      <h2 className="text-lg font-semibold tracking-tight tabular-nums">
        {MONTHS[month - 1]} {year}
      </h2>
      <Button
        variant="outline"
        size="icon"
        aria-label="Next month"
        nativeButton={false}
        render={<Link href={monthHref(nextMonth(year, month))} />}
      >
        <ChevronRight />
      </Button>
    </nav>
  );
}
