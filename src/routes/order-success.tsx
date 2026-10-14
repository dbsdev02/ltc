import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";
import stickerSun from "@/assets/brand/st-sun.png";
import { Button } from "@/components/ui/button";
import { site } from "@/data/site";

const searchSchema = z.object({
  payment: z.string().optional(),
  name: z.string().optional(),
});

export const Route = createFileRoute("/order-success")({
  validateSearch: (search) => searchSchema.parse(search),
  head: () => ({
    meta: [{ title: `Thank you! | ${site.name}` }, { name: "robots", content: "noindex" }],
  }),
  component: OrderSuccessPage,
});

function OrderSuccessPage() {
  const { payment, name } = Route.useSearch();
  return (
    <section className="section-space">
      <div className="mx-auto flex max-w-lg flex-col items-center px-5 text-center">
        <img src={stickerSun} alt="" className="float-slow w-28" />
        <h1 className="mt-6 font-display text-4xl font-extrabold">
          Welcome to the club{name ? `, ${name}` : ""}!
        </h1>
        <p className="mt-4 text-muted-foreground">
          Your order is confirmed and a little cloud of happy is on its way. We'll dispatch it
          within {site.shipping.dispatchDays} and send tracking details to your phone and email.
        </p>
        {payment && (
          <p className="mt-5 rounded-full bg-cream px-4 py-2 text-xs font-bold">
            Payment ID: <span className="font-mono">{payment}</span>
          </p>
        )}
        <p className="mt-5 text-sm text-muted-foreground">
          Questions? Write to{" "}
          <a href={`mailto:${site.contact.email}`} className="font-bold text-accent">
            {site.contact.email}
          </a>{" "}
          or{" "}
          <a
            href={site.contact.whatsappHref}
            target="_blank"
            rel="noreferrer"
            className="font-bold text-accent"
          >
            WhatsApp us
          </a>
          .
        </p>
        <Button asChild size="lg" className="mt-8">
          <Link to="/">Back to home</Link>
        </Button>
      </div>
    </section>
  );
}
