import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { api } from "@/lib/api";
import type { Order } from "@/lib/payments";

/** Customer accounts, backed by the FastAPI /api/auth and /api/account routes (HttpOnly cookie). */

export type User = {
  id: number;
  email: string;
  name: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
};

export type AccountOrder = {
  number: string;
  date: string;
  status: "paid" | "shipped" | "delivered" | "cancelled";
  items: string;
  total: number;
  tracking: string | null;
  shippedAt: string | null;
  address: string;
  paymentMethod: "razorpay" | "cod";
};

export type ProfileUpdate = Omit<User, "id" | "email"> & {
  currentPassword?: string;
  newPassword?: string;
};

/** Kept for existing `instanceof` checks; API errors are ApiError instances. */
export { ApiError as AccountError } from "@/lib/api";

function toAccountOrder(o: Order): AccountOrder {
  return {
    number: o.number,
    date: o.paidAt ?? o.createdAt,
    status:
      o.status === "cancelled"
        ? "cancelled"
        : o.status === "delivered"
          ? "delivered"
          : o.status === "shipped"
            ? "shipped"
            : "paid",
    items: o.items.map((i) => `${i.productName} – ${i.variantName} × ${i.quantity}`).join(", "),
    total: o.total,
    tracking: o.tracking || null,
    shippedAt: o.shippedAt,
    address: `${o.address}, ${o.city}, ${o.state} ${o.pincode}`,
    paymentMethod: o.paymentMethod,
  };
}

type AccountContextValue = {
  user: User | null;
  /** True until the first "who am I" check finishes. */
  loading: boolean;
  signup: (input: {
    name: string;
    email: string;
    phone: string;
    password: string;
  }) => Promise<User>;
  login: (email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  updateProfile: (input: ProfileUpdate) => Promise<User>;
  fetchOrders: () => Promise<AccountOrder[]>;
  requestPasswordReset: (email: string) => Promise<void>;
  resetPassword: (token: string, password: string) => Promise<User>;
};

const AccountContext = createContext<AccountContextValue | null>(null);

export function AccountProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<User | null>("/api/auth/me")
      .then((data) => setUser(data))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const withUser = useCallback(async (promise: Promise<User>) => {
    const next = await promise;
    setUser(next);
    return next;
  }, []);

  const value = useMemo<AccountContextValue>(
    () => ({
      user,
      loading,
      signup: (input) => withUser(api<User>("/api/auth/signup", { body: input })),
      login: (email, password) =>
        withUser(api<User>("/api/auth/login", { body: { email, password } })),
      logout: async () => {
        await api("/api/auth/logout", { method: "POST" });
        setUser(null);
      },
      updateProfile: (input) =>
        withUser(api<User>("/api/account/profile", { method: "PUT", body: input })),
      fetchOrders: async () => (await api<Order[]>("/api/account/orders")).map(toAccountOrder),
      requestPasswordReset: async (email) => {
        await api("/api/auth/forgot-password", { body: { email } });
      },
      resetPassword: (token, password) =>
        withUser(api<User>("/api/auth/reset-password", { body: { token, password } })),
    }),
    [user, loading, withUser],
  );

  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
}

export function useAccount() {
  const context = useContext(AccountContext);
  if (!context) throw new Error("useAccount must be used inside AccountProvider");
  return context;
}
