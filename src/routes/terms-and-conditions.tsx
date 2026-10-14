import { createFileRoute, Link } from "@tanstack/react-router";
import {
  businessName,
  ContactBlock,
  PolicyLayout,
  policyHead,
} from "@/components/site/PolicyLayout";
import { product } from "@/data/product";
import { site } from "@/data/site";

export const Route = createFileRoute("/terms-and-conditions")({
  head: () =>
    policyHead(
      "Terms & Conditions",
      `The terms that apply when you use the ${site.name} website and buy our products.`,
      "/terms-and-conditions",
    ),
  component: Terms,
});

function Terms() {
  return (
    <PolicyLayout
      title="Terms & Conditions"
      intro={`Welcome to ${site.name}! These terms apply when you browse our website or place an order with us. By using the site or placing an order, you agree to them — so please read them carefully.`}
    >
      <h2>1. About us</h2>
      <p>
        This website and the {site.name} brand are operated by {businessName}, India. In these
        terms, "we", "us" and "our" mean {businessName}, and "you" means the person using the
        website or placing an order.
      </p>

      <h2>2. Eligibility</h2>
      <p>
        You must be at least 18 years old and able to enter into a binding contract under the Indian
        Contract Act, 1872 to place an order. Our products are made for children aged{" "}
        {product.ageRange}, but they must be purchased by and used under the supervision of a parent
        or guardian.
      </p>

      <h2>3. Products and product information</h2>
      <ul>
        <li>
          We try hard to describe and show our products accurately. Colours on screen and packaging
          artwork may vary slightly from the product you receive.
        </li>
        <li>
          Our products are for <strong>external use only</strong>. Always read the label and
          ingredient list before use, do a patch test before first use, avoid the eyes, face and
          broken or irritated skin, and stop using a product if irritation occurs.
        </li>
        <li>
          Information on this website is general in nature and is not medical advice. If your child
          has allergies or a skin condition, please consult your paediatrician before use.
        </li>
        <li>Keep products out of reach of children when not in use.</li>
      </ul>

      <h2>4. Prices and offers</h2>
      <ul>
        <li>
          All prices are in Indian Rupees (₹) and include applicable taxes unless stated otherwise.
        </li>
        <li>
          When you buy {product.multiUnitDiscount.minQuantity} or more bottles in one order, a{" "}
          {product.multiUnitDiscount.percent}% discount is applied automatically to the order.
          Offers cannot be combined unless we say so, and may be changed or withdrawn at any time
          without affecting orders already placed.
        </li>
        <li>
          We may change prices at any time. The price that applies is the one shown at checkout when
          you place your order.
        </li>
        <li>
          If a product is listed at an obviously wrong price because of an error, we may cancel the
          order and refund any amount paid in full.
        </li>
      </ul>

      <h2>5. Orders and payment</h2>
      <ul>
        <li>
          Placing an order is an offer to buy. Your order is accepted when we confirm it and
          dispatch the product. We may decline or cancel an order — for example if a product is out
          of stock, the address is unserviceable, or we suspect fraud — in which case any amount
          paid is refunded in full.
        </li>
        <li>
          Payments are processed securely by Razorpay. By paying, you also agree to Razorpay's
          terms. We do not store your card or banking details.
        </li>
        <li>
          You are responsible for giving us a correct and complete shipping address and phone
          number.
        </li>
      </ul>

      <h2>6. Shipping, returns and cancellations</h2>
      <p>
        Delivery is covered by our <Link to="/shipping-policy">Shipping Policy</Link>, and returns,
        refunds and cancellations by our{" "}
        <Link to="/returns-and-cancellation">Returns & Cancellation Policy</Link>. Both form part of
        these terms.
      </p>

      <h2>7. PR boxes and promotions</h2>
      <p>
        PR boxes, giveaways and collaborations are offered at our discretion, in limited numbers,
        and may have their own terms which we will share with you. Signing up for a waitlist does
        not guarantee a box.
      </p>

      <h2>8. Reviews and content you share</h2>
      <p>
        If you send us a review, photo or message, you confirm it is genuine and yours to share. We
        will only publish your review or photo on our website or social media with your permission,
        and we will never publish a photo of your child without your explicit consent.
      </p>

      <h2>9. Intellectual property</h2>
      <p>
        The {site.name} name, logo, mascot, packaging designs, illustrations, photographs and
        website content belong to us or our licensors and are protected by law. You may not copy,
        reproduce or use them for commercial purposes without our written permission.
      </p>

      <h2>10. Acceptable use</h2>
      <p>
        You agree not to misuse the website — for example by attempting to hack it, interfere with
        its operation, place fraudulent orders, or use it for any unlawful purpose.
      </p>

      <h2>11. Limitation of liability</h2>
      <p>
        To the extent permitted by law, we are not liable for any indirect or consequential loss
        arising from the use of our website or products, or from use that does not follow the label
        directions. Our total liability for any order is limited to the amount you paid for that
        order. Nothing in these terms limits your rights as a consumer under the Consumer Protection
        Act, 2019.
      </p>

      <h2>12. Governing law</h2>
      <p>
        These terms are governed by the laws of India. Any dispute will be subject to the
        jurisdiction of the courts in {site.legal.jurisdiction}.
      </p>

      <h2>13. Changes to these terms</h2>
      <p>
        We may update these terms from time to time. The version on this page at the time of your
        order applies to that order.
      </p>

      <h2>14. Contact and grievances</h2>
      <ContactBlock />
      <p>
        For complaints, you can also write to our{" "}
        <Link to="/privacy-policy" hash="grievance">
          Grievance Officer
        </Link>
        .
      </p>
    </PolicyLayout>
  );
}
