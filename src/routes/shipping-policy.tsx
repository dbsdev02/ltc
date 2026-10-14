import { createFileRoute, Link } from "@tanstack/react-router";
import { ContactBlock, PolicyLayout, policyHead } from "@/components/site/PolicyLayout";
import { site } from "@/data/site";
import { formatINR } from "@/lib/pricing";

export const Route = createFileRoute("/shipping-policy")({
  head: () =>
    policyHead(
      "Shipping Policy",
      `Where we ship, how long delivery takes and what it costs at ${site.name}.`,
      "/shipping-policy",
    ),
  component: ShippingPolicy,
});

function ShippingPolicy() {
  const { fee, dispatchDays, deliveryDays } = site.shipping;
  return (
    <PolicyLayout
      title="Shipping Policy"
      intro="We pack every order by hand with lots of love. Here's everything you need to know about how your little parcel gets to you."
    >
      <h2>1. Where we ship</h2>
      <p>
        We currently ship to serviceable PIN codes across India. We do not ship internationally at
        the moment. If your PIN code isn't serviceable by our courier partners, we'll contact you
        and refund your order in full.
      </p>

      <h2>2. Shipping charges</h2>
      <p>
        {fee === 0 ? (
          <>
            Shipping is <strong>free</strong> on all orders within India.
          </>
        ) : (
          <>
            A flat shipping fee of <strong>{formatINR(fee)}</strong> applies to each order and is
            shown at checkout before you pay.
          </>
        )}
      </p>

      <h2>3. Processing and dispatch</h2>
      <p>
        Orders are processed and dispatched within <strong>{dispatchDays}</strong> after payment is
        confirmed. Orders placed on Sundays or public holidays are processed on the next business
        day. During sales, launches or festive periods dispatch may take a little longer — we'll let
        you know if there's a delay.
      </p>

      <h2>4. Delivery time</h2>
      <p>
        Once dispatched, orders usually arrive within <strong>{deliveryDays}</strong>, depending on
        your location. Remote areas and the North-East may take a few extra days. Delivery timelines
        are estimates from our courier partners and may be affected by weather, strikes, local
        restrictions or other events outside our control.
      </p>

      <h2>5. Tracking your order</h2>
      <p>
        When your order ships, we'll send a tracking link by email, SMS or WhatsApp. If you haven't
        received it within {dispatchDays} of ordering, please get in touch.
      </p>

      <h2>6. Delivery attempts and wrong addresses</h2>
      <ul>
        <li>
          Please make sure your address, PIN code and phone number are correct — couriers may call
          before delivery.
        </li>
        <li>
          If a parcel is returned to us because of an incorrect address or repeated failed delivery
          attempts, we can re-ship it once you confirm the details; re-shipping charges may apply.
        </li>
        <li>We can't change the shipping address once an order has been dispatched.</li>
      </ul>

      <h2>7. Damaged or tampered parcels</h2>
      <p>
        If the outer package looks damaged or tampered with at delivery, please refuse it or take
        photos before opening. We always recommend recording an unboxing video. Report any damage,
        leakage or missing items within <strong>48 hours of delivery</strong> — see our{" "}
        <Link to="/returns-and-cancellation">Returns & Cancellation Policy</Link>.
      </p>

      <h2>8. Lost parcels</h2>
      <p>
        If tracking shows no movement for more than 7 days, or your parcel is marked delivered but
        you haven't received it, contact us and we'll raise it with the courier. If the parcel is
        confirmed lost, we'll send a replacement or give you a full refund.
      </p>

      <h2>9. Contact us</h2>
      <ContactBlock />
    </PolicyLayout>
  );
}
