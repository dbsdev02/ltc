import { useState, type FormEvent } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { toast } from "sonner";
import {
  ImageIcon,
  LayoutDashboard,
  Loader2,
  LogOut,
  Package,
  Settings,
  ShoppingBag,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/site/FormField";
import { AdminDashboard } from "@/components/admin/AdminDashboard";
import { AdminOrders } from "@/components/admin/AdminOrders";
import { AdminProducts } from "@/components/admin/AdminProducts";
import { AdminImages } from "@/components/admin/AdminImages";
import { AdminSettings } from "@/components/admin/AdminSettings";
import { site } from "@/data/site";
import { ApiError, errorMessage } from "@/lib/api";
import { adminApi, type AdminUser } from "@/lib/admin";

const tabs = ["dashboard", "orders", "products", "images", "settings"] as const;
type Tab = (typeof tabs)[number];

export const Route = createFileRoute("/admin")({
  validateSearch: (search) =>
    z
      .object({
        tab: z.enum(tabs).optional(),
        order: z.coerce.number().int().positive().optional(),
      })
      .parse(search),
  head: () => ({
    meta: [{ title: `Admin | ${site.name}` }, { name: "robots", content: "noindex, nofollow" }],
  }),
  component: AdminPage,
});

function AdminPage() {
  const me = useQuery({
    queryKey: ["admin", "me"],
    queryFn: async () => {
      try {
        return await adminApi.me();
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) return null;
        throw error;
      }
    },
    retry: false,
  });

  return (
    <section className="min-h-[80vh] bg-cream/50 py-8 lg:py-10">
      <div className="mx-auto max-w-6xl px-4 lg:px-8">
        {me.isLoading ? (
          <div className="flex justify-center py-24">
            <Loader2 className="size-8 animate-spin text-muted-foreground" />
          </div>
        ) : me.isError ? (
          <p className="py-24 text-center text-sm font-bold text-destructive">
            {errorMessage(me.error, "The admin service is unavailable.")}
          </p>
        ) : me.data ? (
          <AdminShell admin={me.data} />
        ) : (
          <AdminLogin />
        )}
      </div>
    </section>
  );
}

function AdminLogin() {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError(null);
    try {
      const admin = await adminApi.login(
        String(form.get("email") ?? ""),
        String(form.get("password") ?? ""),
      );
      queryClient.setQueryData(["admin", "me"], admin);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      onSubmit={onSubmit}
      className="mx-auto mt-10 max-w-sm space-y-4 rounded-[2rem] border border-border bg-background p-8"
    >
      <div>
        <p className="eyebrow">{site.name}</p>
        <h1 className="font-display text-2xl font-extrabold">Store admin</h1>
      </div>
      <Field label="Email">
        <input className="form-field" name="email" type="email" autoComplete="username" required />
      </Field>
      <Field label="Password">
        <input
          className="form-field"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </Field>
      {error && <p className="text-sm font-bold text-destructive">{error}</p>}
      <Button type="submit" size="lg" className="w-full" disabled={busy}>
        {busy && <Loader2 className="size-4 animate-spin" />} LOG IN
      </Button>
    </form>
  );
}

const TAB_META: Record<Tab, { label: string; icon: typeof Package; ownerOnly: boolean }> = {
  dashboard: { label: "Dashboard", icon: LayoutDashboard, ownerOnly: false },
  orders: { label: "Orders", icon: ShoppingBag, ownerOnly: false },
  products: { label: "Product & stock", icon: Package, ownerOnly: true },
  images: { label: "Images", icon: ImageIcon, ownerOnly: true },
  settings: { label: "Settings", icon: Settings, ownerOnly: true },
};

function AdminShell({ admin }: { admin: AdminUser }) {
  const { tab = "dashboard", order } = Route.useSearch();
  const navigate = useNavigate({ from: "/admin" });
  const queryClient = useQueryClient();
  const visible = tabs.filter((t) => admin.role === "owner" || !TAB_META[t].ownerOnly);
  const active: Tab = visible.includes(tab) ? tab : "dashboard";

  const logout = async () => {
    await adminApi.logout().catch(() => undefined);
    queryClient.setQueryData(["admin", "me"], null);
    queryClient.removeQueries({ queryKey: ["admin"], exact: false });
    toast.success("Logged out.");
  };

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Store admin</p>
          <h1 className="font-display text-3xl font-extrabold">{TAB_META[active].label}</h1>
          <p className="text-xs text-muted-foreground">
            {admin.email} · {admin.role}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="secondary" size="sm" className="border-foreground/20">
            <Link to="/">View shop</Link>
          </Button>
          <Button variant="secondary" size="sm" className="border-foreground/20" onClick={logout}>
            <LogOut className="size-4" /> Log out
          </Button>
        </div>
      </div>

      <nav aria-label="Admin sections" className="mt-6 flex flex-wrap gap-2 text-sm font-extrabold">
        {visible.map((key) => {
          const { label, icon: Icon } = TAB_META[key];
          return (
            <button
              key={key}
              type="button"
              aria-current={active === key ? "page" : undefined}
              onClick={() => navigate({ search: { tab: key } })}
              className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 transition-colors ${active === key ? "border-foreground bg-foreground text-background" : "border-border bg-background text-muted-foreground hover:text-foreground"}`}
            >
              <Icon className="size-4" /> {label}
            </button>
          );
        })}
      </nav>

      <div className="mt-6">
        {active === "dashboard" && <AdminDashboard />}
        {active === "orders" && (
          <AdminOrders
            selectedId={order ?? null}
            onSelect={(id) => navigate({ search: { tab: "orders", ...(id ? { order: id } : {}) } })}
          />
        )}
        {active === "products" && <AdminProducts />}
        {active === "images" && <AdminImages />}
        {active === "settings" && <AdminSettings />}
      </div>
    </>
  );
}
