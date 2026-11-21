"""Razorpay REST calls and signature checks. Secrets never leave the server."""

from __future__ import annotations

import hashlib
import hmac
from decimal import Decimal

import httpx

from app.config import get_settings

API = "https://api.razorpay.com/v1"


class RazorpayError(Exception):
    pass


def to_paise(amount: Decimal) -> int:
    return int((amount * 100).quantize(Decimal("1")))


def create_order(amount: Decimal, receipt: str, notes: dict[str, str]) -> dict:
    s = get_settings()
    if not s.razorpay_configured:
        raise RazorpayError("Razorpay keys are not configured.")
    try:
        response = httpx.post(
            f"{API}/orders",
            auth=(s.razorpay_key_id, s.razorpay_key_secret),
            json={
                "amount": to_paise(amount),
                "currency": "INR",
                "receipt": receipt[:40],
                "notes": {k: str(v)[:250] for k, v in list(notes.items())[:15]},
            },
            timeout=15,
        )
    except httpx.HTTPError as exc:
        raise RazorpayError(f"Could not reach Razorpay: {exc}") from exc
    if response.status_code >= 300:
        raise RazorpayError(f"Razorpay order creation failed: HTTP {response.status_code} {response.text[:300]}")
    return response.json()


def fetch_payment(payment_id: str) -> dict | None:
    s = get_settings()
    try:
        response = httpx.get(
            f"{API}/payments/{payment_id}", auth=(s.razorpay_key_id, s.razorpay_key_secret), timeout=15
        )
    except httpx.HTTPError:
        return None
    return response.json() if response.status_code == 200 else None


def _hmac(secret: str, message: bytes) -> str:
    return hmac.new(secret.encode(), message, hashlib.sha256).hexdigest()


def verify_payment_signature(razorpay_order_id: str, razorpay_payment_id: str, signature: str) -> bool:
    secret = get_settings().razorpay_key_secret
    if not secret or not signature:
        return False
    expected = _hmac(secret, f"{razorpay_order_id}|{razorpay_payment_id}".encode())
    return hmac.compare_digest(expected, signature)


def verify_webhook_signature(body: bytes, signature: str) -> bool:
    secret = get_settings().razorpay_webhook_secret
    if not secret or not signature:
        return False
    return hmac.compare_digest(_hmac(secret, body), signature)
