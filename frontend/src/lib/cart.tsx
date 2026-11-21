import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  MAX_QUANTITY_PER_LINE,
  priceCart,
  sanitizeLines,
  type CartLine,
  type CartTotals,
} from "@/lib/pricing";
import { useCatalog, type Catalog } from "@/lib/catalog";

const STORAGE_KEY = "ltc-cart-v1";

type CartContextValue = {
  lines: CartLine[];
  totals: CartTotals;
  isOpen: boolean;
  setOpen: (open: boolean) => void;
  addItem: (variantId: string, quantity?: number) => void;
  setQuantity: (variantId: string, quantity: number) => void;
  removeItem: (variantId: string) => void;
  clear: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

function readStoredLines(catalog: Catalog): CartLine[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? sanitizeLines(JSON.parse(raw) as CartLine[], catalog) : [];
  } catch {
    return [];
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const catalog = useCatalog();
  const [lines, setLines] = useState<CartLine[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [isOpen, setOpen] = useState(false);

  // Read after mount so server and client render the same empty cart first.
  useEffect(() => {
    setLines(readStoredLines(catalog));
    setHydrated(true);
    // Only on first mount; live stock updates are applied below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When live stock arrives, drop anything that has sold out since it was added.
  useEffect(() => {
    if (catalog.source === "live") setLines((current) => sanitizeLines(current, catalog));
  }, [catalog]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
    } catch {
      // Storage can be unavailable (private mode); the cart still works in memory.
    }
  }, [lines, hydrated]);

  const addItem = useCallback(
    (variantId: string, quantity = 1) => {
      setLines((current) => {
        const existing = current.find((line) => line.variantId === variantId);
        const next = existing
          ? current.map((line) =>
              line.variantId === variantId ? { ...line, quantity: line.quantity + quantity } : line,
            )
          : [...current, { variantId, quantity }];
        return sanitizeLines(next, catalog);
      });
    },
    [catalog],
  );

  const setQuantity = useCallback(
    (variantId: string, quantity: number) => {
      setLines((current) =>
        quantity <= 0
          ? current.filter((line) => line.variantId !== variantId)
          : current.map((line) =>
              line.variantId === variantId
                ? {
                    ...line,
                    quantity: Math.min(MAX_QUANTITY_PER_LINE, catalog.maxQuantity, quantity),
                  }
                : line,
            ),
      );
    },
    [catalog.maxQuantity],
  );

  const removeItem = useCallback((variantId: string) => {
    setLines((current) => current.filter((line) => line.variantId !== variantId));
  }, []);

  const clear = useCallback(() => setLines([]), []);

  const value = useMemo(
    () => ({
      lines,
      totals: priceCart(lines, catalog),
      isOpen,
      setOpen,
      addItem,
      setQuantity,
      removeItem,
      clear,
    }),
    [lines, catalog, isOpen, addItem, setQuantity, removeItem, clear],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart must be used inside <CartProvider>");
  return context;
}
