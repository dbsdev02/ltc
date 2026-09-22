export const product = {
  brand: "Lumelle",
  tagline: "A little mist. A lot of magic.",
  name: "Moonmist",
  category: "Hair & Body Mist for Kids",
  price: "₹750",
  size: "100 ml",
  description:
    "A gentle, moisturising hair & body mist created especially for little ones who want to smell as lovely as they feel. Made with fractionated coconut oil, Vitamin E and lots of love.",
  ageRecommendation: "Update with the recommended age range on the final product label.",
  cta: "SHOP THE MAGIC",
  addToCartLabel: "ADD TO CART",
  buyNowLabel: "BUY NOW",
  variants: [
    { id: "moonmist", name: "Moonmist", badge: "Smells like Vanilla Cloud", icon: "🌙" },
    { id: "sunbloom", name: "Sunbloom", badge: "Smells like Citrus Punch", icon: "☀️" },
  ],
  trustPoints: [
    { icon: "coconut", label: "Fractionated Coconut Oil" },
    { icon: "vitamin", label: "Vitamin E" },
    { icon: "alcoholFree", label: "Alcohol & Toxins Free" },
    { icon: "gentle", label: "Gentle & Moisturising" },
    { icon: "vegan", label: "Vegan & Cruelty Free" },
    { icon: "love", label: "Made with Love" },
  ],
  whatIsIt: {
    eyebrow: "The signature mist",
    title: "What is Moonmist?",
    text: "A gentle, moisturising hair & body mist created especially for little ones who want to smell as lovely as they feel. Made with fractionated coconut oil, Vitamin E and lots of love.",
    linkLabel: "How to use",
  },
  dailyMoments: {
    title: "How Moonmist fits into their day",
    items: [
      { icon: "hair", title: "Hair", text: "Soft, fresh & manageable" },
      { icon: "body", title: "Body", text: "Keeps them feeling fresh" },
      { icon: "travel", title: "Travel", text: "Easy to carry, perfect for on-the-go" },
      { icon: "playdates", title: "Playdates", text: "For all their little adventures" },
    ],
  },
  moment: {
    title: "The Moonmist Moment",
    text: "Soft, dreamy and simply irresistible. Smells like a happy bedtime story.",
  },
  founder: {
    eyebrow: "Our story",
    title: "It started with a little girl who wanted to smell like her parents.",
    text: "Our daughter wanted to wear fragrance too. But no fragrance felt right for her delicate skin. So we decided to make it ourselves — a gentle, moisturising mist for their hair and body, made with the purest form of coconut oil and lots of love.",
    name: "Meet the Founder",
    role: "Founder & Parent",
  },
  testimonials: [
    {
      quote:
        "My daughter absolutely loves using it before going out. The smell is so lovely and it's gentle on her skin.",
      name: "Parent review placeholder",
      location: "Placeholder city",
    },
    {
      quote:
        "Such a fun little part of our getting-ready routine. Finally a fragrance that's safe for kids.",
      name: "Parent review placeholder",
      location: "Placeholder city",
    },
    {
      quote: "We took it on our vacation and it was a lifesaver. Everyone asked what it was!",
      name: "Parent review placeholder",
      location: "Placeholder city",
    },
  ],
  faqs: [
    {
      q: "Is the perfume alcohol-free?",
      a: "Yes. This product is positioned as an alcohol-free fragrance. Confirm the wording against the final formulation and label before launch.",
    },
    {
      q: "Is it suitable for children?",
      a: "It is made specifically for kids. Add the exact recommended age range shown on the final product label here.",
    },
    {
      q: "What ingredients are used?",
      a: "Add the complete, verified ingredient list from the final product packaging here.",
    },
    {
      q: "How should it be applied?",
      a: "Follow the directions on the final product label. Replace this text with those exact directions before launch.",
    },
    {
      q: "Can it be used every day?",
      a: "Daily-use guidance should follow the final formulation and product label instructions.",
    },
    {
      q: "What if my child has sensitive skin?",
      a: "Check the full ingredient list, follow any patch-test guidance on the label, and consult a qualified professional if you have concerns.",
    },
    {
      q: "How long does the fragrance last?",
      a: "Add a duration based on verified product testing.",
    },
    {
      q: "What is your return policy?",
      a: "Add the business's final return and refund policy here before launch.",
    },
  ],
  shipping:
    "Shipping, inventory, cart, and payment connections are placeholders until checkout is configured.",
} as const;

export type Product = typeof product;
