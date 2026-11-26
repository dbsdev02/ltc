import { useEffect, useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, ArrowLeft, Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { errorMessage } from "@/lib/api";
import {
  adminApi,
  ORDER_STATUS_LABEL,
  PAYMENT_STATUS_LABEL,
  type AdminOrderDetail,
  type OrderFilter,
} from "@/lib/admin";
import type { Order } from "@/lib/payments";
import { formatINR } from "@/lib/pricing";

const FILTERS: [OrderFilter, string][] = [
  ["all", "All"],
  ["to_ship", "To ship"],
  ["shipped", "Shipped"],
  ["delivered", "Delivered"],
  ["cod", "COD"],
  ["pending", "Awaiting payment"],
  ["failed", "Payment failed"],
  ["cancelled", "Cancelled"],
  ["attention", "Needs attention"],
];

const dateTime = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString("en-IN", {
        day: "numeric",
        month: "short",
        hour: "numeric",
        minute: "2-digit",
      })
    : "—";

function Pill({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "strong" | "muted";
}) {
  const cls =
    tone === "strong"
      ? "bg-foreground text-background"
      : tone === "muted"
        ? "bg-muted text-muted-foreground"
        : "bg-cream text-foreground";
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-extrabold ${cls}`}>
      {children}
    </span>
  );
}

export function AdminOrders({
  selectedId,
  onSelect,
}: {
  selectedId: number | null;
  onSelect: (id: number | null) => void;
}) {
  if (selectedId) return <OrderDetail id={selectedId} onBack={() => onSelect(null)} />;
  return <OrderList onSelect={onSelect} />;
}

function OrderList({ onSelect }: { onSelect: (id: number) => void }) {
  const [filter, setFilter] = useState<OrderFilter>("all");
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setQ(search.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: ["admin", "orders", filter, q, page],
    queryFn: () => adminApi.orders(filter, q, page),
    placeholderData: keepPreviousData,
  });
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative min-w-56 flex-1">
          <span className="sr-only">Search orders</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            className="form-field pl-9"
            placeholder="Search order no., name, email or phone"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        {isFetching && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
      </div>
      <div className="flex flex-wrap gap-2 text-xs font-extrabold">
        {FILTERS.map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => {
              setFilter(key);
              setPage(1);
            }}
            className={`rounded-full border px-3 py-1.5 ${filter === key ? "border-foreground bg-foreground text-background" : "border-border bg-background text-muted-foreground hover:text-foreground"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {error ? (
        <p className="text-sm font-bold text-destructive">{errorMessage(error)}</p>
      ) : isLoading || !data ? (
        <Loader2 className="mx-auto size-6 animate-spin text-muted-foreground" />
      ) : data.orders.length === 0 ? (
        <p className="rounded-3xl border border-border bg-background p-8 text-center text-sm text-muted-foreground">
          No orders here yet.
        </p>
      ) : (
        <ul className="space-y-2">
          {data.orders.map((o) => (
            <li key={o.id}>
              <button
                type="button"
                onClick={() => onSelect(o.id)}
                className="flex w-full flex-wrap items-center justify-between gap-3 rounded-3xl border border-border bg-background p-4 text-left transition-colors hover:border-foreground/40"
              >
                <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-display font-extrabold">{o.number}</span>
                    <Pill
                      tone={
                        o.status === "confirmed"
                          ? "strong"
                          : o.status === "cancelled"
                            ? "muted"
                            : "neutral"
                      }
                    >
                      {ORDER_STATUS_LABEL[o.status]}
                    </Pill>
                    <Pill>{PAYMENT_STATUS_LABEL[o.paymentStatus]}</Pill>
                    {o.needsAttention && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-extrabold text-accent">
                        <AlertTriangle className="size-3.5" aria-hidden="true" /> Needs attention
                      </span>
                    )}
                  </span>
                  <span className="mt-1 block truncate text-xs text-muted-foreground">
                    {dateTime(o.createdAt)} · {o.name} · {o.phone} · {o.itemCount}{" "}
                    {o.itemCount === 1 ? "bottle" : "bottles"}
                  </span>
                </span>
                <span className="font-display text-lg font-extrabold tabular-nums">
                  {formatINR(o.total)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {data && pages > 1 && (
        <div className="flex items-center justify-center gap-3 text-sm">
          <Button
            variant="secondary"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </Button>
          <span className="text-muted-foreground">
            Page {page} of {pages} · {data.total} orders
          </span>
          <Button
            variant="secondary"
            size="sm"
            disabled={page >= pages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}

const ACTION_LABEL: Record<Order["status"], string> = {
  pending: "Mark pending",
  confirmed: "Confirm",
  shipped: "Mark shipped",
  delivered: "Mark delivered",
  cancelled: "Cancel order",
};

function OrderDetail({ id, onBack }: { id: number; onBack: () => void }) {
  const queryClient = useQueryClient();
  const {
    data: order,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["admin", "order", id],
    queryFn: () => adminApi.order(id),
  });
  const [tracking, setTracking] = useState("");
  const [notify, setNotify] = useState(true);

  useEffect(() => {
    if (order) setTracking(order.tracking);
  }, [order]);

  const mutation = useMutation({
    mutationFn: (body: Parameters<typeof adminApi.updateStatus>[1]) =>
      adminApi.updateStatus(id, body),
    onSuccess: (updated: AdminOrderDetail) => {
      queryClient.setQueryData(["admin", "order", id], updated);
      void queryClient.invalidateQueries({ queryKey: ["admin", "orders"] });
      void queryClient.invalidateQueries({ queryKey: ["admin", "stats"] });
      toast.success(`${updated.number}: ${ORDER_STATUS_LABEL[updated.status]}`);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  if (isLoading) return <Loader2 className="mx-auto size-6 animate-spin text-muted-foreground" />;
  if (error || !order)
    return <p className="text-sm font-bold text-destructive">{errorMessage(error)}</p>;

  const act = (status: Order["status"]) => {
    if (
      status === "cancelled" &&
      !window.confirm(`Cancel ${order.number}? Stock will be returned.`)
    )
      return;
    mutation.mutate({ status, tracking, notifyCustomer: status === "shipped" && notify });
  };

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-sm font-bold text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> All orders
      </button>

      <div className="flex flex-wrap items-center gap-2">
        <h2 className="font-display text-2xl font-extrabold">{order.number}</h2>
        <Pill tone={order.status === "confirmed" ? "strong" : "neutral"}>
          {ORDER_STATUS_LABEL[order.status]}
        </Pill>
        <Pill>{PAYMENT_STATUS_LABEL[order.paymentStatus]}</Pill>
        <span className="text-xs text-muted-foreground">Placed {dateTime(order.createdAt)}</span>
      </div>

      {order.needsAttention && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-accent/50 bg-background p-4 text-sm">
          <span className="flex items-start gap-2 font-bold">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden="true" />
            {order.needsAttention}
          </span>
          <Button
            size="sm"
            variant="secondary"
            disabled={mutation.isPending}
            onClick={() =>
              mutation.mutate({ status: order.status, clearAttention: true, notifyCustomer: false })
            }
          >
            Mark resolved
          </Button>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        <div className="space-y-4">
          <section className="rounded-3xl border border-border bg-background p-5">
            <h3 className="font-display font-extrabold">Items</h3>
            <ul className="mt-3 space-y-2 text-sm">
              {order.items.map((item) => (
                <li key={item.sku} className="flex justify-between gap-4">
                  <span>
                    {item.productName} – {item.variantName} × {item.quantity}{" "}
                    <span className="text-xs text-muted-foreground">({item.sku})</span>
                  </span>
                  <span className="font-bold tabular-nums">{formatINR(item.lineTotal)}</span>
                </li>
              ))}
            </ul>
            <dl className="mt-4 space-y-1 border-t border-border pt-3 text-sm">
              {(
                [
                  ["Subtotal", order.subtotal],
                  ["Discount", -order.discount],
                  ["Shipping", order.shipping],
                  ["COD fee", order.codFee],
                ] as const
              )
                .filter(([label, v]) => v !== 0 || label === "Subtotal")
                .map(([label, v]) => (
                  <div key={label} className="flex justify-between">
                    <dt className="text-muted-foreground">{label}</dt>
                    <dd className="tabular-nums">{v < 0 ? `−${formatINR(-v)}` : formatINR(v)}</dd>
                  </div>
                ))}
              <div className="flex justify-between font-extrabold">
                <dt>Total {order.paymentMethod === "cod" ? "(cash on delivery)" : ""}</dt>
                <dd className="tabular-nums">{formatINR(order.total)}</dd>
              </div>
            </dl>
          </section>

          <section className="rounded-3xl border border-border bg-background p-5">
            <h3 className="font-display font-extrabold">Payments</h3>
            {order.payments.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">No payment attempts yet.</p>
            ) : (
              <ul className="mt-2 space-y-2 text-sm">
                {order.payments.map((p) => (
                  <li key={p.id} className="flex flex-wrap justify-between gap-2">
                    <span>
                      <span className="font-bold capitalize">{p.status}</span> · {p.provider}
                      {p.method && p.method !== p.provider ? ` · ${p.method}` : ""}
                      {p.razorpayPaymentId && (
                        <span className="block font-mono text-xs text-muted-foreground">
                          {p.razorpayPaymentId}
                        </span>
                      )}
                      {p.errorReason && (
                        <span className="block text-xs text-destructive">{p.errorReason}</span>
                      )}
                    </span>
                    <span className="text-xs text-muted-foreground">{dateTime(p.createdAt)}</span>
                  </li>
                ))}
              </ul>
            )}
            {order.razorpayOrderId && (
              <p className="mt-3 text-xs text-muted-foreground">
                Razorpay order <span className="font-mono">{order.razorpayOrderId}</span>
              </p>
            )}
          </section>
        </div>

        <div className="space-y-4">
          <section className="rounded-3xl border border-border bg-background p-5 text-sm">
            <h3 className="font-display font-extrabold">Customer</h3>
            <p className="mt-2 font-bold">{order.name}</p>
            <p>
              <a className="text-accent hover:underline" href={`tel:${order.phone}`}>
                {order.phone}
              </a>
              {order.email ? (
                <>
                  {" · "}
                  <a className="text-accent hover:underline" href={`mailto:${order.email}`}>
                    {order.email}
                  </a>
                </>
              ) : (
                <span className="text-muted-foreground"> · no email given</span>
              )}
            </p>
            <p className="mt-2 text-muted-foreground">
              {order.address}, {order.city}, {order.state} {order.pincode}
            </p>
            {order.notes && (
              <p className="mt-3 rounded-2xl bg-cream p-3">
                <span className="font-bold">Note:</span> {order.notes}
              </p>
            )}
            <p className="mt-2 text-xs text-muted-foreground">
              {order.customerId ? "Registered customer" : "Guest checkout"}
            </p>
          </section>

          <section className="space-y-3 rounded-3xl border border-border bg-background p-5 text-sm">
            <h3 className="font-display font-extrabold">Fulfilment</h3>
            <label className="block">
              <span className="mb-1 block text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
                Courier & tracking
              </span>
              <input
                className="form-field"
                value={tracking}
                maxLength={200}
                placeholder="e.g. Delhivery 1234567890"
                onChange={(e) => setTracking(e.target.value)}
              />
            </label>
            {order.allowedStatuses.includes("shipped") && (
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={notify}
                  onChange={(e) => setNotify(e.target.checked)}
                />
                Email the customer when marked shipped
              </label>
            )}
            <div className="flex flex-wrap gap-2">
              {order.allowedStatuses
                .filter((s) => s !== "cancelled")
                .map((s) => (
                  <Button key={s} size="sm" disabled={mutation.isPending} onClick={() => act(s)}>
                    {mutation.isPending && <Loader2 className="size-4 animate-spin" />}{" "}
                    {ACTION_LABEL[s]}
                  </Button>
                ))}
              {order.tracking !== tracking && !order.allowedStatuses.includes("shipped") && (
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={mutation.isPending}
                  onClick={() =>
                    mutation.mutate({ status: order.status, tracking, notifyCustomer: false })
                  }
                >
                  Save tracking
                </Button>
              )}
              {order.allowedStatuses.includes("cancelled") && (
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={mutation.isPending}
                  onClick={() => act("cancelled")}
                >
                  Cancel order
                </Button>
              )}
            </div>
            {order.status === "cancelled" && order.paymentStatus === "paid" && (
              <p className="text-xs text-muted-foreground">
                Refunds are issued from the Razorpay Dashboard → Payments.
              </p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
