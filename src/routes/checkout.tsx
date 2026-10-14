import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Lock, MessageCircle, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { QuantityStepper } from "@/components/site/QuantityStepper";
import { DiscountNudge, OrderSummaryRows } from "@/components/site/CartDrawer";
import { getVariant, product } from "@/data/product";
import { policyLinks, site, whatsappLink } from "@/data/site";
import { useCart } from "@/lib/cart";
import { formatINR, type CartLine, type CartTotals } from "@/lib/pricing";
import { createPaymentOrder, customerSchema, verifyPayment, type Customer } from "@/lib/payments";

export const Route = createFileRoute("/checkout")({
  head: () => ({
    meta: [{ title: `Checkout | ${site.name}` }, { name: "robots", content: "noindex" }],
  }),
  component: CheckoutPage,
});

const INDIAN_STATES = [
  "Andaman and Nicobar Islands",
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chandigarh",
  "Chhattisgarh",
  "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jammu and Kashmir",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Ladakh",
  "Lakshadweep",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Puducherry",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
];

type RazorpayResponse = {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};

type RazorpayInstance = {
  open: () => void;
  on: (event: string, cb: (res: unknown) => void) => void;
};

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => RazorpayInstance;
  }
}

function loadRazorpay() {
  return new Promise<boolean>((resolve) => {
    if (window.Razorpay) return resolve(true);
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

function orderSummaryText(lines: CartLine[], totals: CartTotals, customer: Customer) {
  const items = lines
    .map((line) => `• ${product.name} – ${getVariant(line.variantId)?.name} × ${line.quantity}`)
    .join("\n");
  return [
    `Hi ${site.name}! I'd like to place an order:`,
    items,
    `Total: ${formatINR(totals.total)}${totals.discount ? ` (incl. ${formatINR(totals.discount)} discount)` : ""}`,
    "",
    `Name: ${customer.name}`,
    `Phone: ${customer.phone}`,
    `Email: ${customer.email}`,
    `Address: ${customer.address}, ${customer.city}, ${customer.state} – ${customer.pincode}`,
  ].join("\n");
}

function Field({
  label,
  error,
  className = "",
  children,
}: {
  label: string;
  error?: string | undefined;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      {children}
      {error && <span className="mt-1 block text-xs font-bold text-destructive">{error}</span>}
    </label>
  );
}

function CheckoutPage() {
  const { lines, totals, setQuantity, clear } = useCart();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [fallback, setFallback] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Customer>({ resolver: zodResolver(customerSchema), mode: "onTouched" });

  const onSubmit = async (customer: Customer) => {
    setSubmitting(true);
    setFallback(null);
    try {
      const order = await createPaymentOrder({ data: { lines, customer } });
      if (!order.ok) {
        if (order.reason === "empty") {
          toast.error("Your cart is empty.");
        } else {
          setFallback(orderSummaryText(lines, totals, customer));
          if (order.reason === "gateway-error")
            toast.error(
              "We couldn't reach the payment gateway. Please try again or order on WhatsApp.",
            );
        }
        return;
      }

      if (!(await loadRazorpay()) || !window.Razorpay) {
        toast.error(
          "Couldn't load the payment window. Please check your connection and try again.",
        );
        return;
      }

      const razorpay = new window.Razorpay({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        order_id: order.orderId,
        name: site.name,
        description: `${product.name} · ${totals.quantity} ${totals.quantity === 1 ? "bottle" : "bottles"}`,
        prefill: { name: customer.name, email: customer.email, contact: customer.phone },
        notes: {
          address: `${customer.address}, ${customer.city}, ${customer.state} ${customer.pincode}`,
        },
        theme: { color: "#e08a5f" },
        handler: async (response: RazorpayResponse) => {
          const result = await verifyPayment({ data: response });
          if (result.verified) {
            clear();
            navigate({
              to: "/order-success",
              search: { payment: response.razorpay_payment_id, name: customer.name.split(" ")[0] },
            });
          } else {
            toast.error(
              `We couldn't verify your payment. Please contact us at ${site.contact.email} with payment ID ${response.razorpay_payment_id}.`,
            );
          }
        },
      });
      razorpay.on("payment.failed", () => {
        toast.error("Payment failed. No money was taken — please try again.");
      });
      razorpay.open();
    } catch (error) {
      console.error(error);
      toast.error("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (lines.length === 0) {
    return (
      <section className="section-space">
        <div className="mx-auto flex max-w-md flex-col items-center px-5 text-center">
          <span className="flex size-16 items-center justify-center rounded-full bg-cream">
            <ShoppingBag className="size-7 text-foreground/70" />
          </span>
          <h1 className="mt-5 font-display text-3xl font-extrabold">Your cart is empty</h1>
          <p className="mt-2 text-muted-foreground">
            Add a little Cloud Mist magic to get started.
          </p>
          <Button asChild size="lg" className="mt-6">
            <Link to="/" hash="shop">
              {product.cta}
            </Link>
          </Button>
        </div>
      </section>
    );
  }

  return (
    <section className="bg-cream/50 py-10 lg:py-14">
      <div className="mx-auto max-w-6xl px-5 lg:px-10">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-sm font-bold text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Continue shopping
        </Link>
        <h1 className="mt-4 font-display text-3xl font-extrabold sm:text-4xl">Checkout</h1>

        <div className="mt-8 grid gap-8 lg:grid-cols-[1.25fr_1fr]">
          <form
            noValidate
            onSubmit={handleSubmit(onSubmit)}
            className="order-2 rounded-[2rem] border border-border bg-background p-6 sm:p-8 lg:order-1"
          >
            <h2 className="font-display text-xl font-extrabold">Contact</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label="Full name" error={errors.name?.message} className="sm:col-span-2">
                <input
                  className="form-field"
                  autoComplete="name"
                  aria-invalid={!!errors.name}
                  {...register("name")}
                />
              </Field>
              <Field label="Email" error={errors.email?.message}>
                <input
                  className="form-field"
                  type="email"
                  autoComplete="email"
                  aria-invalid={!!errors.email}
                  {...register("email")}
                />
              </Field>
              <Field label="Mobile number" error={errors.phone?.message}>
                <input
                  className="form-field"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="98765 43210"
                  aria-invalid={!!errors.phone}
                  {...register("phone")}
                />
              </Field>
            </div>

            <h2 className="mt-8 font-display text-xl font-extrabold">Shipping address</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label="Address" error={errors.address?.message} className="sm:col-span-2">
                <textarea
                  className="form-field min-h-24 resize-y"
                  autoComplete="street-address"
                  placeholder="House / flat no., building, street, area"
                  aria-invalid={!!errors.address}
                  {...register("address")}
                />
              </Field>
              <Field label="City" error={errors.city?.message}>
                <input
                  className="form-field"
                  autoComplete="address-level2"
                  aria-invalid={!!errors.city}
                  {...register("city")}
                />
              </Field>
              <Field label="PIN code" error={errors.pincode?.message}>
                <input
                  className="form-field"
                  inputMode="numeric"
                  maxLength={6}
                  autoComplete="postal-code"
                  aria-invalid={!!errors.pincode}
                  {...register("pincode")}
                />
              </Field>
              <Field label="State" error={errors.state?.message} className="sm:col-span-2">
                <select
                  className="form-field"
                  autoComplete="address-level1"
                  defaultValue=""
                  aria-invalid={!!errors.state}
                  {...register("state")}
                >
                  <option value="" disabled>
                    Select your state
                  </option>
                  {INDIAN_STATES.map((state) => (
                    <option key={state}>{state}</option>
                  ))}
                </select>
              </Field>
            </div>

            {fallback && (
              <div role="status" className="mt-8 rounded-2xl border border-accent/40 bg-cream p-5">
                <p className="font-display font-extrabold">Online payments are being set up</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  You can still place your order right now on WhatsApp — we'll confirm it and share
                  a payment link.
                </p>
                <Button asChild className="mt-4">
                  <a href={whatsappLink(fallback)} target="_blank" rel="noreferrer">
                    <MessageCircle className="size-4" /> Order on WhatsApp
                  </a>
                </Button>
              </div>
            )}

            <Button type="submit" size="lg" className="mt-8 w-full" disabled={submitting}>
              {submitting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Lock className="size-4" />
              )}
              PAY {formatINR(totals.total)}
            </Button>
            <p className="mt-3 text-center text-xs text-muted-foreground">
              Secured by Razorpay · UPI, cards, net banking & wallets. By placing your order you
              agree to our{" "}
              {policyLinks.map((link, index) => (
                <span key={link.to}>
                  <Link to={link.to} className="font-bold underline underline-offset-2">
                    {link.label}
                  </Link>
                  {index < policyLinks.length - 2
                    ? ", "
                    : index === policyLinks.length - 2
                      ? " and "
                      : "."}
                </span>
              ))}
            </p>
          </form>

          <aside className="order-1 h-fit rounded-[2rem] border border-border bg-background p-6 sm:p-8 lg:sticky lg:top-32 lg:order-2">
            <h2 className="font-display text-xl font-extrabold">Order summary</h2>
            <ul className="mt-4 divide-y divide-border">
              {lines.map((line) => {
                const variant = getVariant(line.variantId);
                if (!variant) return null;
                return (
                  <li key={line.variantId} className="flex items-center gap-4 py-4">
                    <img
                      src={variant.badgeImage}
                      alt=""
                      className="size-16 shrink-0 rounded-2xl bg-cream object-contain p-1.5"
                    />
                    <div className="flex-1">
                      <p className="font-display font-extrabold">{product.name}</p>
                      <p className="text-xs font-semibold text-muted-foreground">
                        {variant.name} · {product.size}
                      </p>
                      <div className="mt-2">
                        <QuantityStepper
                          size="sm"
                          min={0}
                          value={line.quantity}
                          onChange={(value) => setQuantity(line.variantId, value)}
                        />
                      </div>
                    </div>
                    <p className="font-bold tabular-nums">
                      {formatINR(line.quantity * product.price)}
                    </p>
                  </li>
                );
              })}
            </ul>
            <div className="mt-4 space-y-4">
              <DiscountNudge quantity={totals.quantity} />
              <OrderSummaryRows totals={totals} />
              <p className="text-xs text-muted-foreground">
                Dispatched within {site.shipping.dispatchDays}; delivered in{" "}
                {site.shipping.deliveryDays}.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}
