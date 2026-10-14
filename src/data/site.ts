const whatsappNumber = "918105938699";

export const site = {
  name: "Little Todds Club",
  url: "https://www.littletodds.club",
  footerLine: "Little things made for little people.",
  /**
   * Legal details shown in the footer and policies. Fill `legalName` and `address`
   * once registered; empty values are hidden rather than shown as placeholders.
   */
  legal: {
    legalName: "",
    proprietor: "Shraddha Goel",
    address: "",
    gstin: "",
    jurisdiction: "India",
  },
  contact: {
    email: "littletoddsclub@gmail.com",
    phone: "+91 81059 38699",
    phoneHref: "tel:+918105938699",
    whatsappNumber,
    whatsappHref: `https://wa.me/${whatsappNumber}`,
    hours: "Monday to Saturday, 10 am – 6 pm IST",
  },
  grievanceOfficer: {
    name: "Shraddha Goel",
    email: "littletoddsclub@gmail.com",
    phone: "+91 81059 38699",
  },
  social: {
    instagram: "https://www.instagram.com/littletoddsclub",
    facebook: "",
  },
  shipping: {
    /** Flat shipping fee in rupees; 0 means free shipping on every order. */
    fee: 0,
    dispatchDays: "1–3 business days",
    deliveryDays: "3–7 business days",
  },
  policiesUpdated: "14 October 2026",
} as const;

export const policyLinks = [
  { label: "Privacy Policy", to: "/privacy-policy" },
  { label: "Terms & Conditions", to: "/terms-and-conditions" },
  { label: "Shipping Policy", to: "/shipping-policy" },
  { label: "Returns & Cancellation", to: "/returns-and-cancellation" },
] as const;

export function whatsappLink(message: string) {
  return `${site.contact.whatsappHref}?text=${encodeURIComponent(message)}`;
}
