"""Order lifecycle: create → (pay | COD) → ship → deliver, with stock and duplicate-safety."""

from __future__ import annotations

import logging
import secrets
from datetime import UTC, datetime

from fastapi import HTTPException, status
from sqlalchemy import select, update
from sqlalchemy.orm import Session, selectinload

from app.models import Customer, Inventory, Order, OrderItem, Payment, Product, ProductVariant, StoreSettings
from app.services import email
from app.services.pricing import build_quote

log = logging.getLogger("ltc.orders")

# Which status an admin may move an order to from its current status.
ALLOWED_TRANSITIONS: dict[str, set[str]] = {
    "pending": {"cancelled"},
    "confirmed": {"shipped", "cancelled"},
    "shipped": {"delivered", "cancelled"},
    "delivered": set(),
    "cancelled": set(),
}


def store_settings(db: Session) -> StoreSettings:
    row = db.get(StoreSettings, 1)
    if row is None:
        row = StoreSettings(id=1)
        db.add(row)
        db.flush()
    return row


def get_product(db: Session, slug: str) -> Product:
    product = db.scalar(
        select(Product)
        .where(Product.slug == slug, Product.is_active.is_(True))
        .options(
            selectinload(Product.variants).selectinload(ProductVariant.inventory),
            selectinload(Product.images),
        )
    )
    if product is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Product not found.")
    return product


def resolve_lines(product: Product, raw_lines: list[tuple[str, int]]) -> list[tuple[ProductVariant, int]]:
    """Validates variants, merges duplicates, enforces per-order limits and stock."""
    by_slug = {v.slug: v for v in product.variants if v.is_active}
    merged: dict[str, int] = {}
    for slug, quantity in raw_lines:
        if slug not in by_slug:
            raise HTTPException(422, "One of the items in your cart is no longer available.")
        merged[slug] = merged.get(slug, 0) + quantity
    if not merged:
        raise HTTPException(422, "Your cart is empty.")
    if sum(merged.values()) > product.max_qty_per_order:
        raise HTTPException(
            422,
            f"You can order up to {product.max_qty_per_order} bottles at a time.",
        )
    lines = []
    for slug, quantity in merged.items():
        variant = by_slug[slug]
        if variant.stock < quantity:
            available = variant.stock
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                f"{variant.name} is sold out." if available <= 0 else f"Only {available} {variant.name} left in stock.",
            )
        lines.append((variant, quantity))
    return lines


def create_order(
    db: Session,
    *,
    product_slug: str,
    raw_lines: list[tuple[str, int]],
    customer_fields: dict[str, str],
    payment_method: str,
    customer: Customer | None,
) -> Order:
    product = get_product(db, product_slug)
    settings = store_settings(db)
    lines = resolve_lines(product, raw_lines)

    if payment_method == "cod" and not settings.cod_enabled:
        raise HTTPException(422, "Cash on delivery is not available.")
    quote = build_quote(product, lines, settings, payment_method)
    if payment_method == "cod" and settings.cod_max_order_total is not None and quote.total > settings.cod_max_order_total:
        raise HTTPException(
            422,
            f"Cash on delivery is available for orders up to ₹{settings.cod_max_order_total:,.0f}. Please pay online.",
        )

    order = Order(
        access_token=secrets.token_urlsafe(24),
        customer_id=customer.id if customer else None,
        payment_method=payment_method,
        subtotal=quote.subtotal,
        discount=quote.discount,
        shipping=quote.shipping,
        cod_fee=quote.cod_fee,
        total=quote.total,
        **customer_fields,
    )
    order.items = [
        OrderItem(
            variant_id=line.variant.id,
            product_name=product.name,
            variant_name=line.variant.name,
            sku=line.variant.sku,
            unit_price=line.unit_price,
            quantity=line.quantity,
            line_total=line.line_total,
        )
        for line in quote.lines
    ]
    db.add(order)
    db.flush()
    order.number = f"LTC-{1000 + order.id}"

    if payment_method == "cod":
        order.status = "confirmed"
        order.payment_status = "cod_pending"
        db.add(Payment(order_id=order.id, provider="cod", amount=order.total, status="pending", method="cod"))
        commit_stock(db, order)
        db.commit()
        _send_confirmation_once(db, order)
    else:
        db.commit()
    return order


def commit_stock(db: Session, order: Order) -> None:
    """Atomically takes stock for a paid/COD order. Never blocks a payment that already went through."""
    if order.stock_committed:
        return
    short = []
    for item in order.items:
        if item.variant_id is None:
            continue
        result = db.execute(
            update(Inventory)
            .where(Inventory.variant_id == item.variant_id, Inventory.quantity >= item.quantity)
            .values(quantity=Inventory.quantity - item.quantity)
        )
        if result.rowcount == 0:
            short.append(item.variant_name)
    order.stock_committed = True
    if short:
        order.needs_attention = f"Paid but out of stock: {', '.join(short)}. Restock or refund."
        log.error("Order %s oversold: %s", order.number, short)


def restock(db: Session, order: Order) -> None:
    if not order.stock_committed:
        return
    for item in order.items:
        if item.variant_id is not None:
            db.execute(
                update(Inventory)
                .where(Inventory.variant_id == item.variant_id)
                .values(quantity=Inventory.quantity + item.quantity)
            )
    order.stock_committed = False


def lock_order(db: Session, **where) -> Order | None:
    """Loads an order with a row lock (Postgres) so verify + webhook can't double-process."""
    query = select(Order).filter_by(**where).options(selectinload(Order.items), selectinload(Order.payments))
    if db.get_bind().dialect.name == "postgresql":
        query = query.with_for_update(of=Order)
    return db.scalar(query)


def mark_paid(db: Session, razorpay_order_id: str, payment_id: str, method: str = "") -> Order | None:
    order = lock_order(db, razorpay_order_id=razorpay_order_id)
    if order is None:
        return None
    payment = next((p for p in order.payments if p.razorpay_payment_id == payment_id), None)
    if payment is None:
        payment = Payment(
            order_id=order.id,
            provider="razorpay",
            razorpay_order_id=razorpay_order_id,
            razorpay_payment_id=payment_id,
            amount=order.total,
            status="captured",
            method=method,
        )
        db.add(payment)
    else:
        payment.status = "captured"
        payment.method = method or payment.method

    if order.payment_status != "paid":
        order.payment_status = "paid"
        order.paid_at = datetime.now(UTC)
        if order.status == "pending":
            order.status = "confirmed"
        elif order.status == "cancelled":
            order.needs_attention = "Payment received for a cancelled order — refund it in Razorpay."
        commit_stock(db, order)
    db.commit()
    _send_confirmation_once(db, order)
    return order


def mark_failed(db: Session, razorpay_order_id: str, payment_id: str, reason: str, method: str = "") -> None:
    order = lock_order(db, razorpay_order_id=razorpay_order_id)
    if order is None:
        return
    if payment_id and not any(p.razorpay_payment_id == payment_id for p in order.payments):
        db.add(
            Payment(
                order_id=order.id,
                provider="razorpay",
                razorpay_order_id=razorpay_order_id,
                razorpay_payment_id=payment_id,
                amount=order.total,
                status="failed",
                method=method,
                error_reason=reason[:255],
            )
        )
    if order.payment_status == "pending":
        order.payment_status = "failed"  # the customer can still retry; a later success wins
    db.commit()


def _send_confirmation_once(db: Session, order: Order) -> None:
    claimed = db.execute(
        update(Order).where(Order.id == order.id, Order.emails_sent.is_(False)).values(emails_sent=True)
    ).rowcount
    db.commit()
    if claimed:
        try:
            email.send_order_confirmation(order)
        except Exception:  # an email problem must never break checkout
            log.exception("Confirmation email failed for %s", order.number)


def change_status(db: Session, order: Order, new_status: str, tracking: str | None, notify: bool) -> Order:
    if new_status != order.status and new_status not in ALLOWED_TRANSITIONS.get(order.status, set()):
        raise HTTPException(
            422, f"Can't change an order from {order.status} to {new_status}."
        )
    if tracking is not None:
        order.tracking = tracking.strip()[:200]
    if new_status == "shipped" and order.payment_method == "razorpay" and order.payment_status != "paid":
        raise HTTPException(422, "Only paid orders can be shipped.")
    if new_status == "cancelled" and order.status != "cancelled":
        restock(db, order)
        if order.payment_status == "paid":
            order.needs_attention = "Cancelled after payment — refund it in the Razorpay Dashboard."
    if new_status == "shipped" and order.status != "shipped":
        order.shipped_at = datetime.now(UTC)
    if new_status == "delivered" and order.payment_method == "cod":
        order.payment_status = "cod_collected"
        for payment in order.payments:
            if payment.provider == "cod":
                payment.status = "captured"
    order.status = new_status
    db.commit()
    if notify and new_status == "shipped":
        try:
            email.send_shipped(order)
        except Exception:
            log.exception("Shipped email failed for %s", order.number)
    return order
