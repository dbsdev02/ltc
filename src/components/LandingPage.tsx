import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import {
  ArrowRight,
  Ban,
  Check,
  ChevronLeft,
  ChevronRight,
  Cloud,
  Citrus,
  Droplet,
  HeartHandshake,
  Image as ImageIcon,
  Leaf,
  Mail,
  Menu,
  MessageCircle,
  Instagram,
  Plane,
  Plus,
  Quote,
  Search,
  ShoppingBag,
  Sparkles,
  Star,
  Users,
  X,
} from "lucide-react";
import bottleImage from "@/assets/lumelle-bottle.png";
import { product } from "@/data/product";
import { Button } from "@/components/ui/button";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

function scrollToPurchase() {
  document.querySelector("#top")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

const trustIcons: Record<string, typeof Droplet> = {
  coconut: Citrus,
  vitamin: Droplet,
  alcoholFree: Ban,
  gentle: HeartHandshake,
  vegan: Leaf,
  love: Cloud,
};

const momentIcons: Record<string, typeof Plane> = {
  hair: Sparkles,
  body: HeartHandshake,
  travel: Plane,
  playdates: Users,
};

const momentTints = [
  "color-mix(in oklab, var(--secondary) 100%, transparent)",
  "color-mix(in oklab, var(--primary) 55%, var(--background))",
  "oklch(0.88 0.06 230)",
  "color-mix(in oklab, var(--accent) 70%, var(--background))",
];

function Reveal({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

function PhotoPlaceholder({
  label,
  aspect = "aspect-[4/5]",
  className = "",
}: {
  label: string;
  aspect?: string;
  className?: string;
}) {
  return (
    <div
      className={`photo-placeholder ${aspect} ${className}`}
      role="img"
      aria-label={`Placeholder image — ${label}`}
    >
      <ImageIcon className="size-8" strokeWidth={1.5} />
      <p>{label}</p>
      <p className="photo-placeholder-hint">Replace with final photography</p>
    </div>
  );
}

function ProductBottle({
  eager = false,
  className = "",
  interactive = false,
}: {
  eager?: boolean;
  className?: string;
  interactive?: boolean;
}) {
  const reduced = useReducedMotion();
  const stageRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const auraRef = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const stage = stageRef.current;
    const img = imgRef.current;
    const aura = auraRef.current;
    if (!stage || !img || !aura) return;

    const ctx = gsap.context(() => {
      if (reduced) {
        gsap.set(img, { opacity: 1, scale: 1, y: 0, rotate: 0 });
        return;
      }

      gsap.set(img, { opacity: 0, scale: 0.86, y: 32, rotate: -3, transformPerspective: 900 });
      gsap.set(aura, { opacity: 0.35, scale: 0.9 });

      const tl = gsap.timeline({
        scrollTrigger: { trigger: stage, start: "top 85%", once: true },
        defaults: { ease: "back.out(1.6)" },
      });
      tl.to(img, { opacity: 1, scale: 1, y: 0, rotate: 0, duration: 1.1 })
        .to(img, { y: -14, duration: 2.8, ease: "sine.inOut", repeat: -1, yoyo: true }, "-=0.15")
        .to(
          aura,
          { opacity: 0.8, scale: 1.08, duration: 2.8, ease: "sine.inOut", repeat: -1, yoyo: true },
          "<",
        );
    }, stage);

    let cleanupTilt: (() => void) | undefined;
    if (interactive && !reduced) {
      gsap.set(img, { transformPerspective: 900, transformStyle: "preserve-3d" });
      const quickRotateY = gsap.quickTo(img, "rotationY", { duration: 0.6, ease: "power3" });
      const quickRotateX = gsap.quickTo(img, "rotationX", { duration: 0.6, ease: "power3" });

      const handleMove = (event: PointerEvent) => {
        const bounds = stage.getBoundingClientRect();
        const px = (event.clientX - bounds.left) / bounds.width - 0.5;
        const py = (event.clientY - bounds.top) / bounds.height - 0.5;
        quickRotateY(px * 16);
        quickRotateX(py * -12);
      };
      const handleLeave = () => {
        quickRotateY(0);
        quickRotateX(0);
      };

      stage.addEventListener("pointermove", handleMove);
      stage.addEventListener("pointerleave", handleLeave);
      cleanupTilt = () => {
        stage.removeEventListener("pointermove", handleMove);
        stage.removeEventListener("pointerleave", handleLeave);
      };
    }

    return () => {
      cleanupTilt?.();
      ctx.revert();
    };
  }, [reduced, interactive]);

  return (
    <div ref={stageRef} className={`product-stage ${className}`}>
      <span ref={auraRef} aria-hidden="true" className="product-aura" />
      <img
        ref={imgRef}
        src={bottleImage}
        alt={`${product.name} alcohol-free fragrance bottle for kids`}
        width={1024}
        height={1280}
        loading={eager ? "eager" : "lazy"}
        fetchPriority={eager ? "high" : "auto"}
        className="relative z-10 h-full w-full object-contain drop-shadow-product will-change-transform"
      />
      <span aria-hidden="true" className="product-shadow" />
    </div>
  );
}

function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const links = [
    { label: "Shop", href: "#top" },
    { label: "Our Story", href: "#story" },
    { label: "FAQ", href: "#faq" },
  ];
  return (
    <header className="sticky inset-x-0 top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
      <nav
        aria-label="Main navigation"
        className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 lg:px-10"
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
        <a
          href="#top"
          aria-label={`${product.brand} home`}
          className="flex items-center gap-1.5 font-display text-xl font-extrabold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Star className="size-5 fill-primary text-primary" />
          {product.brand}
        </a>
        <div className="hidden items-center gap-8 text-sm font-bold md:flex">
          {links.map((link) => (
            <a key={link.label} className="nav-link" href={link.href}>
              {link.label}
            </a>
          ))}
        </div>
        <div className="flex items-center gap-4">
          <button
            type="button"
            aria-label="Search"
            className="hidden text-foreground/80 hover:text-foreground sm:block"
          >
            <Search className="size-5" />
          </button>
          <button
            type="button"
            aria-label="View cart"
            onClick={scrollToPurchase}
            className="relative text-foreground/80 hover:text-foreground"
          >
            <ShoppingBag className="size-5" />
          </button>
        </div>
      </nav>
      {menuOpen && (
        <div className="border-t border-border bg-background px-5 py-4 md:hidden">
          <ul className="flex flex-col gap-4 text-sm font-bold">
            {links.map((link) => (
              <li key={link.label}>
                <a href={link.href} className="nav-link" onClick={() => setMenuOpen(false)}>
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </header>
  );
}

function HeroSection() {
  const [activeVariant, setActiveVariant] = useState<(typeof product.variants)[number]>(
    product.variants[0],
  );
  const [notice, setNotice] = useState(false);
  const addToCart = () => {
    setNotice(true);
    window.setTimeout(() => setNotice(false), 3500);
  };

  return (
    <section id="top" className="bg-background">
      <div className="mx-auto grid max-w-7xl items-center gap-10 px-5 py-10 lg:grid-cols-2 lg:gap-14 lg:px-10 lg:py-16">
        <Reveal>
          <PhotoPlaceholder
            label="Lifestyle photo — child using product"
            aspect="aspect-[4/5]"
            className="mx-auto max-w-xl"
          />
        </Reveal>
        <Reveal className="lg:pl-4">
          <div className="mb-6 flex items-center gap-2 text-accent">
            <Cloud className="size-6" aria-hidden="true" />
            <Sparkles className="size-5" aria-hidden="true" />
          </div>
          <h1 className="font-display text-4xl font-extrabold leading-tight text-foreground sm:text-5xl">
            {product.tagline}
          </h1>
          <p className="mt-5 text-lg font-bold text-foreground">{product.name}</p>
          <p className="text-sm font-semibold text-muted-foreground">{product.category}</p>
          <span className="badge-pill mt-4">
            {activeVariant.icon} {activeVariant.badge}
          </span>
          <p className="mt-6 font-display text-3xl font-extrabold text-foreground">
            {product.price}
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            {product.variants.map((variant) => (
              <button
                key={variant.id}
                type="button"
                className="variant-swatch"
                data-active={activeVariant.id === variant.id}
                onClick={() => setActiveVariant(variant)}
              >
                <span aria-hidden="true">{variant.icon}</span>
                {variant.name}
              </button>
            ))}
          </div>
          <Button size="lg" className="mt-7 w-full sm:w-auto" onClick={addToCart}>
            {product.addToCartLabel}
          </Button>
          {notice && (
            <p
              role="status"
              className="mt-3 max-w-sm rounded-lg bg-secondary p-3 text-xs text-secondary-foreground"
            >
              Demo only — connect product, cart, checkout and inventory services before launch.
            </p>
          )}
        </Reveal>
      </div>
    </section>
  );
}

function TrustStrip() {
  return (
    <section className="border-y border-border bg-secondary/40">
      <div className="mx-auto max-w-7xl px-5 py-8 lg:px-10">
        <div className="grid grid-cols-3 gap-4 sm:grid-cols-6">
          {product.trustPoints.map((point) => {
            const Icon = trustIcons[point.icon] ?? Sparkles;
            return (
              <div key={point.label} className="trust-strip-item">
                <span className="trust-strip-icon shadow-soft">
                  <Icon className="size-5" strokeWidth={1.75} />
                </span>
                <p className="text-[11px] font-bold leading-tight text-foreground/85 sm:text-xs">
                  {point.label}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function WhatIsIt() {
  return (
    <section id="what-is-it" className="section-space bg-background">
      <div className="mx-auto grid max-w-7xl items-center gap-12 px-5 lg:grid-cols-2 lg:px-10">
        <Reveal className="order-2 lg:order-1">
          <ProductBottle interactive className="mx-auto h-[420px] max-w-sm cursor-grab" />
        </Reveal>
        <Reveal className="order-1 lg:order-2">
          <p className="eyebrow">{product.whatIsIt.eyebrow}</p>
          <h2 className="section-title">{product.whatIsIt.title}</h2>
          <p className="section-copy">{product.whatIsIt.text}</p>
          <a
            href="#faq"
            className="mt-6 inline-flex items-center gap-1.5 text-sm font-extrabold text-foreground hover:text-primary"
          >
            {product.whatIsIt.linkLabel} <ArrowRight className="size-4" />
          </a>
        </Reveal>
      </div>
    </section>
  );
}

function DailyMoments() {
  return (
    <section className="section-space bg-cream">
      <div className="mx-auto max-w-7xl px-5 lg:px-10">
        <Reveal className="text-center">
          <h2 className="section-title">{product.dailyMoments.title}</h2>
        </Reveal>
        <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {product.dailyMoments.items.map((item, index) => {
            const Icon = momentIcons[item.icon] ?? Sparkles;
            return (
              <Reveal key={item.title}>
                <div className="text-center">
                  <span
                    className="moment-icon mx-auto size-16"
                    style={{ background: momentTints[index % momentTints.length] }}
                  >
                    <Icon className="size-7 text-foreground" strokeWidth={1.75} />
                  </span>
                  <h3 className="mt-4 font-display text-lg font-bold">{item.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{item.text}</p>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function MomentBanner() {
  return (
    <section className="section-space bg-background">
      <div className="mx-auto max-w-7xl px-5 lg:px-10">
        <Reveal>
          <div className="grid items-center gap-8 overflow-hidden rounded-3xl bg-secondary/50 lg:grid-cols-2">
            <PhotoPlaceholder
              label="Mood photo — the Moonmist moment"
              aspect="aspect-[16/10]"
              className="lg:h-full"
            />
            <div className="px-6 py-8 text-center lg:px-10 lg:text-left">
              <h2 className="section-title">{product.moment.title}</h2>
              <p className="section-copy lg:mx-0">{product.moment.text}</p>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function FounderStory() {
  return (
    <section id="story" className="section-space bg-cream">
      <div className="mx-auto max-w-7xl px-5 lg:px-10">
        <Reveal>
          <div className="founder-panel grid items-center gap-10 lg:grid-cols-[.85fr_1.15fr]">
            <PhotoPlaceholder
              label="Founder & child photo"
              aspect="aspect-[4/5]"
              className="mx-auto max-w-sm"
            />
            <div>
              <p className="eyebrow">{product.founder.eyebrow}</p>
              <h2 className="section-title">{product.founder.title}</h2>
              <p className="section-copy">{product.founder.text}</p>
              <p className="mt-6 font-display text-lg font-bold text-foreground">
                {product.founder.name}
              </p>
              <p className="text-sm font-semibold text-muted-foreground">{product.founder.role}</p>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function Testimonials() {
  const reduced = useReducedMotion();
  const [index, setIndex] = useState(0);
  const items = product.testimonials;
  const go = (delta: number) =>
    setIndex((current) => (current + delta + items.length) % items.length);

  return (
    <section className="section-space bg-background">
      <div className="mx-auto max-w-6xl px-5 lg:px-10">
        <Reveal className="text-center">
          <h2 className="section-title">Loved by little ones. Trusted by their grown-ups.</h2>
        </Reveal>
        <div className="mt-12 flex items-center gap-4">
          <Button
            variant="icon"
            size="icon"
            aria-label="Previous review"
            onClick={() => go(-1)}
            className="hidden shrink-0 sm:flex"
          >
            <ChevronLeft className="size-5" />
          </Button>
          <div className="grid flex-1 gap-5 md:grid-cols-3">
            {[0, 1, 2].map((offset) => {
              const item = items[(index + offset) % items.length];
              if (!item) return null;
              return (
                <motion.figure
                  key={offset}
                  className="testimonial-card"
                  initial={false}
                  animate={reduced ? {} : { opacity: 1 }}
                >
                  <Quote className="size-5 text-primary" />
                  <div aria-label="Editable five star rating" className="mt-4 flex gap-1 text-gold">
                    {Array.from({ length: 5 }, (_, i) => (
                      <Star key={i} className="size-4 fill-current" />
                    ))}
                  </div>
                  <blockquote className="mt-4 text-sm leading-6 text-foreground">
                    “{item.quote}”
                  </blockquote>
                  <figcaption className="mt-5 text-xs font-bold text-muted-foreground">
                    {item.name} · {item.location}
                  </figcaption>
                </motion.figure>
              );
            })}
          </div>
          <Button
            variant="icon"
            size="icon"
            aria-label="Next review"
            onClick={() => go(1)}
            className="hidden shrink-0 sm:flex"
          >
            <ChevronRight className="size-5" />
          </Button>
        </div>
        <div className="mt-8 flex items-center justify-center gap-4 sm:hidden">
          <Button variant="icon" size="icon" aria-label="Previous review" onClick={() => go(-1)}>
            <ChevronLeft className="size-5" />
          </Button>
          <Button variant="icon" size="icon" aria-label="Next review" onClick={() => go(1)}>
            <ChevronRight className="size-5" />
          </Button>
        </div>
        <div className="mt-6 flex justify-center gap-2">
          {items.map((item, i) => (
            <span key={item.name + i} className="carousel-dot" data-active={i === index} />
          ))}
        </div>
        <p className="mt-6 text-center text-xs text-muted-foreground">
          Sample layout only. Replace with verified customer reviews before publishing.
        </p>
      </div>
    </section>
  );
}

function FaqColumn({
  items,
  openId,
  onToggle,
  idPrefix,
}: {
  items: readonly { q: string; a: string }[];
  openId: string | null;
  onToggle: (id: string) => void;
  idPrefix: string;
}) {
  return (
    <div className="divide-y divide-border border-y border-border">
      {items.map((item, index) => {
        const id = `${idPrefix}-${index}`;
        const isOpen = openId === id;
        return (
          <div key={id}>
            <button
              type="button"
              className="flex w-full items-center justify-between gap-4 py-5 text-left text-sm font-bold text-foreground"
              aria-expanded={isOpen}
              aria-controls={id}
              onClick={() => onToggle(id)}
            >
              {item.q}
              <Plus
                className={`size-5 shrink-0 text-primary transition-transform ${isOpen ? "rotate-45" : ""}`}
              />
            </button>
            <motion.div
              id={id}
              role="region"
              initial={false}
              animate={{ height: isOpen ? "auto" : 0, opacity: isOpen ? 1 : 0 }}
              className="overflow-hidden"
            >
              <p className="pb-5 pr-8 text-sm leading-6 text-muted-foreground">{item.a}</p>
            </motion.div>
          </div>
        );
      })}
    </div>
  );
}

function FAQ() {
  const [openId, setOpenId] = useState<string | null>("left-0");
  const half = Math.ceil(product.faqs.length / 2);
  const left = useMemo(() => product.faqs.slice(0, half), [half]);
  const right = useMemo(() => product.faqs.slice(half), [half]);
  const toggle = (id: string) => setOpenId((current) => (current === id ? null : id));

  return (
    <section id="faq" className="section-space bg-cream">
      <div className="mx-auto max-w-5xl px-5 lg:px-10">
        <Reveal className="text-center">
          <h2 className="section-title">Frequently Asked Questions</h2>
        </Reveal>
        <div className="mt-10 grid gap-x-12 md:grid-cols-2">
          <FaqColumn items={left} openId={openId} onToggle={toggle} idPrefix="left" />
          <FaqColumn items={right} openId={openId} onToggle={toggle} idPrefix="right" />
        </div>
      </div>
    </section>
  );
}

function FloatingCTA() {
  const [visible, setVisible] = useState(false);
  useLayoutEffect(() => {
    const onScroll = () => setVisible(window.scrollY > window.innerHeight * 0.6);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return (
    <motion.aside
      aria-label="Quick purchase"
      initial={false}
      animate={{ y: visible ? 0 : 100, opacity: visible ? 1 : 0 }}
      className="fixed inset-x-3 bottom-3 z-50 mx-auto flex max-w-xl items-center justify-between rounded-full border border-border bg-background/95 p-2 pl-5 shadow-float backdrop-blur-xl md:bottom-5"
    >
      <div>
        <p className="font-display text-sm font-bold">{product.name}</p>
        <p className="text-xs text-muted-foreground">
          {product.price} · {product.size}
        </p>
      </div>
      <Button size="sm" onClick={scrollToPurchase}>
        {product.buyNowLabel}
      </Button>
    </motion.aside>
  );
}

function Footer() {
  const shopLinks = [
    { label: "Home", href: "#top" },
    { label: "Our Story", href: "#story" },
    { label: "The Product", href: "#top" },
    { label: "FAQ", href: "#faq" },
    { label: "Contact", href: "mailto:hello@example.com" },
  ];
  const legalLinks = [
    "Privacy Policy",
    "Terms & Conditions",
    "Shipping Policy",
    "Returns & Cancellation",
  ];
  const socials = [
    { icon: Instagram, label: "Instagram" },
    { icon: MessageCircle, label: "WhatsApp" },
    { icon: Mail, label: "Email" },
  ];
  return (
    <footer className="bg-footer py-14 text-footer-foreground">
      <div className="mx-auto max-w-7xl px-5 lg:px-10">
        <div className="grid gap-10 lg:grid-cols-[1.2fr_.8fr_1fr]">
          <div>
            <p className="flex items-center gap-1.5 font-display text-2xl font-extrabold">
              <Star className="size-5 fill-gold text-gold" />
              {product.brand}
            </p>
            <p className="mt-4 max-w-xs text-sm leading-6 text-footer-muted">
              Little things made for little people.
            </p>
            <div className="mt-6 flex gap-3">
              {socials.map(({ icon: Icon, label }) => (
                <a
                  key={label}
                  href="#social-placeholder"
                  aria-label={label}
                  className="flex size-9 items-center justify-center rounded-full border border-footer-border text-footer-muted hover:text-footer-foreground"
                >
                  <Icon className="size-4" />
                </a>
              ))}
            </div>
          </div>
          <div className="space-y-3 text-sm">
            {shopLinks.map((link) => (
              <a key={link.label} href={link.href}>
                {link.label}
              </a>
            ))}
          </div>
          <div className="space-y-3 text-sm text-footer-muted">
            {legalLinks.map((label) => (
              <a key={label} href="#policy-placeholder">
                {label}
              </a>
            ))}
          </div>
        </div>
        <div className="mt-12 flex flex-col justify-between gap-4 border-t border-footer-border pt-6 text-xs text-footer-muted sm:flex-row">
          <p>© 2026 {product.brand}. Placeholder brand details.</p>
          <p id="policy-placeholder">
            Policies, business address and social links must be added before launch.
          </p>
        </div>
      </div>
    </footer>
  );
}

export function LandingPage() {
  return (
    <main>
      <Navbar />
      <HeroSection />
      <TrustStrip />
      <WhatIsIt />
      <DailyMoments />
      <MomentBanner />
      <FounderStory />
      <Testimonials />
      <FAQ />
      <Footer />
      <FloatingCTA />
    </main>
  );
}
