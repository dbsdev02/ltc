import { Link } from "@tanstack/react-router";
import logoHorizontal from "@/assets/brand/logo-horizontal.png";
import { site } from "@/data/site";

export function Logo({ className = "h-10" }: { className?: string }) {
  return (
    <Link
      to="/"
      aria-label={`${site.name} home`}
      className="inline-flex shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <img
        src={logoHorizontal}
        alt={site.name}
        width={900}
        height={310}
        className={`w-auto ${className}`}
      />
    </Link>
  );
}
