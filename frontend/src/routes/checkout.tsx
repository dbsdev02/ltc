import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  ArrowLeft,
  Banknote,
  CreditCard,
  Loader2,
  Lock,
  MessageCircle,
  ShoppingBag,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { QuantityStepper } from "@/components/site/QuantityStepper";
import { Field } from "@/components/site/FormField";
import { DiscountNudge, OrderSummaryRows } from "@/components/site/CartDrawer";
import { INDIAN_STATES } from "@/data/indian-states";
import { product } from "@/data/product";
import { policyLinks, site, whatsappLink } from "@/data/site";
import { useAccount } from "@/lib/account";
import { useCart } from "@/lib/cart";
import { findVariant, useCatalog } from "@/lib/catalog";
import { ApiError, errorMessage } from "@/lib/api";
import { formatINR, priceCart, type CartLine, type CartTotals } from "@/lib/pricing";
import {
  createOrder,
  createRazorpayOrder,
  customerSchema,
  verifyPayment,
  type Customer,
  type PaymentMethod,
} from "@/lib/payments";

export const Route = createFileRoute("/checkout")({
  head: () => ({
    meta: [{ title: `Checkout | ${site.name}` }, { name: "robots", content: "noindex" }],
  }),
  component: CheckoutPage,
});

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

function orderSummaryText(
  lines: CartLine[],
  totals: CartTotals,
  customer: Customer,
  variantName: (id: string) => string | undefined,
) {
  const items = lines
    .map((line) => `• ${product.name} – ${variantName(line.variantId)} × ${line.quantity}`)
    .join("\n");
  return [
    `Hi ${site.name}! I'd like to place an order:`,
    items,
    `Total: ${formatINR(totals.total)}${totals.discount ? ` (incl. ${formatINR(totals.discount)} discount)` : ""}`,
    "",
    `Name: ${customer.name}`,
    `Phone: ${customer.phone}`,
    ...(customer.email ? [`Email: ${customer.email}`] : []),
    `Address: ${customer.address}, ${customer.city}, ${customer.state} – ${customer.pincode}`,
  ].join("\n");
}

function CheckoutPage() {
  const { lines, setQuantity, clear } = useCart();
  const catalog = useCatalog();
  const navigate = useNavigate();
  const [submitting, setSubmittingState] = useState(false);
  // A ref, not just state: two fast clicks both run before React re-renders the disabled button.
  const busyRef = useRef(false);
  const setSubmitting = (value: boolean) => {
    busyRef.current = value;
    setSubmittingState(value);
  };
  const [fallback, setFallback] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("razorpay");
  const totals = priceCart(lines, catalog, paymentMethod);
  const codAllowed =
    catalog.cod.enabled &&
    (catalog.cod.maxOrderTotal === null ||
      priceCart(lines, catalog, "cod").total <= catalog.cod.maxOrderTotal);
  // Re-use the order we already created if the customer closes Razorpay and tries again.
  const pendingOrder = useRef<{
    key: string;
    id: number;
    accessToken: string;
    number: string;
  } | null>(null);

  useEffect(() => {
    if (!codAllowed && paymentMethod === "cod") setPaymentMethod("razorpay");
  }, [codAllowed, paymentMethod]);
  const { user } = useAccount();
  const {
    register,
    handleSubmit,
    getValues,
    reset,
    formState: { errors },
  } = useForm<Customer>({ resolver: zodResolver(customerSchema), mode: "onTouched" });

  // Fill in saved details for logged-in customers without overwriting anything typed.
  useEffect(() => {
    if (!user) return;
    const current = getValues();
    const saved: Customer = {
      name: user.name,
      email: user.email,
      phone: user.phone,
      address: user.address,
      city: user.city,
      state: user.state,
      pincode: user.pincode,
    };
    const merged = Object.fromEntries(
      Object.entries(saved).map(([key, value]) => [
        key,
        current[key as keyof Customer] || value || "",
      ]),
    ) as Customer;
    reset(merged, { keepTouched: true });
  }, [user, getValues, reset]);

  const goToSuccess = (number: string, accessToken: string, customer: Customer) => {
    pendingOrder.current = null;
    clear();
    navigate({
      to: "/order-success",
      search: { order: number, token: accessToken, name: customer.name.split(" ")[0] },
    });
  };

  const onSubmit = async (customer: Customer) => {
    if (busyRef.current) return;
    setSubmitting(true);
    setFallback(null);
    let keepBusy = false; // stays true while the Razorpay window is open
    try {
      const key = JSON.stringify({ lines, customer, paymentMethod });
      let order = pendingOrder.current?.key === key ? pendingOrder.current : null;
      if (!order) {
        const created = await createOrder(lines, customer, paymentMethod);
        order = { key, id: created.id, accessToken: created.accessToken, number: created.number };
        pendingOrder.current = order;
      }

      if (paymentMethod === "cod") {
        toast.success("Order placed! Please keep the amount ready at delivery.");
        goToSuccess(order.number, order.accessToken, customer);
        return;
      }

      let gateway;
      try {
        gateway = await createRazorpayOrder(order);
      } catch (error) {
        if (error instanceof ApiError && (error.status === 503 || error.status === 502)) {
          setFallback(
            orderSummaryText(lines, totals, customer, (id) => findVariant(catalog, id)?.name),
          );
        }
        throw error;
      }

      if (!(await loadRazorpay()) || !window.Razorpay) {
        toast.error(
          "Couldn't load the payment window. Please check your connection and try again.",
        );
        return;
      }

      const current = order;
      const razorpay = new window.Razorpay({
        key: gateway.keyId,
        amount: gateway.amount,
        currency: gateway.currency,
        order_id: gateway.razorpayOrderId,
        name: site.name,
        description: `${catalog.name} · ${totals.quantity} ${totals.quantity === 1 ? "bottle" : "bottles"} · ${gateway.orderNumber}`,
        prefill: {
          name: customer.name,
          contact: customer.phone,
          ...(customer.email ? { email: customer.email } : {}),
        },
        notes: { order_number: gateway.orderNumber },
        theme: { color: "#e08a5f" },
        modal: { ondismiss: () => setSubmitting(false) },
        handler: async (response: RazorpayResponse) => {
          try {
            await verifyPayment(response);
            goToSuccess(current.number, current.accessToken, customer);
          } catch {
            toast.error(
              `We couldn't confirm your payment yet. If money was deducted, it's safe — email ${site.contact.email} with order ${current.number}.`,
              { duration: 15000 },
            );
            setSubmitting(false);
          }
        },
      });
      razorpay.on("payment.failed", () => {
        toast.error("Payment failed. No money was taken — please try again.");
      });
      razorpay.open();
      keepBusy = true;
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) pendingOrder.current = null;
      toast.error(errorMessage(error));
    } finally {
      if (!keepBusy) setSubmitting(false);
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
            {user ? (
              <p className="mb-6 rounded-2xl bg-cream px-4 py-3 text-sm">
                Logged in as <span className="font-bold">{user.email}</span>. This order will be
                saved to{" "}
                <Link to="/account" className="font-bold text-accent hover:underline">
                  your account
                </Link>
                .
              </p>
            ) : (
              <p className="mb-6 rounded-2xl bg-cream px-4 py-3 text-sm">
                Have an account?{" "}
                <Link to="/account" className="font-bold text-accent hover:underline">
                  Log in
                </Link>{" "}
                to fill in your details and track this order. Or just continue as a guest.
              </p>
            )}
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
              <Field label="Email (optional)" error={errors.email?.message}>
                <input
                  className="form-field"
                  type="email"
                  autoComplete="email"
                  placeholder="For your order confirmation"
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

            <Field label="Order notes (optional)" error={errors.notes?.message} className="mt-4">
              <textarea
                className="form-field min-h-20 resize-y"
                placeholder="Anything we should know? e.g. gift message, delivery instructions"
                maxLength={500}
                aria-invalid={!!errors.notes}
                {...register("notes")}
              />
            </Field>

            {codAllowed && (
              <fieldset className="mt-8">
                <legend className="font-display text-xl font-extrabold">Payment</legend>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {(
                    [
                      ["razorpay", "Pay online", "UPI, cards, net banking & wallets", CreditCard],
                      [
                        "cod",
                        "Cash on delivery",
                        catalog.cod.fee > 0
                          ? `${formatINR(catalog.cod.fee)} COD fee`
                          : "Pay when it arrives",
                        Banknote,
                      ],
                    ] as const
                  ).map(([value, label, hint, Icon]) => (
                    <label
                      key={value}
                      className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition-colors ${paymentMethod === value ? "border-foreground bg-cream" : "border-border hover:border-foreground/40"}`}
                    >
                      <input
                        type="radio"
                        name="paymentMethod"
                        value={value}
                        checked={paymentMethod === value}
                        onChange={() => setPaymentMethod(value)}
                        className="mt-1 accent-[var(--accent)]"
                      />
                      <span>
                        <span className="flex items-center gap-2 font-bold">
                          <Icon className="size-4" /> {label}
                        </span>
                        <span className="text-xs text-muted-foreground">{hint}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
            )}

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
              {paymentMethod === "cod"
                ? `PLACE ORDER · ${formatINR(totals.total)}`
                : `PAY ${formatINR(totals.total)}`}
            </Button>
            <p className="mt-3 text-center text-xs text-muted-foreground">
              {paymentMethod === "cod"
                ? "Pay in cash when your order arrives."
                : "Secured by Razorpay · UPI, cards, net banking & wallets."}{" "}
              By placing your order you agree to our{" "}
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
                const variant = findVariant(catalog, line.variantId);
                if (!variant) return null;
                return (
                  <li key={line.variantId} className="flex items-center gap-4 py-4">
                    <img
                      src={variant.badgeImage}
                      alt=""
                      className="size-16 shrink-0 rounded-2xl bg-cream object-contain p-1.5"
                    />
                    <div className="flex-1">
                      <p className="font-display font-extrabold">{catalog.name}</p>
                      <p className="text-xs font-semibold text-muted-foreground">
                        {variant.name} · {catalog.size}
                      </p>
                      <div className="mt-2">
                        <QuantityStepper
                          size="sm"
                          min={0}
                          max={catalog.maxQuantity}
                          value={line.quantity}
                          onChange={(value) => setQuantity(line.variantId, value)}
                        />
                      </div>
                    </div>
                    <p className="font-bold tabular-nums">
                      {formatINR(line.quantity * variant.price)}
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
