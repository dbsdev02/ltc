import hashlib
import hmac
import itertools
import os
import tempfile
from pathlib import Path

import pytest

_DB = Path(tempfile.gettempdir()) / f"ltc-test-{os.getpid()}.db"
os.environ.update(
    DATABASE_URL=f"sqlite:///{_DB}",
    RAZORPAY_KEY_ID="rzp_test_dummykey",
    RAZORPAY_KEY_SECRET="test_secret_123",
    RAZORPAY_WEBHOOK_SECRET="whsec_test_456",
    JWT_SECRET_KEY="x" * 40,
    FRONTEND_URL="http://localhost:5173",
    ENVIRONMENT="test",
)

from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy.orm import Session  # noqa: E402

from app.database import Base, get_engine  # noqa: E402
from app.main import app  # noqa: E402
from app.services import razorpay  # noqa: E402
from scripts.seed import seed_admin, seed_catalog  # noqa: E402

_counter = itertools.count(1)

CUSTOMER = {
    "name": "Asha Kumar",
    "email": "asha@example.com",
    "phone": "9876543210",
    "address": "12 Rose Street, Sector 4",
    "city": "Delhi",
    "state": "Delhi",
    "pincode": "110001",
}


@pytest.fixture(autouse=True)
def fresh_db(monkeypatch):
    engine = get_engine()
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    with Session(engine) as db:
        seed_catalog(db)
        seed_admin(db, "owner@example.com", "OwnerPass#2026", "owner")
        seed_admin(db, "staff@example.com", "StaffPass#2026", "staff")

    def fake_create_order(amount, receipt, notes):
        return {"id": f"order_test{next(_counter)}", "amount": razorpay.to_paise(amount), "currency": "INR"}

    monkeypatch.setattr(razorpay, "create_order", fake_create_order)
    yield


@pytest.fixture
def client():
    return TestClient(app)


def sign(order_id: str, payment_id: str, secret: str = "test_secret_123") -> str:
    return hmac.new(secret.encode(), f"{order_id}|{payment_id}".encode(), hashlib.sha256).hexdigest()


def webhook_sig(body: bytes, secret: str = "whsec_test_456") -> str:
    return hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()


def admin_client(role: str = "owner") -> TestClient:
    c = TestClient(app)
    email, pw = ("owner@example.com", "OwnerPass#2026") if role == "owner" else ("staff@example.com", "StaffPass#2026")
    r = c.post("/api/admin/auth/login", json={"email": email, "password": pw})
    assert r.status_code == 200, r.text
    return c


def place_order(client, quantity=1, variant="vanilla-cake", method="razorpay", **customer):
    body = {
        "lines": [{"variantId": variant, "quantity": quantity}],
        "customer": {**CUSTOMER, **customer},
        "paymentMethod": method,
    }
    return client.post("/api/orders", json=body)


def pay(client, order) -> dict:
    r = client.post("/api/payments/create-order", json={"orderId": order["id"], "accessToken": order["accessToken"]})
    assert r.status_code == 200, r.text
    rp = r.json()
    payment_id = f"pay_{rp['razorpayOrderId']}"
    v = client.post(
        "/api/payments/verify",
        json={
            "razorpay_order_id": rp["razorpayOrderId"],
            "razorpay_payment_id": payment_id,
            "razorpay_signature": sign(rp["razorpayOrderId"], payment_id),
        },
    )
    assert v.status_code == 200, v.text
    return {**rp, "paymentId": payment_id}
