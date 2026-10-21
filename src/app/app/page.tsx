import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { SignOutButton } from "@/components/auth/sign-out-button";

export default async function AppPage() {
  // The proxy already redirects anonymous visitors, but verify again here —
  // the proxy is an optimistic check, not the source of truth.
  const session = await auth();
  if (!session) redirect("/?callbackUrl=/app");

  return (
    <main className="mx-auto flex min-h-svh max-w-3xl flex-col gap-6 p-8">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Calendar</h1>
        <SignOutButton />
      </header>
      <p className="text-muted-foreground text-sm">
        Signed in as {session.user.email}. The calendar arrives in the next slice.
      </p>
    </main>
  );
}
