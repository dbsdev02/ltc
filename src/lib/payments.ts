import { z } from "zod";
import type { CartLine, CartTotals } from "@/lib/pricing";

/**
 * Razorpay integration for static hosting (Hostinger). The browser never sees the
 * secret: orders are created and verified by public/api/*.php, which read the keys
 * from razorpay-config.php stored outside public_html and recompute the amount.
 */
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

type CreateOrderResult =
  | {
      ok: true;
      keyId: string;
      orderId: string;
      amount: number;
      currency: string;
      totals: CartTotals;
    }
  | {
      ok: false;
      reason: "empty" | "invalid" | "not-configured" | "gateway-error";
      totals?: CartTotals;
    };

async function postJson<T>(url: string, body: unknown): Promise<T | null> {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    return (await response.json()) as T;
  } catch (error) {
    console.error(`Request to ${url} failed`, error);
    return null;
  }
}

export async function createPaymentOrder({
  data,
}: {
  data: { lines: readonly CartLine[]; customer: Customer };
}): Promise<CreateOrderResult> {
  const result = await postJson<CreateOrderResult>("/api/create-order.php", data);
  return result ?? { ok: false, reason: "not-configured" };
}

export async function verifyPayment({
  data,
}: {
  data: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string };
}): Promise<{ verified: boolean }> {
  const result = await postJson<{ verified: boolean }>("/api/verify-payment.php", data);
  return { verified: result?.verified === true };
}
