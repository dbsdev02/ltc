import vanillaBadge from "@/assets/brand/st-vanilla-cake.png";
import fruitPunchBadge from "@/assets/brand/fruit-punch-badge.png";

export const product = {
  id: "cloud-mist",
  brand: "Little Todds Club",
  tagline: "A little mist. A lot of magic.",
  brandLine: "Safe little essentials for curious little humans",
  name: "Cloud Mist",
  category: "Toddler Skin & Hair Mist",
  /** Price per bottle in rupees. */
  price: 750,
  size: "25 ml",
  ageRange: "2 to 9 years",
  description:
    "A gentle, moisturising skin & hair mist made especially for little ones who want to smell as lovely as they feel. Made with fractionated coconut oil, Vitamin E and lots of love — and completely alcohol-free.",
  cta: "SHOP CLOUD MIST",
  addToCartLabel: "ADD TO CART",
  buyNowLabel: "BUY NOW",
  /** Applied to the whole order when the cart holds more than one bottle. */
  multiUnitDiscount: { minQuantity: 2, percent: 10 },
  variants: [
    {
      id: "vanilla-cake",
      name: "Vanilla Cake",
      scent: "Smells like Vanilla Cake",
      description: "Warm, sweet and cosy — like a slice of birthday cake fresh from the oven.",
      icon: "🧁",
      badgeImage: vanillaBadge,
      inStock: true,
    },
    {
      id: "fruit-punch",
      name: "Fruit Punch",
      scent: "Smells like Fruit Punch",
      description: "Bright, juicy and playful — a happy splash of orange, apple and pineapple.",
      icon: "🍹",
      badgeImage: fruitPunchBadge,
      inStock: false,
    },
  ],
  trustPoints: [
    { icon: "coconut", label: "Coconut Oil" },
    { icon: "vitamin", label: "Vitamin E" },
    { icon: "alcoholFree", label: "Alcohol & Toxin Free" },
    { icon: "gentle", label: "Gentle & Moisturising" },
    { icon: "vegan", label: "Vegan & Cruelty Free" },
    { icon: "love", label: "Made with Love" },
  ],
  claims: ["Alcohol-free", "Toxin-free", "Vegan", "Cruelty-free", "Moisturising", "Mom-approved"],
  whatIsIt: {
    eyebrow: "The signature mist",
    title: "What is Cloud Mist?",
    text: "Cloud Mist is a gentle toddler skin & hair mist crafted with nourishing ingredients to keep your little one soft, fresh and happy all day. A light spritz of fractionated coconut oil and Vitamin E — no alcohol, no harsh stuff, just a little cloud of happy.",
    linkLabel: "How to use",
  },
  howToUse: [
    "Shake well before use.",
    "Ask your little one to close their eyes.",
    "Spray lightly on skin or hair from a few inches away.",
    "Use anytime for a fresh, moisturised feel.",
  ],
  dailyMoments: {
    title: "How Cloud Mist fits into their day",
    items: [
      { icon: "morning", title: "Morning Routine", text: "A happy spritz after bath time" },
      { icon: "travel", title: "Travel", text: "25 ml — tiny enough for every bag" },
      { icon: "playdates", title: "Playdates", text: "Fresh for all their little adventures" },
      { icon: "goingOut", title: "Going Out", text: "Their very own grown-up moment" },
    ],
  },
  moment: {
    eyebrow: "Smells like dessert",
    title: "The Vanilla Cake Moment",
    text: "Sweet, soft and simply irresistible. One little spritz and they're wrapped in a cloud of warm vanilla cake — the fragrance that makes getting ready the best part of the day.",
  },
  founder: {
    eyebrow: "Our story",
    title: "It started with a little girl who wanted to smell like her parents.",
    text: "Our daughter wanted to wear perfume too. But no fragrance felt right for her delicate skin — most were full of alcohol and ingredients we couldn't pronounce. So we decided to make it ourselves: a gentle, moisturising mist for her hair and body, made with the purest form of coconut oil and lots of love. Little Todds Club is everything we'd use on our own toddler first.",
    name: "Shraddha Goel",
    role: "Creator Mom & Founder",
    handle: "@aisishraddha",
    /** Set to an imported image once a real founder photo is available. */
    photo: null as string | null,
  },
  promise: {
    title: "Welcome to the club",
    text: "More than a brand, we're a club for modern parents and their little explorers. Let's raise happy, kind and curious little humans together.",
    pillars: ["Thoughtfully crafted", "Loved by our toddler", "Trusted by you"],
  },
  prBox: {
    eyebrow: "Coming soon",
    title: "Claim your Little Todds Club PR box",
    text: "Are you a parent creator? Our welcome box — with Cloud Mist, little surprises and a sticker sheet made for tiny hands — is almost ready. Tell us you'd like one and we'll reach out as soon as boxes open up.",
  },
  /**
   * Only publish genuine reviews that customers have agreed to share.
   * The reviews section stays hidden while this list is empty.
   */
  testimonials: [] as { quote: string; name: string; location: string }[],
  faqs: [
    {
      q: "What is Cloud Mist?",
      a: "Cloud Mist is a gentle, alcohol-free skin & hair mist made for toddlers and little kids. It's made with fractionated coconut oil and Vitamin E, so it lightly moisturises while leaving a soft, sweet fragrance.",
    },
    {
      q: "What age is it suitable for?",
      a: "Cloud Mist is made for little ones aged 2 to 9 years.",
    },
    {
      q: "Does it contain alcohol?",
      a: "No. Cloud Mist is completely alcohol-free and toxin-free. It is also vegan and cruelty-free.",
    },
    {
      q: "Can it be used on hair and body?",
      a: "Yes! Spray lightly on skin or hair from a few inches away. Ask your little one to close their eyes while you spritz, and avoid the face, eyes and any broken or irritated skin.",
    },
    {
      q: "What does it smell like?",
      a: "Vanilla Cake smells warm, sweet and cosy — just like dessert. Fruit Punch (currently sold out) is bright and juicy, with notes of orange, apple and pineapple.",
    },
    {
      q: "What if my child has sensitive skin?",
      a: "Every child is different, so we recommend a patch test before first use: spray a little on the inner arm and wait 24 hours. If you notice any redness or irritation, stop using it. Please check the full ingredient list on the pack and consult your paediatrician if you have any concerns.",
    },
    {
      q: "How should I store it?",
      a: "Store in a cool, dry place away from direct sunlight, with the cap closed. Keep out of reach of children when not in use — it's a grown-up-supervised treat!",
    },
    {
      q: "Do you offer a discount on more than one bottle?",
      a: "Yes — buy 2 or more bottles and get 10% off your whole order. The discount is applied automatically in your cart.",
    },
    {
      q: "How long does shipping take?",
      a: "Orders are dispatched within 1–3 business days and usually arrive within 3–7 business days across India. See our Shipping Policy for details.",
    },
    {
      q: "Can I return the product?",
      a: "As Cloud Mist is a personal care product, we can't accept returns of opened bottles. If your order arrives damaged, leaking or incorrect, write to us within 48 hours of delivery and we'll make it right. See our Returns & Cancellation Policy.",
    },
  ],
} as const;

export type Product = typeof product;

export function getVariant(id: string) {
  return product.variants.find((variant) => variant.id === id);
}

export type Variant = (typeof product.variants)[number];
