import { getVariant, product } from "@/data/product";
import { site } from "@/data/site";

export type CartLine = { variantId: string; quantity: number };

export const MAX_QUANTITY_PER_LINE = 10;

export function formatINR(amount: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
  }).format(amount);
}

/** Drops unknown or sold-out variants and clamps quantities. */
export function sanitizeLines(lines: readonly CartLine[]): CartLine[] {
  return lines
    .filter((line) => getVariant(line.variantId)?.inStock)
    .map((line) => ({
      variantId: line.variantId,
      quantity: Math.min(MAX_QUANTITY_PER_LINE, Math.max(1, Math.floor(line.quantity))),
    }));
}

export function priceCart(lines: readonly CartLine[]) {
  const quantity = lines.reduce((sum, line) => sum + line.quantity, 0);
  const subtotal = quantity * product.price;
  const { minQuantity, percent } = product.multiUnitDiscount;
  const discount = quantity >= minQuantity ? Math.round((subtotal * percent) / 100) : 0;
  const shipping = quantity > 0 ? site.shipping.fee : 0;
  const total = subtotal - discount + shipping;
  return { quantity, subtotal, discount, shipping, total };
}

export type CartTotals = ReturnType<typeof priceCart>;
