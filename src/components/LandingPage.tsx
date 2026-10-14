import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowRight,
  Ban,
  Check,
  ChevronLeft,
  ChevronRight,
  Cloud,
  Droplet,
  Gift,
  HeartHandshake,
  Instagram,
  Leaf,
  MapPin,
  Plane,
  Plus,
  Quote,
  ShieldCheck,
  Sparkles,
  Star,
  Sun,
  Truck,
  Users,
} from "lucide-react";
import boxFront from "@/assets/brand/box-front.jpg";
import hamperBox from "@/assets/brand/hamper-box.jpg";
import logoVertical from "@/assets/brand/logo-vertical.png";
import stickerBear from "@/assets/brand/st-bear.png";
import stickerBunny from "@/assets/brand/st-bunny.png";
import stickerCloud from "@/assets/brand/st-cloud.png";
import stickerCoconut from "@/assets/brand/st-coconut.png";
import stickerCupcake from "@/assets/brand/st-cupcake.png";
import stickerMoon from "@/assets/brand/st-moon.png";
import stickerRainbow from "@/assets/brand/st-rainbow.png";
import stickerSun from "@/assets/brand/st-sun.png";
import stickerVanilla from "@/assets/brand/st-vanilla-cake.png";
import { product, type Variant } from "@/data/product";
import { site, whatsappLink } from "@/data/site";
import { Button } from "@/components/ui/button";
import { QuantityStepper } from "@/components/site/QuantityStepper";
import { useCart } from "@/lib/cart";
import { formatINR } from "@/lib/pricing";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

function scrollToShop() {
  document.querySelector("#shop")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

const trustIcons: Record<string, typeof Droplet> = {
  coconut: Leaf,
  vitamin: Droplet,
  alcoholFree: Ban,
  gentle: HeartHandshake,
  vegan: Sparkles,
  love: Cloud,
};

const momentIcons: Record<string, typeof Plane> = {
  morning: Sun,
  travel: Plane,
  playdates: Users,
  goingOut: MapPin,
};

const momentTints = [
  "color-mix(in oklab, var(--primary) 55%, var(--background))",
  "var(--sky)",
  "color-mix(in oklab, var(--sage) 45%, var(--background))",
  "color-mix(in oklab, var(--coral) 30%, var(--background))",
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

function Sticker({ src, className = "" }: { src: string; className?: string }) {
  return (
    <img
      src={src}
      alt=""
      aria-hidden="true"
      loading="lazy"
      className={`pointer-events-none absolute select-none ${className}`}
    />
  );
}

function ProductStage() {
  const reduced = useReducedMotion();
  const stageRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  useLayoutEffect(() => {
    const stage = stageRef.current;
    const img = imgRef.current;
    if (!stage || !img || reduced) return;

    const ctx = gsap.context(() => {
      gsap.fromTo(
        img,
        { scale: 0.9, y: 30, rotate: -4 },
        { scale: 1, y: 0, rotate: -2, duration: 1.1, ease: "back.out(1.5)" },
      );
      gsap.to(img, { y: -10, duration: 3, ease: "sine.inOut", repeat: -1, yoyo: true, delay: 1.1 });
    }, stage);

    gsap.set(img, { transformPerspective: 900 });
    const rotateY = gsap.quickTo(img, "rotationY", { duration: 0.6, ease: "power3" });
    const rotateX = gsap.quickTo(img, "rotationX", { duration: 0.6, ease: "power3" });
    const handleMove = (event: PointerEvent) => {
      const bounds = stage.getBoundingClientRect();
      rotateY(((event.clientX - bounds.left) / bounds.width - 0.5) * 14);
      rotateX(((event.clientY - bounds.top) / bounds.height - 0.5) * -10);
    };
    const handleLeave = () => {
      rotateY(0);
      rotateX(0);
    };
    stage.addEventListener("pointermove", handleMove);
    stage.addEventListener("pointerleave", handleLeave);

    return () => {
      stage.removeEventListener("pointermove", handleMove);
      stage.removeEventListener("pointerleave", handleLeave);
      ctx.revert();
    };
  }, [reduced]);

  return (
    <div
      ref={stageRef}
      className="relative mx-auto flex aspect-[4/5] w-full max-w-xl items-center justify-center overflow-hidden rounded-[2.5rem] bg-cream"
    >
      <span
        aria-hidden="true"
        className="absolute inset-x-10 top-16 bottom-16 rounded-full bg-sky/40 blur-3xl"
      />
      <Sticker src={stickerCloud} className="float-slow left-[6%] top-[7%] w-[22%]" />
      <Sticker
        src={stickerSun}
        className="float-slow right-[6%] top-[5%] w-[18%] [animation-delay:-2s]"
      />
      <Sticker
        src={stickerRainbow}
        className="float-slow bottom-[6%] left-[5%] w-[20%] [animation-delay:-3s]"
      />
      <Sticker
        src={stickerCupcake}
        className="float-slow bottom-[7%] right-[7%] w-[15%] [animation-delay:-1s]"
      />
      <img
        ref={imgRef}
        src={boxFront}
        alt={`${product.name} box — ${product.category} by ${product.brand}`}
        width={443}
        height={668}
        fetchPriority="high"
        className="relative z-10 w-[58%] rounded-2xl shadow-float will-change-transform"
      />
    </div>
  );
}

function HeroSection() {
  const { addItem, setOpen } = useCart();
  const navigate = useNavigate();
  const [activeVariant, setActiveVariant] = useState<Variant>(product.variants[0]);
  const [quantity, setQuantity] = useState(1);
  const { minQuantity, percent } = product.multiUnitDiscount;
  const lineTotal = quantity * product.price;
  const discounted =
    quantity >= minQuantity ? Math.round(lineTotal * (1 - percent / 100)) : lineTotal;

  const addToCart = () => {
    if (!activeVariant.inStock) return;
    addItem(activeVariant.id, quantity);
    setOpen(true);
  };

  const buyNow = () => {
    if (!activeVariant.inStock) return;
    addItem(activeVariant.id, quantity);
    navigate({ to: "/checkout" });
  };

  return (
    <section id="shop" className="bg-background">
      <div className="mx-auto grid max-w-7xl items-center gap-10 px-5 py-10 lg:grid-cols-2 lg:gap-14 lg:px-10 lg:py-16">
        <Reveal>
          <ProductStage />
        </Reveal>
        <Reveal className="lg:pl-4">
          <p className="eyebrow">
            <Star className="size-4 fill-current" aria-hidden="true" /> {product.brand}
          </p>
          <h1 className="mt-3 font-display text-4xl font-extrabold leading-tight text-foreground sm:text-5xl">
            {product.tagline}
          </h1>
          <p className="mt-5 font-display text-2xl font-extrabold text-foreground">
            {product.name}
          </p>
          <p className="text-sm font-semibold text-muted-foreground">
            {product.category} · {product.size} · Ages {product.ageRange}
          </p>
          <span className="badge-pill mt-4">
            {activeVariant.icon} {activeVariant.scent}
          </span>

          <div className="mt-6 flex items-baseline gap-3">
            <p className="font-display text-3xl font-extrabold text-foreground">
              {formatINR(product.price)}
            </p>
            <p className="text-xs font-semibold text-muted-foreground">incl. of all taxes</p>
          </div>

          <fieldset className="mt-6">
            <legend className="mb-3 text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
              Choose a scent
            </legend>
            <div className="flex flex-wrap gap-3">
              {product.variants.map((variant) => (
                <button
                  key={variant.id}
                  type="button"
                  className="variant-swatch relative"
                  data-active={activeVariant.id === variant.id}
                  aria-pressed={activeVariant.id === variant.id}
                  onClick={() => setActiveVariant(variant)}
                >
                  <img src={variant.badgeImage} alt="" className="size-7 object-contain" />
                  <span className={variant.inStock ? "" : "text-muted-foreground line-through"}>
                    {variant.name}
                  </span>
                  {!variant.inStock && (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-extrabold uppercase text-muted-foreground">
                      Sold out
                    </span>
                  )}
                </button>
              ))}
            </div>
            <p className="mt-3 text-sm text-muted-foreground">{activeVariant.description}</p>
          </fieldset>

          {activeVariant.inStock ? (
            <>
              <div className="mt-6 flex flex-wrap items-center gap-4">
                <QuantityStepper value={quantity} onChange={setQuantity} />
                <p className="text-sm font-bold text-foreground">
                  {quantity >= minQuantity ? (
                    <>
                      <span className="mr-2 text-muted-foreground line-through">
                        {formatINR(lineTotal)}
                      </span>
                      {formatINR(discounted)} <span className="text-accent">({percent}% off)</span>
                    </>
                  ) : (
                    <span className="text-muted-foreground">
                      Buy {minQuantity}+ bottles & save {percent}%
                    </span>
                  )}
                </p>
              </div>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <Button size="lg" className="sm:min-w-52" onClick={addToCart}>
                  {product.addToCartLabel}
                </Button>
                <Button
                  size="lg"
                  variant="secondary"
                  className="border-foreground/20 sm:min-w-44"
                  onClick={buyNow}
                >
                  {product.buyNowLabel}
                </Button>
              </div>
            </>
          ) : (
            <div className="mt-6 rounded-2xl bg-cream p-5">
              <p className="font-display font-extrabold">
                {activeVariant.name} is sold out for now 🥺
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                We're mixing up a fresh batch. Message us and we'll let you know as soon as it's
                back.
              </p>
              <Button asChild variant="secondary" size="sm" className="mt-4 border-foreground/20">
                <a
                  href={whatsappLink(
                    `Hi! Please let me know when ${product.name} – ${activeVariant.name} is back in stock.`,
                  )}
                  target="_blank"
                  rel="noreferrer"
                >
                  Notify me on WhatsApp
                </a>
              </Button>
            </div>
          )}

          <ul className="mt-7 grid gap-2 text-sm font-semibold text-foreground/85 sm:grid-cols-2">
            <li className="flex items-center gap-2">
              <Truck className="size-4 text-accent" />
              {site.shipping.fee === 0 ? "Free shipping across India" : "Ships across India"}
            </li>
            <li className="flex items-center gap-2">
              <ShieldCheck className="size-4 text-accent" /> Secure checkout with Razorpay
            </li>
            <li className="flex items-center gap-2">
              <Ban className="size-4 text-accent" /> 100% alcohol-free
            </li>
            <li className="flex items-center gap-2">
              <HeartHandshake className="size-4 text-accent" /> Mom-approved
            </li>
          </ul>
        </Reveal>
      </div>
    </section>
  );
}

function TrustStrip() {
  return (
    <section aria-label="Why parents love it" className="border-y border-border bg-secondary/60">
      <div className="mx-auto max-w-7xl px-5 py-8 lg:px-10">
        <div className="grid grid-cols-3 gap-4 sm:grid-cols-6">
          {product.trustPoints.map((point) => {
            const Icon = trustIcons[point.icon] ?? Sparkles;
            return (
              <div key={point.label} className="trust-strip-item">
                <span className="trust-strip-icon shadow-soft">
                  <Icon className="size-5 text-accent" strokeWidth={1.75} />
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
          <div className="relative mx-auto aspect-[16/12] max-w-xl overflow-hidden rounded-[2.5rem] bg-sky/50">
            <Sticker
              src={stickerCloud}
              className="float-slow left-1/2 top-[14%] w-[46%] -translate-x-1/2"
            />
            <Sticker
              src={stickerCoconut}
              className="float-slow bottom-[10%] left-[12%] w-[22%] [animation-delay:-2s]"
            />
            <Sticker
              src={stickerMoon}
              className="float-slow right-[10%] top-[10%] w-[14%] [animation-delay:-4s]"
            />
            <div className="absolute inset-x-6 bottom-6 flex flex-wrap justify-end gap-2">
              {["Fractionated coconut oil", "Vitamin E", "No alcohol"].map((chip) => (
                <span key={chip} className="badge-pill bg-background/90">
                  <Check className="size-3.5 text-accent" /> {chip}
                </span>
              ))}
            </div>
          </div>
        </Reveal>
        <Reveal className="order-1 lg:order-2">
          <p className="eyebrow">{product.whatIsIt.eyebrow}</p>
          <h2 className="section-title">{product.whatIsIt.title}</h2>
          <p className="section-copy">{product.whatIsIt.text}</p>
          <div id="how-to-use" className="mt-8 rounded-3xl border border-border bg-cream/60 p-6">
            <p className="font-display text-lg font-extrabold">{product.whatIsIt.linkLabel}</p>
            <ol className="mt-3 space-y-2">
              {product.howToUse.map((step, index) => (
                <li key={step} className="flex gap-3 text-sm text-foreground/85">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-extrabold text-primary-foreground">
                    {index + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
            <p className="mt-4 text-xs text-muted-foreground">
              Do a patch test before first use. For external use only. Avoid eyes and broken skin.
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function DailyMoments() {
  return (
    <section className="section-space relative overflow-hidden bg-cream">
      <Sticker
        src={stickerBunny}
        className="float-slow -left-4 top-10 hidden w-24 opacity-80 lg:block"
      />
      <Sticker
        src={stickerBear}
        className="float-slow -right-2 bottom-10 hidden w-28 opacity-80 [animation-delay:-3s] lg:block"
      />
      <div className="mx-auto max-w-7xl px-5 lg:px-10">
        <Reveal className="text-center">
          <h2 className="section-title">{product.dailyMoments.title}</h2>
        </Reveal>
        <div className="mt-12 grid grid-cols-2 gap-8 lg:grid-cols-4">
          {product.dailyMoments.items.map((item, index) => {
            const Icon = momentIcons[item.icon] ?? Sparkles;
            return (
              <Reveal key={item.title}>
                <div className="text-center">
                  <span
                    className="moment-icon mx-auto size-20"
                    style={{ background: momentTints[index % momentTints.length] }}
                  >
                    <Icon className="size-8 text-foreground" strokeWidth={1.6} />
                  </span>
                  <h3 className="mt-4 font-display text-lg font-extrabold">{item.title}</h3>
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
          <div className="grid items-center overflow-hidden rounded-[2.5rem] bg-[color-mix(in_oklab,var(--coral)_18%,var(--background))] lg:grid-cols-2">
            <div className="relative aspect-[16/10] w-full">
              <Sticker
                src={stickerVanilla}
                className="float-slow left-1/2 top-1/2 w-[42%] -translate-x-1/2 -translate-y-1/2"
              />
              <Sticker
                src={stickerCupcake}
                className="float-slow bottom-[8%] left-[10%] w-[16%] [animation-delay:-2s]"
              />
              <Sticker
                src={stickerSun}
                className="float-slow right-[10%] top-[8%] w-[16%] [animation-delay:-4s]"
              />
            </div>
            <div className="px-6 pb-10 text-center lg:px-12 lg:py-10 lg:text-left">
              <p className="eyebrow justify-center lg:justify-start">{product.moment.eyebrow}</p>
              <h2 className="section-title">{product.moment.title}</h2>
              <p className="section-copy mx-auto lg:mx-0">{product.moment.text}</p>
              <Button size="lg" className="mt-7" onClick={scrollToShop}>
                {product.cta}
              </Button>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function FounderStory() {
  const { founder } = product;
  return (
    <section id="story" className="section-space bg-cream">
      <div className="mx-auto max-w-7xl px-5 lg:px-10">
        <Reveal>
          <div className="founder-panel grid items-center gap-10 bg-sky/45 lg:grid-cols-[.85fr_1.15fr]">
            {founder.photo ? (
              <img
                src={founder.photo}
                alt={`${founder.name}, ${founder.role}`}
                loading="lazy"
                className="mx-auto aspect-[4/5] w-full max-w-sm rounded-[2rem] object-cover"
              />
            ) : (
              <div className="relative mx-auto flex aspect-[4/5] w-full max-w-sm items-center justify-center rounded-[2rem] bg-background">
                <img src={logoVertical} alt="" className="w-1/2" loading="lazy" />
                <Sticker
                  src={stickerRainbow}
                  className="float-slow bottom-[6%] left-[8%] w-[24%]"
                />
                <Sticker
                  src={stickerBear}
                  className="float-slow right-[8%] top-[6%] w-[22%] [animation-delay:-3s]"
                />
              </div>
            )}
            <div>
              <p className="eyebrow">{founder.eyebrow}</p>
              <h2 className="section-title">{founder.title}</h2>
              <p className="section-copy max-w-xl">{founder.text}</p>
              <p className="mt-6 font-display text-lg font-extrabold text-foreground">
                Meet {founder.name}
              </p>
              <p className="text-sm font-semibold text-muted-foreground">{founder.role}</p>
              <a
                href={`https://www.instagram.com/${founder.handle.slice(1)}`}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-flex items-center gap-1.5 text-sm font-extrabold text-accent hover:underline"
              >
                <Instagram className="size-4" /> {founder.handle}
              </a>
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
  if (items.length === 0) return null;
  const visible = Math.min(3, items.length);
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
            {Array.from({ length: visible }, (_, offset) => {
              const item = items[(index + offset) % items.length];
              if (!item) return null;
              return (
                <motion.figure
                  key={offset}
                  className="testimonial-card"
                  initial={false}
                  animate={reduced ? {} : { opacity: 1 }}
                >
                  <Quote className="size-5 text-accent" />
                  <div aria-label="Five star rating" className="mt-4 flex gap-1 text-gold">
                    {Array.from({ length: 5 }, (_, i) => (
                      <Star key={i} className="size-4 fill-current" />
                    ))}
                  </div>
                  <blockquote className="mt-4 text-sm leading-6 text-foreground">
                    “{item.quote}”
                  </blockquote>
                  <figcaption className="mt-5 text-xs font-bold text-muted-foreground">
                    — {item.name}, {item.location}
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
      </div>
    </section>
  );
}

function ClubPromise() {
  return (
    <section className="bg-[color-mix(in_oklab,var(--sage)_80%,var(--foreground))] py-14 text-background">
      <div className="mx-auto flex max-w-5xl flex-col items-center px-5 text-center lg:px-10">
        <Reveal>
          <h2 className="font-display text-3xl font-extrabold sm:text-4xl">
            {product.promise.title}
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-7 opacity-90">
            {product.promise.text}
          </p>
          <ul className="mt-8 flex flex-wrap justify-center gap-3">
            {product.promise.pillars.map((pillar) => (
              <li
                key={pillar}
                className="rounded-full border border-background/40 px-4 py-2 text-xs font-extrabold uppercase tracking-wider"
              >
                {pillar} ♥
              </li>
            ))}
          </ul>
        </Reveal>
      </div>
    </section>
  );
}

function PrBox() {
  const { prBox } = product;
  return (
    <section id="pr-box" className="section-space bg-background">
      <div className="mx-auto grid max-w-7xl items-center gap-10 px-5 lg:grid-cols-2 lg:px-10">
        <Reveal>
          <div className="relative">
            <img
              src={hamperBox}
              alt="The Little Todds Club welcome box with Cloud Mist, a drawstring pouch, stickers and a star keychain"
              width={1254}
              height={1254}
              loading="lazy"
              className="mx-auto w-full max-w-lg rounded-[2.5rem] shadow-float"
            />
            <span className="absolute left-4 top-4 rounded-full bg-accent px-4 py-1.5 text-xs font-extrabold uppercase tracking-wider text-accent-foreground shadow-soft">
              {prBox.eyebrow}
            </span>
          </div>
        </Reveal>
        <Reveal>
          <p className="eyebrow">
            <Gift className="size-4" /> {prBox.eyebrow}
          </p>
          <h2 className="section-title">{prBox.title}</h2>
          <p className="section-copy">{prBox.text}</p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <Button size="lg" disabled aria-disabled="true" className="sm:min-w-52">
              CLAIM PR BOX · SOON
            </Button>
            <Button asChild size="lg" variant="secondary" className="border-foreground/20">
              <a
                href={whatsappLink(
                  "Hi Little Todds Club! I'd love to be on the list for a PR box. My Instagram handle is: ",
                )}
                target="_blank"
                rel="noreferrer"
              >
                Join the waitlist <ArrowRight className="size-4" />
              </a>
            </Button>
          </div>
        </Reveal>
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
                className={`size-5 shrink-0 text-accent transition-transform ${isOpen ? "rotate-45" : ""}`}
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
        <p className="mt-10 text-center text-sm text-muted-foreground">
          Still have a question?{" "}
          <Link to="/contact" className="font-extrabold text-accent hover:underline">
            Get in touch
          </Link>{" "}
          — we usually reply within a day.
        </p>
      </div>
    </section>
  );
}

function FloatingCTA() {
  const { addItem, setOpen } = useCart();
  const [visible, setVisible] = useState(false);
  const firstInStock = product.variants.find((variant) => variant.inStock);

  useLayoutEffect(() => {
    const onScroll = () => setVisible(window.scrollY > window.innerHeight * 0.9);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!firstInStock) return null;

  return (
    <motion.aside
      aria-label="Quick purchase"
      initial={false}
      animate={{ y: visible ? 0 : 120, opacity: visible ? 1 : 0 }}
      className="fixed inset-x-3 bottom-3 z-30 mx-auto flex max-w-xl items-center justify-between gap-3 rounded-full border border-border bg-background/95 p-2 pl-5 shadow-float backdrop-blur-xl md:bottom-5"
    >
      <div className="min-w-0">
        <p className="truncate font-display text-sm font-extrabold">
          {product.name} · {firstInStock.name}
        </p>
        <p className="text-xs text-muted-foreground">
          {formatINR(product.price)} · {product.size}
        </p>
      </div>
      <Button
        size="sm"
        onClick={() => {
          addItem(firstInStock.id, 1);
          setOpen(true);
        }}
      >
        {product.addToCartLabel}
      </Button>
    </motion.aside>
  );
}

export function LandingPage() {
  return (
    <>
      <HeroSection />
      <TrustStrip />
      <WhatIsIt />
      <DailyMoments />
      <MomentBanner />
      <FounderStory />
      <Testimonials />
      <ClubPromise />
      <PrBox />
      <FAQ />
      <FloatingCTA />
    </>
  );
}
