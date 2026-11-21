import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Loader2, LogOut, Package, Truck, UserRound } from "lucide-react";
import stickerCloud from "@/assets/brand/st-cloud.png";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/site/FormField";
import { INDIAN_STATES } from "@/data/indian-states";
import { site } from "@/data/site";
import { useAccount, type AccountOrder, type User } from "@/lib/account";
import { formatINR } from "@/lib/pricing";

export const Route = createFileRoute("/account")({
  head: () => ({
    meta: [{ title: `My account | ${site.name}` }, { name: "robots", content: "noindex" }],
  }),
  component: AccountPage,
});

function AccountPage() {
  const { user, loading } = useAccount();
  return (
    <section className="min-h-[70vh] bg-cream/50 py-10 lg:py-14">
      <div className="mx-auto max-w-5xl px-5 lg:px-10">
        {loading ? (
          <div className="flex justify-center py-24">
            <Loader2 className="size-8 animate-spin text-muted-foreground" />
          </div>
        ) : user ? (
          <Dashboard user={user} />
        ) : (
          <AuthCard />
        )}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Logged out: log in / sign up / forgot password
// ---------------------------------------------------------------------------

type Mode = "login" | "signup" | "forgot";

function AuthCard() {
  const { login, signup, requestPasswordReset } = useAccount();
  const [mode, setMode] = useState<Mode>("login");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetSent, setResetSent] = useState(false);

  const switchMode = (next: Mode) => {
    setMode(next);
    setError(null);
    setResetSent(false);
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const get = (key: string) => String(form.get(key) ?? "").trim();
    setBusy(true);
    setError(null);
    try {
      if (mode === "login") {
        const user = await login(get("email"), String(form.get("password") ?? ""));
        toast.success(`Welcome back, ${user.name.split(" ")[0]}!`);
      } else if (mode === "signup") {
        const user = await signup({
          name: get("name"),
          email: get("email"),
          phone: get("phone"),
          password: String(form.get("password") ?? ""),
        });
        toast.success(`Welcome to the club, ${user.name.split(" ")[0]}!`);
      } else {
        await requestPasswordReset(get("email"));
        setResetSent(true);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  const titles: Record<Mode, string> = {
    login: "Welcome back",
    signup: "Join the club",
    forgot: "Reset your password",
  };

  return (
    <div className="mx-auto max-w-md">
      <div className="text-center">
        <img src={stickerCloud} alt="" className="float-slow mx-auto w-24" />
        <h1 className="mt-4 font-display text-3xl font-extrabold">{titles[mode]}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {mode === "forgot"
            ? "Enter your email and we'll send you a link to choose a new password."
            : "Track your orders and check out faster next time."}
        </p>
      </div>

      {mode !== "forgot" && (
        <div className="mt-8 grid grid-cols-2 rounded-full border border-border bg-background p-1 text-sm font-extrabold">
          {(["login", "signup"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => switchMode(m)}
              className={`rounded-full py-2.5 transition-colors ${mode === m ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"}`}
            >
              {m === "login" ? "Log in" : "Sign up"}
            </button>
          ))}
        </div>
      )}

      <form
        key={mode}
        onSubmit={onSubmit}
        className="mt-6 space-y-4 rounded-[2rem] border border-border bg-background p-6 sm:p-8"
      >
        {resetSent ? (
          <p className="text-sm">
            If an account exists for that email, a reset link is on its way. Please check your inbox
            (and spam folder).
          </p>
        ) : (
          <>
            {mode === "signup" && (
              <Field label="Full name">
                <input
                  className="form-field"
                  name="name"
                  autoComplete="name"
                  required
                  minLength={2}
                />
              </Field>
            )}
            <Field label="Email">
              <input
                className="form-field"
                name="email"
                type="email"
                autoComplete="email"
                required
              />
            </Field>
            {mode === "signup" && (
              <Field label="Mobile number (optional)">
                <input
                  className="form-field"
                  name="phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="98765 43210"
                />
              </Field>
            )}
            {mode !== "forgot" && (
              <Field label="Password">
                <input
                  className="form-field"
                  name="password"
                  type="password"
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                  required
                  minLength={mode === "signup" ? 8 : 1}
                  placeholder={mode === "signup" ? "At least 8 characters" : ""}
                />
              </Field>
            )}
            {error && <p className="text-sm font-bold text-destructive">{error}</p>}
            <Button type="submit" size="lg" className="w-full" disabled={busy}>
              {busy && <Loader2 className="size-4 animate-spin" />}
              {mode === "login"
                ? "LOG IN"
                : mode === "signup"
                  ? "CREATE ACCOUNT"
                  : "SEND RESET LINK"}
            </Button>
          </>
        )}
        <p className="text-center text-sm">
          {mode === "login" ? (
            <button
              type="button"
              className="font-bold text-accent hover:underline"
              onClick={() => switchMode("forgot")}
            >
              Forgot your password?
            </button>
          ) : mode === "forgot" ? (
            <button
              type="button"
              className="font-bold text-accent hover:underline"
              onClick={() => switchMode("login")}
            >
              Back to log in
            </button>
          ) : (
            <span className="text-xs text-muted-foreground">
              By signing up you agree to our{" "}
              <Link to="/terms-and-conditions" className="underline">
                Terms
              </Link>{" "}
              and{" "}
              <Link to="/privacy-policy" className="underline">
                Privacy Policy
              </Link>
              .
            </span>
          )}
        </p>
      </form>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Logged in: orders + profile
// ---------------------------------------------------------------------------

const statusLabel: Record<AccountOrder["status"], { text: string; className: string }> = {
  paid: {
    text: "Preparing to ship",
    className: "bg-[color-mix(in_oklab,var(--gold)_30%,var(--background))]",
  },
  shipped: {
    text: "Shipped",
    className: "bg-[color-mix(in_oklab,var(--sage)_40%,var(--background))]",
  },
  delivered: {
    text: "Delivered",
    className: "bg-[color-mix(in_oklab,var(--sage)_60%,var(--background))]",
  },
  cancelled: { text: "Cancelled", className: "bg-muted text-muted-foreground" },
};

function Dashboard({ user }: { user: User }) {
  const { logout } = useAccount();
  const [tab, setTab] = useState<"orders" | "profile">("orders");

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">My account</p>
          <h1 className="font-display text-3xl font-extrabold sm:text-4xl">
            Hi, {user.name.split(" ")[0]}!
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{user.email}</p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          className="border-foreground/20"
          onClick={async () => {
            await logout().catch(() => undefined);
            toast.success("You're logged out.");
          }}
        >
          <LogOut className="size-4" /> Log out
        </Button>
      </div>

      <div className="mt-8 flex gap-2 text-sm font-extrabold">
        {(
          [
            ["orders", "My orders", Package],
            ["profile", "Profile & address", UserRound],
          ] as const
        ).map(([key, label, Icon]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 transition-colors ${tab === key ? "border-foreground bg-foreground text-background" : "border-border bg-background text-muted-foreground hover:text-foreground"}`}
          >
            <Icon className="size-4" /> {label}
          </button>
        ))}
      </div>

      <div className="mt-6">{tab === "orders" ? <Orders /> : <Profile user={user} />}</div>
    </>
  );
}

function Orders() {
  const { fetchOrders } = useAccount();
  const [orders, setOrders] = useState<AccountOrder[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchOrders()
      .then(setOrders)
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : "Couldn't load your orders."),
      );
  }, [fetchOrders]);

  if (error) return <p className="text-sm font-bold text-destructive">{error}</p>;
  if (!orders)
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  if (orders.length === 0)
    return (
      <div className="rounded-[2rem] border border-border bg-background p-8 text-center">
        <Package className="mx-auto size-8 text-muted-foreground" />
        <p className="mt-3 font-display text-lg font-extrabold">No orders yet</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Your Cloud Mist orders will show up here.
        </p>
        <Button asChild size="lg" className="mt-6">
          <Link to="/" hash="shop">
            SHOP CLOUD MIST
          </Link>
        </Button>
      </div>
    );

  return (
    <ul className="space-y-4">
      {orders.map((order) => (
        <li key={order.number} className="rounded-[2rem] border border-border bg-background p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-display text-lg font-extrabold">{order.number}</p>
              <p className="text-xs text-muted-foreground">
                {new Date(order.date.replace(" ", "T") + "+05:30").toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </p>
            </div>
            <span
              className={`rounded-full px-3 py-1 text-xs font-extrabold ${statusLabel[order.status].className}`}
            >
              {statusLabel[order.status].text}
            </span>
          </div>
          <div className="mt-4 flex flex-wrap items-baseline justify-between gap-2 text-sm">
            <p>{order.items}</p>
            <p className="font-display text-lg font-extrabold">{formatINR(order.total)}</p>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Delivering to {order.address}</p>
          {order.tracking && (
            <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-cream px-3 py-1.5 text-xs font-bold">
              <Truck className="size-4 text-accent" /> {order.tracking}
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}

function Profile({ user }: { user: User }) {
  const { updateProfile } = useAccount();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formEl = event.currentTarget;
    const form = new FormData(formEl);
    const get = (key: string) => String(form.get(key) ?? "").trim();
    setBusy(true);
    setError(null);
    try {
      await updateProfile({
        name: get("name"),
        phone: get("phone"),
        address: get("address"),
        city: get("city"),
        state: get("state"),
        pincode: get("pincode"),
        currentPassword: String(form.get("currentPassword") ?? ""),
        newPassword: String(form.get("newPassword") ?? ""),
      });
      (formEl.elements.namedItem("currentPassword") as HTMLInputElement).value = "";
      (formEl.elements.namedItem("newPassword") as HTMLInputElement).value = "";
      toast.success("Saved!");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save your details.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      onSubmit={onSubmit}
      className="rounded-[2rem] border border-border bg-background p-6 sm:p-8"
    >
      <h2 className="font-display text-xl font-extrabold">Your details</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Field label="Full name">
          <input
            className="form-field"
            name="name"
            defaultValue={user.name}
            autoComplete="name"
            required
          />
        </Field>
        <Field label="Mobile number">
          <input
            className="form-field"
            name="phone"
            type="tel"
            inputMode="tel"
            defaultValue={user.phone}
            autoComplete="tel"
            placeholder="98765 43210"
          />
        </Field>
      </div>

      <h2 className="mt-8 font-display text-xl font-extrabold">Saved delivery address</h2>
      <p className="mt-1 text-sm text-muted-foreground">We'll fill this in for you at checkout.</p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Field label="Address" className="sm:col-span-2">
          <textarea
            className="form-field min-h-24 resize-y"
            name="address"
            defaultValue={user.address}
            autoComplete="street-address"
            placeholder="House / flat no., building, street, area"
          />
        </Field>
        <Field label="City">
          <input
            className="form-field"
            name="city"
            defaultValue={user.city}
            autoComplete="address-level2"
          />
        </Field>
        <Field label="PIN code">
          <input
            className="form-field"
            name="pincode"
            inputMode="numeric"
            maxLength={6}
            defaultValue={user.pincode}
            autoComplete="postal-code"
          />
        </Field>
        <Field label="State" className="sm:col-span-2">
          <select
            className="form-field"
            name="state"
            defaultValue={user.state}
            autoComplete="address-level1"
          >
            <option value="">Select your state</option>
            {INDIAN_STATES.map((state) => (
              <option key={state}>{state}</option>
            ))}
          </select>
        </Field>
      </div>

      <h2 className="mt-8 font-display text-xl font-extrabold">Change password</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Leave blank to keep your current password.
      </p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Field label="Current password">
          <input
            className="form-field"
            name="currentPassword"
            type="password"
            autoComplete="current-password"
          />
        </Field>
        <Field label="New password">
          <input
            className="form-field"
            name="newPassword"
            type="password"
            autoComplete="new-password"
            minLength={8}
            placeholder="At least 8 characters"
          />
        </Field>
      </div>

      {error && <p className="mt-4 text-sm font-bold text-destructive">{error}</p>}
      <Button type="submit" size="lg" className="mt-8" disabled={busy}>
        {busy && <Loader2 className="size-4 animate-spin" />} SAVE CHANGES
      </Button>
    </form>
  );
}
