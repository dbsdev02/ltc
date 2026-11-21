"""Razorpay: create the gateway order, verify the checkout signature, reconcile via webhooks."""

from __future__ import annotations

import json
import logging
import secrets

from fastapi import APIRouter, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.config import get_settings
from app.deps import DB
from app.models import Order, WebhookEvent
from app.schemas import PaymentOrderIn, PaymentOrderOut, VerifyIn, VerifyOut
from app.services import orders as order_service
from app.services import rate_limit, razorpay

router = APIRouter(prefix="/api/payments", tags=["payments"])
log = logging.getLogger("ltc.payments")


@router.post("/create-order", response_model=PaymentOrderOut)
def create_payment_order(payload: PaymentOrderIn, request: Request, db: DB):
    rate_limit.enforce(db, request, "payment-order", limit=30, window_seconds=600)
    order = db.get(Order, payload.order_id)
    if order is None or not secrets.compare_digest(payload.access_token, order.access_token):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Order not found.")
    if order.payment_method != "razorpay":
        raise HTTPException(422, "This order is cash on delivery.")
    if order.payment_status == "paid":
        raise HTTPException(status.HTTP_409_CONFLICT, "This order is already paid.")
    if order.status == "cancelled":
        raise HTTPException(status.HTTP_409_CONFLICT, "This order was cancelled. Please place a new order.")

    settings = get_settings()
    if not settings.razorpay_configured:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Online payments are not set up yet.")

    # Reuse the gateway order on retries so one order never gets two Razorpay orders.
    if not order.razorpay_order_id:
        try:
            gateway = razorpay.create_order(
                order.total,
                receipt=order.number or f"order-{order.id}",
                notes={"order_number": order.number or "", "customer": order.name, "phone": order.phone},
            )
        except razorpay.RazorpayError as exc:
            log.error("%s", exc)
            raise HTTPException(status.HTTP_502_BAD_GATEWAY, "We couldn't reach the payment gateway. Please try again.") from exc
        if gateway.get("amount") != razorpay.to_paise(order.total):
            raise HTTPException(status.HTTP_502_BAD_GATEWAY, "Payment amount mismatch. Please try again.")
        order.razorpay_order_id = gateway["id"]
        db.commit()

    return PaymentOrderOut(
        key_id=settings.razorpay_key_id,
        razorpay_order_id=order.razorpay_order_id,
        amount=razorpay.to_paise(order.total),
        currency=order.currency,
        order_number=order.number or "",
        name=order.name,
        email=order.email,
        phone=order.phone,
    )


@router.post("/verify", response_model=VerifyOut)
def verify_payment(payload: VerifyIn, request: Request, db: DB):
    rate_limit.enforce(db, request, "verify", limit=30, window_seconds=600)
    if not razorpay.verify_payment_signature(
        payload.razorpay_order_id, payload.razorpay_payment_id, payload.razorpay_signature
    ):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Payment could not be verified.")
    order = order_service.mark_paid(db, payload.razorpay_order_id, payload.razorpay_payment_id)
    if order is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Order not found.")
    return VerifyOut(verified=True, order_number=order.number, access_token=order.access_token)


@router.post("/webhook")
async def webhook(request: Request, db: DB):
    """Configure in Razorpay Dashboard → Webhooks: URL https://<site>/api/payments/webhook,
    events payment.captured, payment.failed, order.paid, and the RAZORPAY_WEBHOOK_SECRET."""
    body = await request.body()
    if not razorpay.verify_webhook_signature(body, request.headers.get("x-razorpay-signature", "")):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid signature.")
    try:
        event = json.loads(body)
    except ValueError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid JSON.") from exc

    event_id = request.headers.get("x-razorpay-event-id") or event.get("id") or ""
    event_type = str(event.get("event", ""))
    if event_id:
        if db.scalar(select(WebhookEvent.id).where(WebhookEvent.event_id == event_id)):
            return {"ok": True, "duplicate": True}

    payment = (event.get("payload", {}).get("payment") or {}).get("entity") or {}
    gateway_order = (event.get("payload", {}).get("order") or {}).get("entity") or {}
    razorpay_order_id = payment.get("order_id") or gateway_order.get("id") or ""
    payment_id = payment.get("id") or ""

    if razorpay_order_id:
        order = db.scalar(select(Order).where(Order.razorpay_order_id == razorpay_order_id))
        expected = razorpay.to_paise(order.total) if order else None
        if event_type in ("payment.captured", "order.paid") and payment_id:
            if expected is not None and payment.get("amount") not in (None, expected):
                log.error("Webhook amount mismatch for %s: %s != %s", razorpay_order_id, payment.get("amount"), expected)
            else:
                order_service.mark_paid(db, razorpay_order_id, payment_id, payment.get("method", ""))
        elif event_type == "payment.failed":
            reason = (payment.get("error_description") or payment.get("error_reason") or "Payment failed")[:255]
            order_service.mark_failed(db, razorpay_order_id, payment_id, reason, payment.get("method", ""))

    if event_id:
        db.add(WebhookEvent(event_id=event_id[:100], event_type=event_type[:60]))
        try:
            db.commit()
        except IntegrityError:  # processed concurrently by another delivery
            db.rollback()
    return {"ok": True}
