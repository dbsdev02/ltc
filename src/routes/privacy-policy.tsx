import { createFileRoute, Link } from "@tanstack/react-router";
import {
  businessName,
  ContactBlock,
  PolicyLayout,
  policyHead,
} from "@/components/site/PolicyLayout";
import { site } from "@/data/site";

export const Route = createFileRoute("/privacy-policy")({
  head: () =>
    policyHead(
      "Privacy Policy",
      `How ${site.name} collects, uses and protects your personal information.`,
      "/privacy-policy",
    ),
  component: PrivacyPolicy,
});

function PrivacyPolicy() {
  return (
    <PolicyLayout
      title="Privacy Policy"
      intro={`At ${site.name}, we're parents too — so we treat your family's information the way we'd want ours treated. This policy explains what we collect when you visit ${site.url.replace("https://", "")} or buy from us, why we collect it, and the choices you have.`}
    >
      <h2>1. Who we are</h2>
      <p>
        This website is operated by {businessName} ("{site.name}", "we", "us" or "our"), based in
        India. For any privacy question you can reach us using the details at the end of this
        policy.
      </p>

      <h2>2. Information we collect</h2>
      <h3>Information you give us</h3>
      <ul>
        <li>
          <strong>Order details:</strong> your name, email address, mobile number and shipping
          address when you place an order.
        </li>
        <li>
          <strong>Messages:</strong> anything you share when you email us, WhatsApp us, or message
          us on Instagram — for example a question, a review or a PR box request.
        </li>
      </ul>
      <h3>Payment information</h3>
      <p>
        Payments are processed securely by our payment partner, <strong>Razorpay</strong>. We never
        see or store your full card number, UPI PIN, CVV or net banking password. Razorpay shares
        with us only what we need to confirm your order, such as a payment ID and payment status.
        Razorpay's handling of your data is governed by its own privacy policy.
      </p>
      <h3>Information collected automatically</h3>
      <p>
        Like most websites, our hosting provider may log basic technical information such as your IP
        address, browser type, device and the pages you visit, to keep the site secure and working.
        We store your shopping cart in your own browser (local storage) so it's still there when you
        come back; it is not sent to us until you check out.
      </p>
      <h3>Children's information</h3>
      <p>
        Our products are made for children, but our website and store are meant for parents and
        guardians. We do not knowingly collect personal information directly from children. If you
        believe a child has shared information with us, please contact us and we will delete it.
      </p>

      <h2>3. How we use your information</h2>
      <ul>
        <li>
          To process, pack, ship and deliver your order, and to send order and delivery updates.
        </li>
        <li>To respond to your questions, requests and feedback.</li>
        <li>To handle returns, replacements, refunds and complaints.</li>
        <li>To prevent fraud and keep our website and payments secure.</li>
        <li>To meet our legal, tax and accounting obligations.</li>
        <li>
          To send you news or offers — <strong>only if you have opted in</strong>. You can opt out
          at any time.
        </li>
      </ul>

      <h2>4. Who we share it with</h2>
      <p>We do not sell or rent your personal information. We share it only with:</p>
      <ul>
        <li>
          <strong>Payment partner</strong> (Razorpay) to process your payment.
        </li>
        <li>
          <strong>Courier and logistics partners</strong> — your name, phone number and address, so
          they can deliver your order.
        </li>
        <li>
          <strong>Service providers</strong> who help us run the website, email and messaging, bound
          to use the data only for our purposes.
        </li>
        <li>
          <strong>Authorities</strong> where required by law, court order or to protect our rights
          and the safety of our customers.
        </li>
      </ul>

      <h2>5. How long we keep it</h2>
      <p>
        We keep order information for as long as needed to fulfil your order and to meet legal, tax
        and accounting requirements under Indian law. Messages are kept for as long as needed to
        help you. After that, data is deleted or anonymised.
      </p>

      <h2>6. How we protect it</h2>
      <p>
        Our website is served over HTTPS, payments are handled by a PCI-DSS compliant payment
        gateway, and access to customer information is limited to people who need it to serve you.
        No method of transmission over the internet is 100% secure, but we take reasonable care to
        protect your information.
      </p>

      <h2>7. Your rights</h2>
      <p>
        Under applicable Indian law, including the Digital Personal Data Protection Act, 2023, you
        may ask us to:
      </p>
      <ul>
        <li>access a summary of the personal data we hold about you;</li>
        <li>correct or update inaccurate or incomplete information;</li>
        <li>delete your data, where we don't need to keep it for legal reasons;</li>
        <li>withdraw consent you have given, for example to marketing messages.</li>
      </ul>
      <p>
        To make a request, email <a href={`mailto:${site.contact.email}`}>{site.contact.email}</a>.
        We may need to verify your identity before acting on it.
      </p>

      <h2>8. Cookies</h2>
      <p>
        We use only the browser storage needed to run the site (such as remembering your cart). If
        we add analytics or advertising tools in the future, we will update this policy.
      </p>

      <h2>9. Third-party links</h2>
      <p>
        Our site links to Instagram, WhatsApp and Razorpay. Those services have their own privacy
        policies, and we are not responsible for their practices.
      </p>

      <h2>10. Changes to this policy</h2>
      <p>
        We may update this policy from time to time. The "last updated" date at the top shows when
        it last changed. Continued use of the website after a change means you accept the updated
        policy.
      </p>

      <h2 id="grievance">11. Grievance Officer</h2>
      <p>
        In accordance with the Information Technology Act, 2000, the rules made under it, and the
        Consumer Protection (E-Commerce) Rules, 2020, the Grievance Officer for this website is:
      </p>
      <ul>
        <li>
          <strong>Name:</strong> {site.grievanceOfficer.name}
        </li>
        <li>
          <strong>Email:</strong>{" "}
          <a href={`mailto:${site.grievanceOfficer.email}`}>{site.grievanceOfficer.email}</a>
        </li>
        <li>
          <strong>Phone:</strong> {site.grievanceOfficer.phone}
        </li>
        {site.legal.address && (
          <li>
            <strong>Address:</strong> {site.legal.address}
          </li>
        )}
      </ul>
      <p>
        We will acknowledge your complaint within 48 hours and aim to resolve it within one month of
        receiving it.
      </p>

      <h2>12. Contact us</h2>
      <ContactBlock />
      <p>
        See also our <Link to="/terms-and-conditions">Terms & Conditions</Link>.
      </p>
    </PolicyLayout>
  );
}
