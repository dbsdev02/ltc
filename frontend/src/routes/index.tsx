import { createFileRoute } from "@tanstack/react-router";
import { LandingPage } from "@/components/LandingPage";
import { product } from "@/data/product";
import { site } from "@/data/site";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: `${product.name} by ${site.name} | Alcohol-Free Skin & Hair Mist for Toddlers` },
      {
        name: "description",
        content: `${product.name} is a gentle, alcohol-free toddler skin & hair mist with coconut oil and Vitamin E. Vegan, cruelty-free and mom-approved. ${product.size} for ₹${product.price}.`,
      },
      { property: "og:title", content: `${product.name} by ${site.name}` },
      {
        property: "og:description",
        content: `${product.tagline} A gentle, alcohol-free mist made for little ones.`,
      },
      { property: "og:url", content: `${site.url}/` },
    ],
    links: [{ rel: "canonical", href: `${site.url}/` }],
  }),
  component: Index,
});

function Index() {
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        name: site.name,
        url: site.url,
        email: site.contact.email,
        telephone: site.contact.phone,
        sameAs: [site.social.instagram].filter(Boolean),
      },
      {
        "@type": "Product",
        name: product.name,
        description: product.description,
        brand: { "@type": "Brand", name: site.name },
        image: `${site.url}/og-image.jpg`,
        offers: product.variants.map((variant) => ({
          "@type": "Offer",
          name: variant.name,
          price: product.price,
          priceCurrency: "INR",
          availability: variant.inStock
            ? "https://schema.org/InStock"
            : "https://schema.org/OutOfStock",
          url: `${site.url}/#shop`,
        })),
      },
      {
        "@type": "FAQPage",
        mainEntity: product.faqs.map((item) => ({
          "@type": "Question",
          name: item.q,
          acceptedAnswer: { "@type": "Answer", text: item.a },
        })),
      },
    ],
  };
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <LandingPage />
    </>
  );
}
