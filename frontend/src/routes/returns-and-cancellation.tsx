import { createFileRoute, Link } from "@tanstack/react-router";
import { ContactBlock, PolicyLayout, policyHead } from "@/components/site/PolicyLayout";
import { site } from "@/data/site";

export const Route = createFileRoute("/returns-and-cancellation")({
  head: () =>
    policyHead(
      "Returns & Cancellation Policy",
      `How cancellations, returns, replacements and refunds work at ${site.name}.`,
      "/returns-and-cancellation",
    ),
  component: ReturnsPolicy,
});

function ReturnsPolicy() {
  return (
    <PolicyLayout
      title="Returns & Cancellation Policy"
      intro="We want you and your little one to love every order. Because our products are personal care items applied to skin and hair, we follow a few hygiene rules — but if something goes wrong on our side, we'll always make it right."
    >
      <h2>1. Cancelling an order</h2>
      <ul>
        <li>
          You can cancel your order <strong>any time before it is dispatched</strong> by emailing or
          WhatsApp-ing us with your order details. You'll receive a full refund.
        </li>
        <li>Once an order has been dispatched, it can't be cancelled.</li>
        <li>
          We may cancel an order if a product is out of stock, your PIN code isn't serviceable, or
          we're unable to verify the payment. In that case you'll receive a full refund.
        </li>
      </ul>

      <h2>2. Returns</h2>
      <p>
        For hygiene and safety reasons, we{" "}
        <strong>cannot accept returns of opened or used products</strong>, or returns because of a
        change of mind or scent preference. Unopened products with intact seals and packaging may be
        returned within <strong>7 days of delivery</strong> if you contact us first; return shipping
        for change-of-mind returns is paid by the customer.
      </p>

      <h2>3. Damaged, leaking, defective or wrong items</h2>
      <p>
        If your order arrives damaged, leaking, defective, incomplete or isn't what you ordered:
      </p>
      <ol>
        <li>
          Contact us within <strong>48 hours of delivery</strong> at{" "}
          <a href={`mailto:${site.contact.email}`}>{site.contact.email}</a> or on{" "}
          <a href={site.contact.whatsappHref} target="_blank" rel="noreferrer">
            WhatsApp ({site.contact.phone})
          </a>
          .
        </li>
        <li>
          Share your name, phone number, payment ID or order details, and clear photos or an
          unboxing video.
        </li>
        <li>
          Once verified, we'll send a <strong>free replacement</strong> or, if a replacement isn't
          available, a <strong>full refund</strong>. We may ask you to send the item back — we'll
          arrange or pay for the return.
        </li>
      </ol>

      <h2>4. Skin reactions</h2>
      <p>
        Every child is unique. Please patch test before first use and stop using the product if you
        notice redness or irritation. If your child has a reaction, please contact us — we take
        every report seriously and want to hear from you, and we'll help with next steps.
      </p>

      <h2>5. Refunds</h2>
      <ul>
        <li>Approved refunds are made to the original payment method through Razorpay.</li>
        <li>
          Refunds are initiated within <strong>2 business days</strong> of approval (or of
          cancellation) and usually reflect in your account within{" "}
          <strong>5–7 business days</strong>, depending on your bank or payment provider.
        </li>
        <li>
          For orders paid outside the website (for example via a WhatsApp payment link), refunds go
          to the same account.
        </li>
      </ul>

      <h2>6. Exchanges</h2>
      <p>
        We don't offer exchanges for a different scent once a product has been opened. For unopened
        products, write to us and we'll do our best to help.
      </p>

      <h2>7. Need help?</h2>
      <ContactBlock />
      <p>
        See also our <Link to="/shipping-policy">Shipping Policy</Link> and{" "}
        <Link to="/terms-and-conditions">Terms & Conditions</Link>.
      </p>
    </PolicyLayout>
  );
}
