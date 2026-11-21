import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { product as staticProduct } from "@/data/product";
import { site } from "@/data/site";
import { api } from "@/lib/api";

/**
 * Live product data (price, stock, discounts, shipping, COD, images) from GET /api/products/{id}.
 *
 * The static copy in src/data/product.ts is used only as a first paint / offline fallback,
 * so the page never flashes or shifts while the API responds. Marketing copy (FAQ, story,
 * etc.) stays in product.ts; everything that affects what a customer pays comes from here.
 */

export const PRODUCT_ID = "cloud-mist";

type ApiImage = {
  id: number;
  role: "hero" | "gallery" | "what_is" | "scent_slide" | "badge";
  url: string;
  alt: string;
  width: number | null;
  height: number | null;
  variantId: string | null;
};

type ApiVariant = {
  id: string;
  sku: string;
  name: string;
  scent: string;
  description: string;
  icon: string;
  price: number;
  inStock: boolean;
  stockLeft: number | null;
};

export type ApiProduct = {
  id: string;
  name: string;
  tagline: string;
  category: string;
  description: string;
  size: string;
  ageRange: string;
  price: number;
  compareAtPrice: number | null;
  multiUnitDiscount: { minQuantity: number; percent: number } | null;
  maxQuantity: number;
  variants: ApiVariant[];
  images: ApiImage[];
  shipping: { fee: number; freeShippingMin: number | null };
  cod: { enabled: boolean; fee: number; maxOrderTotal: number | null };
};

export type CatalogImage = {
  url: string;
  alt: string;
  width?: number | null;
  height?: number | null;
};

export type CatalogVariant = ApiVariant & { badgeImage: string };

export type Catalog = Omit<ApiProduct, "variants" | "images"> & {
  variants: CatalogVariant[];
  images: {
    hero: CatalogImage | null;
    whatIs: CatalogImage | null;
    gallery: CatalogImage[];
    scentSlides: Record<string, CatalogImage>;
  };
  /** "live" once the API answered; "fallback" while loading or if it's unreachable. */
  source: "live" | "fallback";
};

const fallback: Catalog = {
  id: PRODUCT_ID,
  name: staticProduct.name,
  tagline: staticProduct.tagline,
  category: staticProduct.category,
  description: staticProduct.description,
  size: staticProduct.size,
  ageRange: staticProduct.ageRange,
  price: staticProduct.price,
  compareAtPrice: null,
  multiUnitDiscount: { ...staticProduct.multiUnitDiscount },
  maxQuantity: 10,
  variants: staticProduct.variants.map((v) => ({
    id: v.id,
    sku: v.id,
    name: v.name,
    scent: v.scent,
    description: v.description,
    icon: v.icon,
    price: staticProduct.price,
    inStock: v.inStock,
    stockLeft: null,
    badgeImage: v.badgeImage,
  })),
  images: { hero: null, whatIs: null, gallery: [], scentSlides: {} },
  shipping: { fee: site.shipping.fee, freeShippingMin: null },
  cod: { enabled: false, fee: 0, maxOrderTotal: null },
  source: "fallback",
};

function toCatalog(data: ApiProduct): Catalog {
  const byRole = (role: ApiImage["role"]) => data.images.filter((i) => i.role === role);
  const image = (i: ApiImage): CatalogImage => ({
    url: i.url,
    alt: i.alt,
    width: i.width,
    height: i.height,
  });
  const scentSlides: Record<string, CatalogImage> = {};
  for (const i of byRole("scent_slide")) if (i.variantId) scentSlides[i.variantId] ??= image(i);
  const badges = new Map(byRole("badge").map((i) => [i.variantId, i.url]));
  const staticBadges = new Map(staticProduct.variants.map((v) => [v.id as string, v.badgeImage]));
  const hero = byRole("hero")[0];
  const whatIs = byRole("what_is")[0];
  return {
    ...data,
    variants: data.variants.map((v) => ({
      ...v,
      badgeImage:
        badges.get(v.id) ?? staticBadges.get(v.id) ?? staticProduct.variants[0].badgeImage,
    })),
    images: {
      hero: hero ? image(hero) : null,
      whatIs: whatIs ? image(whatIs) : null,
      gallery: byRole("gallery").map(image),
      scentSlides,
    },
    source: "live",
  };
}

const CatalogContext = createContext<Catalog>(fallback);

export function CatalogProvider({ children }: { children: ReactNode }) {
  const { data } = useQuery({
    queryKey: ["product", PRODUCT_ID],
    queryFn: () => api<ApiProduct>(`/api/products/${PRODUCT_ID}`),
    staleTime: 60_000,
    refetchOnWindowFocus: true,
    retry: 2,
  });
  const catalog = useMemo(() => (data ? toCatalog(data) : fallback), [data]);
  return <CatalogContext.Provider value={catalog}>{children}</CatalogContext.Provider>;
}

export function useCatalog() {
  return useContext(CatalogContext);
}

export function findVariant(catalog: Catalog, id: string) {
  return catalog.variants.find((v) => v.id === id);
}
