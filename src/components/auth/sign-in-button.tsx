import { signIn } from "@/auth";
import { Button } from "@/components/ui/button";

export function SignInButton({ callbackUrl = "/app" }: { callbackUrl?: string }) {
  return (
    <form
      action={async () => {
        "use server";
        await signIn("google", { redirectTo: callbackUrl });
      }}
    >
      <Button type="submit">Sign in with Google</Button>
    </form>
  );
}
