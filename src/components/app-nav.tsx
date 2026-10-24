import Link from "next/link";
import { CalendarDays, ChartColumn, ListChecks, type LucideIcon } from "lucide-react";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Section = "calendar" | "plans" | "stats";

const LINKS: { section: Section; href: string; label: string; icon: LucideIcon }[] = [
  { section: "calendar", href: "/app", label: "Calendar", icon: CalendarDays },
  { section: "plans", href: "/app/plans", label: "Plans", icon: ListChecks },
  { section: "stats", href: "/app/stats", label: "Stats", icon: ChartColumn },
];

/**
 * Header navigation: links to the other app sections, then sign out. On
 * phones the links are icon-only (the label stays as the accessible name)
 * so the header fits on one line at 375px.
 */
export function AppNav({ current }: { current: Section }) {
  return (
    <nav className="flex items-center gap-1.5 sm:gap-2" aria-label="Main">
      {LINKS.filter((l) => l.section !== current).map(({ href, label, icon: Icon }) => (
        // A real link (not role="button"): this is navigation. cn() resolves the
        // conflicting border classes buttonVariants emits, as Button does.
        <Link
          key={href}
          href={href}
          title={label}
          className={cn(buttonVariants({ variant: "outline" }), "max-sm:px-2")}
        >
          <Icon data-icon="inline-start" aria-hidden />
          <span className="max-sm:sr-only">{label}</span>
        </Link>
      ))}
      <SignOutButton />
    </nav>
  );
}
