import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { auth } from "@/auth";
import { AppNav } from "@/components/app-nav";
import { CreatePlanForm } from "@/components/plans/create-plan-form";
import { plansRepo } from "@/lib/plans-repo";

export const metadata: Metadata = {
  title: "Plans · Training App",
};

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

export default async function PlansPage() {
  // The proxy already redirects anonymous visitors; this is the real check.
  const session = await auth();
  if (!session) redirect("/?callbackUrl=/app/plans");

  const plans = await plansRepo.list(session.user.id);

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-5xl flex-col gap-6 px-3 py-4 sm:p-8">
      <header className="flex items-center justify-between gap-2">
        <h1 className="font-heading text-2xl font-bold tracking-tight sm:text-3xl">Plans</h1>
        <AppNav current="plans" />
      </header>

      <p className="text-muted-foreground -mt-2 text-sm">
        Reusable multi-week programs. Build one once, then apply it to your calendar from any
        Monday.
      </p>

      <CreatePlanForm />

      {plans.length === 0 ? (
        <p className="text-muted-foreground rounded-xl border border-dashed p-6 text-center text-sm">
          No plans yet. Create your first one above.
        </p>
      ) : (
        <ul className="flex flex-col gap-2" aria-label="Your plans">
          {plans.map((p) => (
            <li key={p.id}>
              <Link
                href={`/app/plans/${p.id}`}
                className="bg-card hover:bg-muted focus-visible:ring-ring/50 flex items-center gap-3 rounded-xl border p-3 transition-colors outline-none focus-visible:ring-3 sm:p-4"
              >
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-medium">{p.name}</span>
                  <span className="text-muted-foreground text-sm">
                    {plural(p.weeks, "week")} · {plural(p.dayCount, "workout")}
                  </span>
                </span>
                <ChevronRight className="text-muted-foreground size-4 shrink-0" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
