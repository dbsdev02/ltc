import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AlertTriangle, Loader2 } from "lucide-react";
import { errorMessage } from "@/lib/api";
import { adminApi } from "@/lib/admin";
import { formatINR } from "@/lib/pricing";

const shortDate = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" });

function Tile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-3xl border border-border bg-background p-5">
      <p className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 font-display text-3xl font-extrabold tabular-nums text-foreground">
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function AdminDashboard() {
  const [showTable, setShowTable] = useState(false);
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "stats"],
    queryFn: () => adminApi.stats(30),
  });

  if (isLoading) return <Loader2 className="mx-auto size-6 animate-spin text-muted-foreground" />;
  if (error || !data)
    return <p className="text-sm font-bold text-destructive">{errorMessage(error)}</p>;

  const last30 = data.daily.reduce((sum, d) => sum + d.revenue, 0);
  const alerts = [
    ...(data.needsAttention > 0
      ? [
          `${data.needsAttention} order${data.needsAttention === 1 ? " needs" : "s need"} attention (see Orders → Needs attention).`,
        ]
      : []),
    ...data.lowStock.map((v) => `Low stock: ${v}`),
  ];

  return (
    <div className="space-y-6">
      {alerts.length > 0 && (
        <ul className="space-y-2 rounded-3xl border border-accent/40 bg-background p-5 text-sm">
          {alerts.map((a) => (
            <li key={a} className="flex items-start gap-2 font-bold">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden="true" />
              <span>
                <span className="sr-only">Warning: </span>
                {a}
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Tile label="Revenue" value={formatINR(data.totalRevenue)} hint="Paid + COD collected" />
        <Tile
          label="Orders"
          value={String(data.totalOrders)}
          hint={`${data.bottlesSold} bottles sold`}
        />
        <Tile
          label="To ship"
          value={String(data.toShip)}
          hint={`${data.completedOrders} delivered`}
        />
        <Tile
          label="Awaiting / failed"
          value={`${data.pendingOrders} / ${data.failedPayments}`}
          hint={`${data.codPending} COD to collect`}
        />
      </div>

      <figure className="rounded-3xl border border-border bg-background p-5">
        <figcaption className="flex flex-wrap items-baseline justify-between gap-2">
          <span>
            <span className="font-display text-lg font-extrabold">Daily sales</span>{" "}
            <span className="text-sm text-muted-foreground">
              · last 30 days · {formatINR(last30)}
            </span>
          </span>
          <button
            type="button"
            className="text-xs font-bold text-accent hover:underline"
            onClick={() => setShowTable((v) => !v)}
          >
            {showTable ? "Show chart" : "Show as table"}
          </button>
        </figcaption>
        {showTable ? (
          <div className="mt-4 max-h-80 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="py-2">Date</th>
                  <th className="py-2 text-right">Orders</th>
                  <th className="py-2 text-right">Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {[...data.daily].reverse().map((d) => (
                  <tr key={d.date}>
                    <td className="py-1.5">{shortDate(d.date)}</td>
                    <td className="py-1.5 text-right tabular-nums">{d.orders}</td>
                    <td className="py-1.5 text-right tabular-nums">{formatINR(d.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data.daily}
                margin={{ top: 8, right: 4, bottom: 0, left: 0 }}
                barCategoryGap={2}
              >
                <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="0" />
                <XAxis
                  dataKey="date"
                  tickFormatter={shortDate}
                  tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                  axisLine={{ stroke: "var(--border)" }}
                  tickLine={false}
                  minTickGap={24}
                />
                <YAxis
                  width={56}
                  tickFormatter={(v: number) => (v >= 1000 ? `₹${Math.round(v / 1000)}k` : `₹${v}`)}
                  tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  cursor={{ fill: "color-mix(in oklab, var(--foreground) 6%, transparent)" }}
                  contentStyle={{
                    borderRadius: 12,
                    border: "1px solid var(--border)",
                    background: "var(--background)",
                    color: "var(--foreground)",
                    fontSize: 12,
                  }}
                  labelFormatter={(label) => shortDate(String(label))}
                  formatter={(value, _name, item) => [
                    `${formatINR(Number(value))} · ${(item.payload as { orders: number }).orders} orders`,
                    "Revenue",
                  ]}
                />
                <Bar dataKey="revenue" fill="var(--accent)" radius={[4, 4, 0, 0]} maxBarSize={18} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </figure>
    </div>
  );
}
