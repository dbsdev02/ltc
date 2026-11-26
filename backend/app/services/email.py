"""Transactional email via Resend's HTTP API. Without RESEND_API_KEY, emails are skipped and logged."""

from __future__ import annotations

import logging

import httpx

from app.config import get_settings
from app.models import Order

log = logging.getLogger("ltc.email")
STORE_NAME = "Little Todds Club"


def send(to: str, subject: str, text: str, reply_to: str | None = None) -> bool:
    s = get_settings()
    if not s.resend_api_key:
        log.warning("Email skipped (RESEND_API_KEY not set): %s → %s", subject, to)
        return False
    try:
        response = httpx.post(
            "https://api.resend.com/emails",
            headers={"Authorization": f"Bearer {s.resend_api_key}"},
            json={
                "from": s.email_from,
                "to": [to],
                "subject": subject,
                "text": text,
                **({"reply_to": reply_to} if reply_to else {}),
            },
            timeout=10,
        )
    except httpx.HTTPError as exc:
        log.error("Email failed: %s", exc)
        return False
    if response.status_code >= 300:
        log.error("Email failed: HTTP %s %s", response.status_code, response.text[:200])
        return False
    return True


def _inr(amount) -> str:
    return f"₹{amount:,.0f}" if amount == int(amount) else f"₹{amount:,.2f}"


def order_summary(order: Order) -> str:
    lines = [f"Order: {order.number}"]
    lines += [f"• {i.product_name} – {i.variant_name} × {i.quantity}  {_inr(i.line_total)}" for i in order.items]
    lines.append(f"Subtotal: {_inr(order.subtotal)}")
    if order.discount:
        lines.append(f"Discount: −{_inr(order.discount)}")
    lines.append(f"Shipping: {'Free' if not order.shipping else _inr(order.shipping)}")
    if order.cod_fee:
        lines.append(f"Cash on delivery fee: {_inr(order.cod_fee)}")
    lines.append(f"Total: {_inr(order.total)}" + (" (pay on delivery)" if order.payment_method == "cod" else ""))
    lines += ["", "Delivering to:", order.name, order.address, f"{order.city}, {order.state} {order.pincode}",
              f"Phone: {order.phone}"]
    if order.notes:
        lines += ["", f"Notes: {order.notes}"]
    return "\n".join(lines)


def send_order_confirmation(order: Order) -> None:
    s = get_settings()
    first = order.name.split(" ")[0]
    paid = order.payment_method != "cod"
    if order.email:  # email is optional at checkout
        send(
            order.email,
            f"Your {STORE_NAME} order {order.number} is confirmed",
            f"Hi {first},\n\nThank you for joining the club! "
            + ("Your payment was successful and your order is confirmed." if paid
               else "Your cash-on-delivery order is confirmed — please keep the amount ready at delivery.")
            + f"\n\n{order_summary(order)}\n\nWe dispatch within 1–3 business days and will email tracking details "
            f"as soon as it ships.\n\nView your order: {s.frontend_url}/order-success?order={order.number}&token={order.access_token}"
            f"\n\nWith love,\n{STORE_NAME}\n",
            reply_to=s.notify_email,
        )
    send(
        s.notify_email,
        f"New {'COD ' if not paid else ''}order {order.number} — {_inr(order.total)} from {order.name}",
        f"A new order just came in.\n\n{order_summary(order)}\nEmail: {order.email or 'not given'}\n\n"
        f"Manage: {s.frontend_url}/admin?tab=orders&order={order.id}\n",
        reply_to=order.email or None,
    )


def send_shipped(order: Order) -> None:
    if not order.email:
        return
    first = order.name.split(" ")[0]
    tracking = f"Tracking: {order.tracking}\n\n" if order.tracking else ""
    send(
        order.email,
        f"Your {STORE_NAME} order {order.number} is on its way!",
        f"Hi {first},\n\nGood news — your order has been dispatched!\n\n{tracking}"
        f"It usually arrives within 3–7 business days.\n\n{order_summary(order)}\n\nWith love,\n{STORE_NAME}\n",
    )


def send_password_reset(email: str, name: str, link: str) -> None:
    send(
        email,
        f"Reset your {STORE_NAME} password",
        f"Hi {name.split(' ')[0]},\n\nOpen this link within 1 hour to choose a new password:\n\n{link}\n\n"
        f"If you didn't ask for this, you can ignore this email.\n\n{STORE_NAME}\n",
    )
