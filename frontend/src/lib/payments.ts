import { z } from "zod";
import { api } from "@/lib/api";
import { PRODUCT_ID } from "@/lib/catalog";
import type { CartLine } from "@/lib/pricing";

/**
 * Checkout against the FastAPI backend. The server re-prices everything, checks stock,
 * creates the Razorpay order with its secret key and verifies the payment signature.
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
  notes: z.string().trim().max(500, "Please keep notes under 500 characters").optional(),
});

export type Customer = z.infer<typeof customerSchema>;
export type PaymentMethod = "razorpay" | "cod";

export type OrderItem = {
  productName: string;
  variantName: string;
  sku: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
};

export type Order = {
  id: number;
  number: string;
  status: "pending" | "confirmed" | "shipped" | "delivered" | "cancelled";
  paymentStatus: "pending" | "paid" | "failed" | "refunded" | "cod_pending" | "cod_collected";
  paymentMethod: PaymentMethod;
  createdAt: string;
  paidAt: string | null;
  shippedAt: string | null;
  name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  notes: string;
  tracking: string;
  subtotal: number;
  discount: number;
  shipping: number;
  codFee: number;
  total: number;
  items: OrderItem[];
};

export type CreatedOrder = Order & { accessToken: string };

export type RazorpayOrder = {
  keyId: string;
  razorpayOrderId: string;
  amount: number;
  currency: string;
  orderNumber: string;
  name: string;
  email: string;
  phone: string;
};

export function createOrder(
  lines: readonly CartLine[],
  customer: Customer,
  paymentMethod: PaymentMethod,
) {
  return api<CreatedOrder>("/api/orders", {
    body: {
      productId: PRODUCT_ID,
      lines,
      customer: { ...customer, notes: customer.notes ?? "" },
      paymentMethod,
    },
  });
}

export function createRazorpayOrder(order: { id: number; accessToken: string }) {
  return api<RazorpayOrder>("/api/payments/create-order", {
    body: { orderId: order.id, accessToken: order.accessToken },
  });
}

export function verifyPayment(data: {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}) {
  return api<{ verified: boolean; orderNumber: string | null; accessToken: string | null }>(
    "/api/payments/verify",
    { body: data },
  );
}

export function fetchOrder(number: string, token?: string) {
  const query = token ? `?token=${encodeURIComponent(token)}` : "";
  return api<Order>(`/api/orders/${encodeURIComponent(number)}${query}`);
}
