import { Link } from "@tanstack/react-router";
import { ShoppingBag, Trash2 } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { QuantityStepper } from "@/components/site/QuantityStepper";
import { getVariant, product } from "@/data/product";
import { useCart } from "@/lib/cart";
import { formatINR } from "@/lib/pricing";

export function DiscountNudge({ quantity }: { quantity: number }) {
  const { minQuantity, percent } = product.multiUnitDiscount;
  if (quantity === 0) return null;
  if (quantity >= minQuantity) {
    return (
      <p className="rounded-xl bg-secondary px-4 py-3 text-xs font-bold text-secondary-foreground">
        🎉 Yay! {percent}% multi-bottle discount applied.
      </p>
    );
  }
  return (
    <p className="rounded-xl bg-cream px-4 py-3 text-xs font-bold text-foreground">
      Add {minQuantity - quantity} more bottle and get {percent}% off your whole order.
    </p>
  );
}

export function OrderSummaryRows({ totals }: { totals: ReturnType<typeof useCart>["totals"] }) {
  return (
    <dl className="space-y-2 text-sm">
      <div className="flex justify-between">
        <dt className="text-muted-foreground">Subtotal</dt>
        <dd className="font-bold tabular-nums">{formatINR(totals.subtotal)}</dd>
      </div>
      {totals.discount > 0 && (
        <div className="flex justify-between text-[oklch(0.5_0.1_150)]">
          <dt>Multi-bottle discount ({product.multiUnitDiscount.percent}%)</dt>
          <dd className="font-bold tabular-nums">−{formatINR(totals.discount)}</dd>
        </div>
      )}
      <div className="flex justify-between">
        <dt className="text-muted-foreground">Shipping</dt>
        <dd className="font-bold">{totals.shipping === 0 ? "Free" : formatINR(totals.shipping)}</dd>
      </div>
      <div className="flex justify-between border-t border-border pt-3 text-base">
        <dt className="font-extrabold">Total</dt>
        <dd className="font-display text-lg font-extrabold tabular-nums">
          {formatINR(totals.total)}
        </dd>
      </div>
    </dl>
  );
}

export function CartDrawer() {
  const { lines, totals, isOpen, setOpen, setQuantity, removeItem } = useCart();

  return (
    <Sheet open={isOpen} onOpenChange={setOpen}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 bg-background p-0 sm:max-w-md"
      >
        <SheetHeader className="border-b border-border px-6 py-5 text-left">
          <SheetTitle className="font-display text-xl font-extrabold">Your cart</SheetTitle>
          <SheetDescription>
            {totals.quantity === 0
              ? "Your cart is empty."
              : `${totals.quantity} ${totals.quantity === 1 ? "bottle" : "bottles"} in your cart`}
          </SheetDescription>
        </SheetHeader>

        {lines.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
            <span className="flex size-16 items-center justify-center rounded-full bg-cream">
              <ShoppingBag className="size-7 text-foreground/70" />
            </span>
            <p className="text-sm text-muted-foreground">
              Nothing here yet — your little one is waiting!
            </p>
            <Button asChild onClick={() => setOpen(false)}>
              <Link to="/" hash="shop">
                {product.cta}
              </Link>
            </Button>
          </div>
        ) : (
          <>
            <ul className="flex-1 divide-y divide-border overflow-y-auto px-6">
              {lines.map((line) => {
                const variant = getVariant(line.variantId);
                if (!variant) return null;
                return (
                  <li key={line.variantId} className="flex gap-4 py-5">
                    <img
                      src={variant.badgeImage}
                      alt=""
                      className="size-20 shrink-0 rounded-2xl bg-cream object-contain p-2"
                    />
                    <div className="flex flex-1 flex-col">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-display font-extrabold">{product.name}</p>
                          <p className="text-xs font-semibold text-muted-foreground">
                            {variant.name} · {product.size}
                          </p>
                        </div>
                        <button
                          type="button"
                          aria-label={`Remove ${variant.name}`}
                          className="text-muted-foreground hover:text-destructive"
                          onClick={() => removeItem(line.variantId)}
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                      <div className="mt-auto flex items-center justify-between pt-3">
                        <QuantityStepper
                          size="sm"
                          value={line.quantity}
                          min={0}
                          onChange={(value) => setQuantity(line.variantId, value)}
                        />
                        <p className="font-bold tabular-nums">
                          {formatINR(line.quantity * product.price)}
                        </p>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
            <div className="space-y-4 border-t border-border bg-cream/60 px-6 py-5">
              <DiscountNudge quantity={totals.quantity} />
              <OrderSummaryRows totals={totals} />
              <Button asChild size="lg" className="w-full" onClick={() => setOpen(false)}>
                <Link to="/checkout">CHECKOUT · {formatINR(totals.total)}</Link>
              </Button>
              <p className="text-center text-[11px] text-muted-foreground">
                Secure payments by Razorpay · UPI, cards, net banking & wallets
              </p>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
