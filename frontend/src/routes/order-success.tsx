import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import stickerSun from "@/assets/brand/st-sun.png";
import { Button } from "@/components/ui/button";
import { site } from "@/data/site";
import { fetchOrder } from "@/lib/payments";
import { formatINR } from "@/lib/pricing";

const searchSchema = z.object({
  order: z.string().optional(),
  token: z.string().optional(),
  name: z.string().optional(),
  payment: z.string().optional(),
});

export const Route = createFileRoute("/order-success")({
  validateSearch: (search) => searchSchema.parse(search),
  head: () => ({
    meta: [{ title: `Thank you! | ${site.name}` }, { name: "robots", content: "noindex" }],
  }),
  component: OrderSuccessPage,
});

function OrderSuccessPage() {
  const { order: number, token, name } = Route.useSearch();
  const { data: order, isLoading } = useQuery({
    queryKey: ["order", number, token],
    queryFn: () => fetchOrder(number ?? "", token),
    enabled: Boolean(number),
    retry: 1,
  });
  const cod = order?.paymentMethod === "cod";
  const awaitingPayment = order && !cod && order.paymentStatus !== "paid";

  return (
    <section className="section-space">
      <div className="mx-auto flex max-w-lg flex-col items-center px-5 text-center">
        <img src={stickerSun} alt="" className="float-slow w-28" />
        <h1 className="mt-6 font-display text-4xl font-extrabold">
          Welcome to the club{name ? `, ${name}` : ""}!
        </h1>
        <p className="mt-4 text-muted-foreground">
          {awaitingPayment
            ? "We're confirming your payment with Razorpay — this usually takes a few seconds. You'll get an email as soon as it's done."
            : cod
              ? `Your order is confirmed! Please keep ${order ? formatINR(order.total) : "the amount"} ready — you'll pay in cash when it arrives.`
              : "Your order is confirmed and a little cloud of happy is on its way."}{" "}
          We'll dispatch it within {site.shipping.dispatchDays} and email you the tracking details.
        </p>
        {number && (
          <p className="mt-5 rounded-full bg-cream px-4 py-2 text-sm font-bold">
            Order number: <span className="font-mono">{number}</span>
          </p>
        )}

        {isLoading && <Loader2 className="mt-6 size-6 animate-spin text-muted-foreground" />}
        {order && (
          <div className="mt-6 w-full rounded-[2rem] border border-border bg-background p-6 text-left">
            <ul className="space-y-2 text-sm">
              {order.items.map((item) => (
                <li key={item.sku} className="flex justify-between gap-4">
                  <span>
                    {item.productName} – {item.variantName} × {item.quantity}
                  </span>
                  <span className="font-bold tabular-nums">{formatINR(item.lineTotal)}</span>
                </li>
              ))}
            </ul>
            <dl className="mt-4 space-y-1 border-t border-border pt-4 text-sm">
              {order.discount > 0 && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Discount</dt>
                  <dd className="font-bold">−{formatINR(order.discount)}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Shipping</dt>
                <dd className="font-bold">
                  {order.shipping === 0 ? "Free" : formatINR(order.shipping)}
                </dd>
              </div>
              {order.codFee > 0 && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Cash on delivery fee</dt>
                  <dd className="font-bold">{formatINR(order.codFee)}</dd>
                </div>
              )}
              <div className="flex justify-between text-base">
                <dt className="font-extrabold">{cod ? "To pay on delivery" : "Total paid"}</dt>
                <dd className="font-display font-extrabold">{formatINR(order.total)}</dd>
              </div>
            </dl>
            <p className="mt-4 text-xs text-muted-foreground">
              Delivering to {order.name}, {order.address}, {order.city}, {order.state}{" "}
              {order.pincode}
            </p>
          </div>
        )}

        <p className="mt-5 text-sm text-muted-foreground">
          Questions? Write to{" "}
          <a href={`mailto:${site.contact.email}`} className="font-bold text-accent">
            {site.contact.email}
          </a>{" "}
          or{" "}
          <a
            href={site.contact.whatsappHref}
            target="_blank"
            rel="noreferrer"
            className="font-bold text-accent"
          >
            WhatsApp us
          </a>
          .
        </p>
        <Button asChild size="lg" className="mt-8">
          <Link to="/">Back to home</Link>
        </Button>
      </div>
    </section>
  );
}
