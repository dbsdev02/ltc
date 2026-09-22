import { createFileRoute } from "@tanstack/react-router";
import { LandingPage } from "@/components/LandingPage";
import { product } from "@/data/product";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: `${product.brand} | Magical Alcohol-Free Fragrance for Kids` },
      { name: "description", content: `Discover ${product.brand}, a playful alcohol-free fragrance made for kids and their everyday adventures.` },
      { property: "og:title", content: `${product.brand} | Magical Kids’ Fragrance` },
      { property: "og:description", content: "A gentle, naturally inspired fragrance experience made for little adventures." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://example.com/" }],
  }),
  component: Index,
});

// IMPORTANT: Replace this placeholder. See ./README.md for routing conventions.
function Index() {
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "Organization", name: product.brand, url: "https://example.com/" },
      { "@type": "Product", name: product.name, description: product.description, brand: { "@type": "Brand", name: product.brand } },
      { "@type": "FAQPage", mainEntity: product.faqs.map((item) => ({ "@type": "Question", name: item.q, acceptedAnswer: { "@type": "Answer", text: item.a } })) },
    ],
  };
  return <><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} /><LandingPage /></>;
}
