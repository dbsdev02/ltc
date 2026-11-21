import { api } from "@/lib/api";
import type { Order } from "@/lib/payments";

/** Typed client for /api/admin/*. Every call needs the HttpOnly admin session cookie. */

export type AdminUser = { id: number; email: string; name: string; role: "owner" | "staff" };

export type Stats = {
  totalOrders: number;
  totalRevenue: number;
  pendingOrders: number;
  toShip: number;
  completedOrders: number;
  failedPayments: number;
  codPending: number;
  bottlesSold: number;
  lowStock: string[];
  needsAttention: number;
  daily: { date: string; orders: number; revenue: number }[];
};

export type OrderFilter =
  | "all"
  | "to_ship"
  | "shipped"
  | "delivered"
  | "pending"
  | "failed"
  | "cod"
  | "cancelled"
  | "attention";

export type AdminOrderListItem = {
  id: number;
  number: string;
  createdAt: string;
  status: Order["status"];
  paymentStatus: Order["paymentStatus"];
  paymentMethod: Order["paymentMethod"];
  name: string;
  email: string;
  phone: string;
  total: number;
  itemCount: number;
  needsAttention: string;
};

export type AdminPayment = {
  id: number;
  provider: string;
  razorpayPaymentId: string | null;
  amount: number;
  status: string;
  method: string;
  errorReason: string;
  createdAt: string;
};

export type AdminOrderDetail = Order & {
  razorpayOrderId: string | null;
  customerId: number | null;
  needsAttention: string;
  payments: AdminPayment[];
  allowedStatuses: Order["status"][];
};

export type AdminVariant = {
  id: number;
  slug: string;
  sku: string;
  name: string;
  scent: string;
  description: string;
  icon: string;
  price: number | null;
  sortOrder: number;
  isActive: boolean;
  stock: number;
  lowStockThreshold: number;
};

export type ImageRole = "hero" | "gallery" | "what_is" | "scent_slide" | "badge";

export type AdminImage = {
  id: number;
  role: ImageRole;
  url: string;
  publicId: string;
  alt: string;
  width: number | null;
  height: number | null;
  sortOrder: number;
  variantId: number | null;
};

export type AdminProduct = {
  id: number;
  slug: string;
  name: string;
  tagline: string;
  category: string;
  description: string;
  sizeLabel: string;
  ageRange: string;
  price: number;
  compareAtPrice: number | null;
  multiUnitMinQty: number | null;
  multiUnitPercent: number | null;
  maxQtyPerOrder: number;
  isActive: boolean;
  variants: AdminVariant[];
  images: AdminImage[];
};

export type StoreSettings = {
  shippingFee: number;
  freeShippingMin: number | null;
  codEnabled: boolean;
  codFee: number;
  codMaxOrderTotal: number | null;
};

export const adminApi = {
  me: () => api<AdminUser>("/api/admin/auth/me"),
  login: (email: string, password: string) =>
    api<AdminUser>("/api/admin/auth/login", { body: { email, password } }),
  logout: () => api<void>("/api/admin/auth/logout", { method: "POST" }),
  stats: (days = 30) => api<Stats>(`/api/admin/stats?days=${days}`),
  orders: (filter: OrderFilter, q: string, page: number) =>
    api<{ orders: AdminOrderListItem[]; total: number; page: number; pageSize: number }>(
      `/api/admin/orders?${new URLSearchParams({ filter, q, page: String(page) })}`,
    ),
  order: (id: number) => api<AdminOrderDetail>(`/api/admin/orders/${id}`),
  updateStatus: (
    id: number,
    body: {
      status: Order["status"];
      tracking?: string;
      notifyCustomer?: boolean;
      clearAttention?: boolean;
    },
  ) => api<AdminOrderDetail>(`/api/admin/orders/${id}/status`, { method: "PATCH", body }),
  products: () => api<AdminProduct[]>("/api/admin/products"),
  saveProduct: (id: number, body: unknown) =>
    api<AdminProduct>(`/api/admin/products/${id}`, { method: "PUT", body }),
  uploadImage: (form: FormData) =>
    api<AdminImage>("/api/admin/images/upload", { method: "POST", form }),
  updateImage: (
    id: number,
    body: Partial<Pick<AdminImage, "role" | "alt" | "sortOrder" | "variantId">>,
  ) => api<AdminImage>(`/api/admin/images/${id}`, { method: "PATCH", body }),
  deleteImage: (id: number) => api<void>(`/api/admin/images/${id}`, { method: "DELETE" }),
  settings: () => api<StoreSettings>("/api/admin/settings"),
  saveSettings: (body: StoreSettings) =>
    api<StoreSettings>("/api/admin/settings", { method: "PUT", body }),
};

export const ORDER_STATUS_LABEL: Record<Order["status"], string> = {
  pending: "Awaiting payment",
  confirmed: "To ship",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

export const PAYMENT_STATUS_LABEL: Record<Order["paymentStatus"], string> = {
  pending: "Unpaid",
  paid: "Paid",
  failed: "Payment failed",
  refunded: "Refunded",
  cod_pending: "COD – to collect",
  cod_collected: "COD – collected",
};
