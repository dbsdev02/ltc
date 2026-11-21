import { Link } from "@tanstack/react-router";
import { Facebook, Instagram, Mail, MessageCircle, Phone } from "lucide-react";
import logoVertical from "@/assets/brand/logo-vertical.png";
import { policyLinks, site } from "@/data/site";

const shopLinks = [
  { label: "Shop Cloud Mist", to: "/", hash: "shop" },
  { label: "Our Story", to: "/", hash: "story" },
  { label: "PR Box", to: "/", hash: "pr-box" },
  { label: "FAQ", to: "/", hash: "faq" },
  { label: "Contact Us", to: "/contact" },
] as const;

export function SiteFooter() {
  const socials = [
    { icon: Instagram, label: "Instagram", href: site.social.instagram },
    { icon: Facebook, label: "Facebook", href: site.social.facebook },
    { icon: MessageCircle, label: "WhatsApp", href: site.contact.whatsappHref },
    { icon: Mail, label: "Email", href: `mailto:${site.contact.email}` },
  ].filter((social) => social.href);

  return (
    <footer className="border-t border-footer-border bg-footer pb-28 pt-14 text-footer-foreground md:pb-14">
      <div className="mx-auto max-w-7xl px-5 lg:px-10">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.3fr_.8fr_1fr_1fr]">
          <div>
            <Link to="/" aria-label={`${site.name} home`} className="inline-block">
              <img
                src={logoVertical}
                alt={site.name}
                width={625}
                height={900}
                className="h-28 w-auto"
              />
            </Link>
            <p className="mt-4 max-w-xs text-sm leading-6 text-footer-muted">{site.footerLine}</p>
            <div className="mt-5 flex gap-3">
              {socials.map(({ icon: Icon, label, href }) => (
                <a
                  key={label}
                  href={href}
                  target={href.startsWith("http") ? "_blank" : undefined}
                  rel="noreferrer"
                  aria-label={label}
                  className="flex size-9 items-center justify-center rounded-full border border-footer-border text-footer-muted hover:border-accent hover:text-accent"
                >
                  <Icon className="size-4" />
                </a>
              ))}
            </div>
          </div>

          <nav aria-label="Shop" className="space-y-3 text-sm">
            <p className="footer-heading">Shop</p>
            {shopLinks.map((link) => (
              <Link
                key={link.label}
                to={link.to}
                {...("hash" in link ? { hash: link.hash } : {})}
                className="footer-link"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <nav aria-label="Policies" className="space-y-3 text-sm">
            <p className="footer-heading">Policies</p>
            {policyLinks.map((link) => (
              <Link key={link.to} to={link.to} className="footer-link">
                {link.label}
              </Link>
            ))}
            <Link to="/privacy-policy" hash="grievance" className="footer-link">
              Grievance Redressal
            </Link>
          </nav>

          <div className="space-y-3 text-sm">
            <p className="footer-heading">Get in touch</p>
            <a
              href={`mailto:${site.contact.email}`}
              className="footer-link flex items-center gap-2"
            >
              <Mail className="size-4 shrink-0" /> {site.contact.email}
            </a>
            <a href={site.contact.phoneHref} className="footer-link flex items-center gap-2">
              <Phone className="size-4 shrink-0" /> {site.contact.phone}
            </a>
            <a
              href={site.contact.whatsappHref}
              target="_blank"
              rel="noreferrer"
              className="footer-link flex items-center gap-2"
            >
              <MessageCircle className="size-4 shrink-0" /> WhatsApp us
            </a>
            {site.legal.address && <p className="text-footer-muted">{site.legal.address}</p>}
          </div>
        </div>

        <div className="mt-12 flex flex-col justify-between gap-3 border-t border-footer-border pt-6 text-xs text-footer-muted sm:flex-row">
          <p>
            © {new Date().getFullYear()} {site.name}. All rights reserved.
          </p>
          <p>
            {site.legal.legalName
              ? `A brand by ${site.legal.legalName}`
              : "Made with love in India"}
            {site.legal.gstin && ` · GSTIN ${site.legal.gstin}`}
          </p>
        </div>
      </div>
    </footer>
  );
}
