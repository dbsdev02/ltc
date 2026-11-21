import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { policyLinks, site } from "@/data/site";

/** Name used in legal text: the registered entity once set, otherwise the brand. */
export const businessName = site.legal.legalName || site.name;

export function PolicyLayout({
  title,
  intro,
  children,
}: {
  title: string;
  intro?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="bg-background py-12 lg:py-16">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 lg:grid-cols-[1fr_15rem] lg:px-10">
        <article>
          <p className="eyebrow">Policies</p>
          <h1 className="section-title">{title}</h1>
          <p className="mt-3 text-sm font-semibold text-muted-foreground">
            Last updated: {site.policiesUpdated}
          </p>
          {intro && <p className="section-copy max-w-none">{intro}</p>}
          <div className="policy-prose mt-4 max-w-3xl">{children}</div>
        </article>
        <aside className="h-fit rounded-3xl bg-cream p-6 lg:sticky lg:top-32">
          <p className="font-display font-extrabold">More policies</p>
          <nav aria-label="Policies" className="mt-3 flex flex-col gap-2 text-sm">
            {policyLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className="font-semibold text-muted-foreground hover:text-accent"
                activeProps={{ className: "font-extrabold text-accent" }}
              >
                {link.label}
              </Link>
            ))}
            <Link to="/contact" className="font-semibold text-muted-foreground hover:text-accent">
              Contact Us
            </Link>
          </nav>
          <p className="mt-6 text-xs text-muted-foreground">
            Questions? Write to{" "}
            <a href={`mailto:${site.contact.email}`} className="font-bold text-accent">
              {site.contact.email}
            </a>
          </p>
        </aside>
      </div>
    </section>
  );
}

export function ContactBlock() {
  return (
    <ul>
      {site.legal.legalName && (
        <li>
          <strong>Business:</strong> {site.legal.legalName}
        </li>
      )}
      <li>
        <strong>Email:</strong> <a href={`mailto:${site.contact.email}`}>{site.contact.email}</a>
      </li>
      <li>
        <strong>Phone / WhatsApp:</strong> <a href={site.contact.phoneHref}>{site.contact.phone}</a>
      </li>
      {site.legal.address && (
        <li>
          <strong>Address:</strong> {site.legal.address}
        </li>
      )}
      <li>
        <strong>Hours:</strong> {site.contact.hours}
      </li>
    </ul>
  );
}

export function policyHead(title: string, description: string, path: string) {
  return {
    meta: [
      { title: `${title} | ${site.name}` },
      { name: "description", content: description },
      { property: "og:title", content: `${title} | ${site.name}` },
    ],
    links: [{ rel: "canonical", href: `${site.url}${path}` }],
  };
}
