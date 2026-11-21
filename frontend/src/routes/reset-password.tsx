import { useState, type FormEvent } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/site/FormField";
import { site } from "@/data/site";
import { useAccount } from "@/lib/account";

export const Route = createFileRoute("/reset-password")({
  validateSearch: (search) => z.object({ token: z.string().optional() }).parse(search),
  head: () => ({
    meta: [{ title: `Reset password | ${site.name}` }, { name: "robots", content: "noindex" }],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const { token } = Route.useSearch();
  const { resetPassword } = useAccount();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    if (password !== String(form.get("confirm") ?? "")) {
      setError("The two passwords don't match.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await resetPassword(token ?? "", password);
      toast.success("Password changed — you're logged in.");
      navigate({ to: "/account" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="min-h-[70vh] bg-cream/50 py-10 lg:py-14">
      <div className="mx-auto max-w-md px-5">
        <h1 className="text-center font-display text-3xl font-extrabold">Choose a new password</h1>
        {token ? (
          <form
            onSubmit={onSubmit}
            className="mt-8 space-y-4 rounded-[2rem] border border-border bg-background p-6 sm:p-8"
          >
            <Field label="New password">
              <input
                className="form-field"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                placeholder="At least 8 characters"
              />
            </Field>
            <Field label="Confirm new password">
              <input
                className="form-field"
                name="confirm"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
              />
            </Field>
            {error && <p className="text-sm font-bold text-destructive">{error}</p>}
            <Button type="submit" size="lg" className="w-full" disabled={busy}>
              {busy && <Loader2 className="size-4 animate-spin" />} SAVE NEW PASSWORD
            </Button>
          </form>
        ) : (
          <p className="mt-6 text-center text-sm text-muted-foreground">
            This link is incomplete.{" "}
            <Link to="/account" className="font-bold text-accent">
              Request a new one
            </Link>
            .
          </p>
        )}
      </div>
    </section>
  );
}
