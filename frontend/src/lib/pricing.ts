import type { Catalog } from "@/lib/catalog";

export type CartLine = { variantId: string; quantity: number };

export const MAX_QUANTITY_PER_LINE = 10;

export function formatINR(amount: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
  }).format(amount);
}

/** Drops unknown or sold-out variants and clamps quantities to the product's limit. */
export function sanitizeLines(lines: readonly CartLine[], catalog: Catalog): CartLine[] {
  const limit = Math.min(MAX_QUANTITY_PER_LINE, catalog.maxQuantity);
  return lines
    .filter((line) => catalog.variants.find((v) => v.id === line.variantId)?.inStock)
    .map((line) => ({
      variantId: line.variantId,
      quantity: Math.min(limit, Math.max(1, Math.floor(line.quantity))),
    }));
}

/**
 * Display-only estimate that mirrors backend/app/services/pricing.py.
 * The server recalculates everything when the order is placed.
 */
export function priceCart(
  lines: readonly CartLine[],
  catalog: Catalog,
  paymentMethod: "razorpay" | "cod" = "razorpay",
) {
  const quantity = lines.reduce((sum, line) => sum + line.quantity, 0);
  const subtotal = lines.reduce((sum, line) => {
    const price = catalog.variants.find((v) => v.id === line.variantId)?.price ?? catalog.price;
    return sum + price * line.quantity;
  }, 0);
  const rule = catalog.multiUnitDiscount;
  const discount =
    rule && quantity >= rule.minQuantity ? Math.round((subtotal * rule.percent) / 100) : 0;
  const afterDiscount = subtotal - discount;
  let shipping = quantity > 0 ? catalog.shipping.fee : 0;
  if (
    catalog.shipping.freeShippingMin !== null &&
    afterDiscount >= catalog.shipping.freeShippingMin
  ) {
    shipping = 0;
  }
  const codFee = paymentMethod === "cod" ? catalog.cod.fee : 0;
  const total = afterDiscount + shipping + codFee;
  return { quantity, subtotal, discount, shipping, codFee, total };
}

export type CartTotals = ReturnType<typeof priceCart>;
