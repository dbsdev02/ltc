import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getVariant, product } from "@/data/product";
import { priceCart, sanitizeLines } from "@/lib/pricing";

/**
 * Razorpay integration. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in the
 * hosting environment (Vercel → Settings → Environment Variables). The secret
 * never leaves the server; the order amount is always recomputed here.
 */
function getKeys() {
  const keyId = process.env["RAZORPAY_KEY_ID"];
  const keySecret = process.env["RAZORPAY_KEY_SECRET"];
  return keyId && keySecret ? { keyId, keySecret } : null;
}

export const customerSchema = z.object({
  name: z.string().trim().min(2, "Please enter your full name").max(80),
  email: z.string().trim().email("Please enter a valid email"),
  phone: z
    .string()
    .trim()
    .regex(
      /^(\+?91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}$/,
      "Please enter a valid 10-digit Indian mobile number",
    ),
  address: z.string().trim().min(5, "Please enter your address").max(200),
  city: z.string().trim().min(2, "Please enter your city").max(60),
  state: z.string().trim().min(2, "Please choose your state").max(60),
  pincode: z
    .string()
    .trim()
    .regex(/^[1-9]\d{5}$/, "Please enter a valid 6-digit PIN code"),
});

export type Customer = z.infer<typeof customerSchema>;

const createOrderInput = z.object({
  lines: z
    .array(z.object({ variantId: z.string(), quantity: z.number().int().min(1).max(10) }))
    .min(1)
    .max(10),
  customer: customerSchema,
});

const clip = (value: string) => value.slice(0, 250);

export const createPaymentOrder = createServerFn({ method: "POST" })
  .validator((data: unknown) => createOrderInput.parse(data))
  .handler(async ({ data }) => {
    const lines = sanitizeLines(data.lines);
    if (lines.length === 0) {
      return { ok: false as const, reason: "empty" as const };
    }
    const totals = priceCart(lines);
    const keys = getKeys();
    if (!keys) {
      return { ok: false as const, reason: "not-configured" as const, totals };
    }

    const { customer } = data;
    const items = lines
      .map((line) => `${product.name} – ${getVariant(line.variantId)?.name} × ${line.quantity}`)
      .join(", ");

    const response = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Basic ${btoa(`${keys.keyId}:${keys.keySecret}`)}`,
      },
      body: JSON.stringify({
        amount: totals.total * 100,
        currency: "INR",
        receipt: `ltc_${Date.now()}`,
        notes: {
          items: clip(items),
          customer_name: clip(customer.name),
          customer_email: clip(customer.email),
          customer_phone: clip(customer.phone),
          address: clip(customer.address),
          city_state: clip(`${customer.city}, ${customer.state}`),
          pincode: customer.pincode,
          discount: String(totals.discount),
        },
      }),
    });

    if (!response.ok) {
      console.error("Razorpay order creation failed", response.status, await response.text());
      return { ok: false as const, reason: "gateway-error" as const, totals };
    }

    const order = (await response.json()) as { id: string; amount: number; currency: string };
    return {
      ok: true as const,
      keyId: keys.keyId,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      totals,
    };
  });

const verifyInput = z.object({
  razorpay_order_id: z.string().min(1),
  razorpay_payment_id: z.string().min(1),
  razorpay_signature: z.string().min(1),
});

async function hmacSha256Hex(secret: string, message: string) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  return Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}

export const verifyPayment = createServerFn({ method: "POST" })
  .validator((data: unknown) => verifyInput.parse(data))
  .handler(async ({ data }) => {
    const keys = getKeys();
    if (!keys) return { verified: false };
    const expected = await hmacSha256Hex(
      keys.keySecret,
      `${data.razorpay_order_id}|${data.razorpay_payment_id}`,
    );
    return { verified: expected === data.razorpay_signature };
  });
