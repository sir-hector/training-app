import Link from "next/link";
import { auth } from "@/auth";
import { SignInButton } from "@/components/auth/sign-in-button";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { Button } from "@/components/ui/button";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const [session, { callbackUrl }] = await Promise.all([auth(), searchParams]);

  return (
    <main className="flex min-h-svh items-center justify-center p-8">
      <div className="flex flex-col items-center gap-6 text-center">
        <div>
          <h1 className="text-4xl font-semibold tracking-tight">Training App</h1>
          <p className="text-muted-foreground mt-3 text-sm">
            {session
              ? `Hi ${session.user.name ?? session.user.email}`
              : "Plan and track your training."}
          </p>
        </div>

        {session ? (
          <div className="flex items-center gap-3">
            <Button render={<Link href="/app" />}>Open calendar</Button>
            <SignOutButton />
          </div>
        ) : (
          <SignInButton callbackUrl={callbackUrl ?? "/app"} />
        )}
      </div>
    </main>
  );
}
