import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Instagram, Mail, MessageCircle, Phone, Send } from "lucide-react";
import stickerCloud from "@/assets/brand/st-cloud.png";
import { Button } from "@/components/ui/button";
import { policyHead } from "@/components/site/PolicyLayout";
import { site, whatsappLink } from "@/data/site";

export const Route = createFileRoute("/contact")({
  head: () =>
    policyHead(
      "Contact Us",
      `Get in touch with ${site.name} — email, phone, WhatsApp or Instagram.`,
      "/contact",
    ),
  component: ContactPage,
});

function ContactPage() {
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");

  const channels = [
    { icon: Mail, label: "Email", value: site.contact.email, href: `mailto:${site.contact.email}` },
    { icon: Phone, label: "Call", value: site.contact.phone, href: site.contact.phoneHref },
    {
      icon: MessageCircle,
      label: "WhatsApp",
      value: "Chat with us",
      href: site.contact.whatsappHref,
    },
    { icon: Instagram, label: "Instagram", value: "@littletoddsclub", href: site.social.instagram },
  ];

  return (
    <section className="section-space bg-background">
      <div className="mx-auto grid max-w-6xl gap-12 px-5 lg:grid-cols-2 lg:px-10">
        <div>
          <p className="eyebrow">Contact us</p>
          <h1 className="section-title">We'd love to hear from you</h1>
          <p className="section-copy">
            Questions about Cloud Mist, an order, or a collaboration? Reach out any way you like — a
            real parent will reply, usually within one business day.
          </p>
          <ul className="mt-8 grid gap-4 sm:grid-cols-2">
            {channels.map(({ icon: Icon, label, value, href }) => (
              <li key={label}>
                <a
                  href={href}
                  target={href.startsWith("http") ? "_blank" : undefined}
                  rel="noreferrer"
                  className="flex h-full items-center gap-4 rounded-2xl border border-border bg-cream/60 p-4 transition hover:border-accent"
                >
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-background text-accent">
                    <Icon className="size-5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
                      {label}
                    </span>
                    <span className="block truncate font-bold">{value}</span>
                  </span>
                </a>
              </li>
            ))}
          </ul>
          <p className="mt-6 text-sm text-muted-foreground">
            <strong className="text-foreground">Hours:</strong> {site.contact.hours}
          </p>
          {site.legal.address && (
            <p className="mt-2 text-sm text-muted-foreground">
              <strong className="text-foreground">Address:</strong> {site.legal.address}
            </p>
          )}
        </div>

        <div className="relative rounded-[2rem] bg-sky/40 p-6 sm:p-8">
          <img src={stickerCloud} alt="" className="float-slow absolute -top-8 right-6 w-24" />
          <h2 className="font-display text-2xl font-extrabold">Send us a message</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            This opens WhatsApp with your message ready to send.
          </p>
          <form
            className="mt-6 space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              window.open(
                whatsappLink(`Hi ${site.name}! I'm ${name}.\n\n${message}`),
                "_blank",
                "noopener",
              );
            }}
          >
            <label className="block">
              <span className="mb-1.5 block text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
                Your name
              </span>
              <input
                className="form-field"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
                Message
              </span>
              <textarea
                className="form-field min-h-36"
                required
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
            </label>
            <Button type="submit" size="lg" className="w-full">
              <Send className="size-4" /> Send on WhatsApp
            </Button>
          </form>
        </div>
      </div>
    </section>
  );
}
