import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Menu, ShoppingBag, X } from "lucide-react";
import { Logo } from "@/components/site/Logo";
import { product } from "@/data/product";
import { site } from "@/data/site";
import { useCart } from "@/lib/cart";

const links = [
  { label: "Shop", to: "/", hash: "shop" },
  { label: "Our Story", to: "/", hash: "story" },
  { label: "FAQ", to: "/", hash: "faq" },
  { label: "Contact", to: "/contact" },
] as const;

export function SiteHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { totals, setOpen } = useCart();

  return (
    <header className="sticky inset-x-0 top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
      <div className="bg-secondary px-5 py-2 text-center text-[11px] font-bold text-secondary-foreground sm:text-xs">
        {site.shipping.fee === 0 && "Free shipping across India · "}Buy{" "}
        {product.multiUnitDiscount.minQuantity}+ bottles, get {product.multiUnitDiscount.percent}%
        off
      </div>
      <nav
        aria-label="Main navigation"
        className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-3 lg:px-10"
      >
        <button
          type="button"
          className="text-foreground md:hidden"
          aria-label="Toggle menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((v) => !v)}
        >
          {menuOpen ? <X className="size-6" /> : <Menu className="size-6" />}
        </button>
        <Logo className="h-9 sm:h-11" />
        <div className="hidden items-center gap-8 text-sm font-bold md:flex">
          {links.map((link) => (
            <Link
              key={link.label}
              className="nav-link"
              to={link.to}
              {...("hash" in link ? { hash: link.hash } : {})}
            >
              {link.label}
            </Link>
          ))}
        </div>
        <button
          type="button"
          aria-label={`Open cart, ${totals.quantity} items`}
          onClick={() => setOpen(true)}
          className="relative text-foreground/80 hover:text-foreground"
        >
          <ShoppingBag className="size-6" />
          {totals.quantity > 0 && (
            <span className="absolute -right-2 -top-2 flex size-5 items-center justify-center rounded-full bg-accent text-[10px] font-extrabold text-white">
              {totals.quantity}
            </span>
          )}
        </button>
      </nav>
      {menuOpen && (
        <div className="border-t border-border bg-background px-5 py-4 md:hidden">
          <ul className="flex flex-col gap-4 text-sm font-bold">
            {links.map((link) => (
              <li key={link.label}>
                <Link
                  to={link.to}
                  {...("hash" in link ? { hash: link.hash } : {})}
                  className="nav-link"
                  onClick={() => setMenuOpen(false)}
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </header>
  );
}
