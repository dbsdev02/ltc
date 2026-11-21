import json

from fastapi.testclient import TestClient

from app.main import app
from tests.conftest import CUSTOMER, admin_client, pay, place_order, sign, webhook_sig


def stock(client) -> dict[str, int]:
    products = admin_client().get("/api/admin/products").json()
    return {v["slug"]: v["stock"] for v in products[0]["variants"]}


# --- Catalog & pricing ------------------------------------------------------


def test_product_api(client):
    r = client.get("/api/products/cloud-mist")
    assert r.status_code == 200
    p = r.json()
    assert p["price"] == 750 and p["multiUnitDiscount"] == {"minQuantity": 2, "percent": 10}
    assert {v["id"]: v["inStock"] for v in p["variants"]} == {"vanilla-cake": True, "fruit-punch": False}
    assert client.get("/api/products").json()[0]["id"] == "cloud-mist"
    assert client.get("/api/products/nope").status_code == 404


def test_quote_uses_server_prices_and_discount(client):
    one = client.post("/api/cart/quote", json={"lines": [{"variantId": "vanilla-cake", "quantity": 1}]}).json()
    two = client.post("/api/cart/quote", json={"lines": [{"variantId": "vanilla-cake", "quantity": 2}]}).json()
    assert one["total"] == 750 and one["discount"] == 0
    assert two["subtotal"] == 1500 and two["discount"] == 150 and two["total"] == 1350


def test_sold_out_and_limits_rejected(client):
    assert place_order(client, variant="fruit-punch").status_code == 409
    assert place_order(client, variant="does-not-exist").status_code == 422
    r = client.post(
        "/api/orders",
        json={"lines": [{"variantId": "vanilla-cake", "quantity": 6}, {"variantId": "vanilla-cake", "quantity": 5}],
              "customer": CUSTOMER},
    )
    assert r.status_code == 422 and "up to 10" in r.json()["detail"]


def test_checkout_validation_messages(client):
    r = place_order(client, phone="12345")
    assert r.status_code == 422 and r.json()["detail"] == "Please enter a valid mobile number."
    r = place_order(client, pincode="0110")
    assert r.json()["detail"] == "Please enter a valid PIN code."


def test_client_cannot_set_price(client):
    body = {"lines": [{"variantId": "vanilla-cake", "quantity": 1, "price": 1}], "customer": CUSTOMER, "total": 1}
    r = client.post("/api/orders", json=body)
    assert r.status_code == 201 and r.json()["total"] == 750


# --- Razorpay ---------------------------------------------------------------


def test_full_razorpay_flow_and_idempotency(client):
    before = stock(client)["vanilla-cake"]
    order = place_order(client, quantity=2).json()
    assert order["status"] == "pending" and order["total"] == 1350 and order["number"].startswith("LTC-")
    assert stock(client)["vanilla-cake"] == before  # nothing taken until paid

    rp = pay(client, order)
    assert rp["amount"] == 135000
    assert stock(client)["vanilla-cake"] == before - 2

    # Verifying the same payment again (or the webhook arriving) must not double-process.
    again = client.post(
        "/api/payments/verify",
        json={"razorpay_order_id": rp["razorpayOrderId"], "razorpay_payment_id": rp["paymentId"],
              "razorpay_signature": sign(rp["razorpayOrderId"], rp["paymentId"])},
    )
    assert again.status_code == 200
    body = json.dumps({"event": "payment.captured", "payload": {"payment": {"entity": {
        "id": rp["paymentId"], "order_id": rp["razorpayOrderId"], "amount": 135000, "method": "upi"}}}}).encode()
    w = client.post("/api/payments/webhook", content=body, headers={"x-razorpay-signature": webhook_sig(body)})
    assert w.status_code == 200
    assert stock(client)["vanilla-cake"] == before - 2

    view = client.get(f"/api/orders/{order['number']}", params={"token": order["accessToken"]}).json()
    assert view["paymentStatus"] == "paid" and view["status"] == "confirmed"
    assert client.get(f"/api/orders/{order['number']}", params={"token": "wrong"}).status_code == 404

    # Already paid: no new gateway order.
    r = client.post("/api/payments/create-order", json={"orderId": order["id"], "accessToken": order["accessToken"]})
    assert r.status_code == 409


def test_retry_reuses_gateway_order(client):
    order = place_order(client).json()
    payload = {"orderId": order["id"], "accessToken": order["accessToken"]}
    a = client.post("/api/payments/create-order", json=payload).json()
    b = client.post("/api/payments/create-order", json=payload).json()
    assert a["razorpayOrderId"] == b["razorpayOrderId"]
    assert client.post("/api/payments/create-order", json={**payload, "accessToken": "nope"}).status_code == 404


def test_bad_signature_rejected(client):
    order = place_order(client).json()
    rp = client.post("/api/payments/create-order", json={"orderId": order["id"], "accessToken": order["accessToken"]}).json()
    r = client.post("/api/payments/verify", json={
        "razorpay_order_id": rp["razorpayOrderId"], "razorpay_payment_id": "pay_x", "razorpay_signature": "forged"})
    assert r.status_code == 400


def test_webhook_signature_failure_then_recovery(client):
    order = place_order(client).json()
    rp = client.post("/api/payments/create-order", json={"orderId": order["id"], "accessToken": order["accessToken"]}).json()
    oid = rp["razorpayOrderId"]

    body = b'{"event":"payment.captured"}'
    assert client.post("/api/payments/webhook", content=body, headers={"x-razorpay-signature": "bad"}).status_code == 400

    failed = json.dumps({"event": "payment.failed", "payload": {"payment": {"entity": {
        "id": "pay_fail1", "order_id": oid, "amount": 75000, "error_description": "Card declined"}}}}).encode()
    client.post("/api/payments/webhook", content=failed,
                headers={"x-razorpay-signature": webhook_sig(failed), "x-razorpay-event-id": "evt_1"})
    assert client.get(f"/api/orders/{order['number']}", params={"token": order["accessToken"]}).json()["paymentStatus"] == "failed"

    # Customer retries and succeeds; customer closed the tab, so only the webhook reports it.
    ok = json.dumps({"event": "payment.captured", "payload": {"payment": {"entity": {
        "id": "pay_ok1", "order_id": oid, "amount": 75000, "method": "card"}}}}).encode()
    headers = {"x-razorpay-signature": webhook_sig(ok), "x-razorpay-event-id": "evt_2"}
    assert client.post("/api/payments/webhook", content=ok, headers=headers).status_code == 200
    dup = client.post("/api/payments/webhook", content=ok, headers=headers).json()
    assert dup.get("duplicate") is True
    view = client.get(f"/api/orders/{order['number']}", params={"token": order["accessToken"]}).json()
    assert view["paymentStatus"] == "paid"


def test_webhook_amount_mismatch_ignored(client):
    order = place_order(client).json()
    rp = client.post("/api/payments/create-order", json={"orderId": order["id"], "accessToken": order["accessToken"]}).json()
    body = json.dumps({"event": "payment.captured", "payload": {"payment": {"entity": {
        "id": "pay_cheap", "order_id": rp["razorpayOrderId"], "amount": 100}}}}).encode()
    client.post("/api/payments/webhook", content=body, headers={"x-razorpay-signature": webhook_sig(body)})
    view = client.get(f"/api/orders/{order['number']}", params={"token": order["accessToken"]}).json()
    assert view["paymentStatus"] == "pending"


def test_oversell_is_flagged_not_lost(client):
    owner = admin_client()
    variant_id = next(v["id"] for v in owner.get("/api/admin/products").json()[0]["variants"] if v["slug"] == "vanilla-cake")
    owner.patch(f"/api/admin/variants/{variant_id}/stock", json={"stock": 1})
    a = place_order(client).json()
    b = place_order(client).json()  # both pass the stock check before either is paid
    pay(client, a)
    pay(client, b)
    detail = owner.get(f"/api/admin/orders/{b['id']}").json()
    assert detail["paymentStatus"] == "paid" and "out of stock" in detail["needsAttention"]
    assert stock(client)["vanilla-cake"] == 0


# --- COD --------------------------------------------------------------------


def test_cod_disabled_by_default(client):
    r = place_order(client, method="cod")
    assert r.status_code == 422 and "not available" in r.json()["detail"]


def test_cod_enabled_flow(client):
    owner = admin_client()
    owner.put("/api/admin/settings", json={"codEnabled": True, "codFee": 50, "codMaxOrderTotal": 2000, "shippingFee": 0})
    assert client.get("/api/products/cloud-mist").json()["cod"]["enabled"] is True
    before = stock(client)["vanilla-cake"]
    order = place_order(client, quantity=1, method="cod").json()
    assert order["paymentStatus"] == "cod_pending" and order["status"] == "confirmed" and order["total"] == 800
    assert stock(client)["vanilla-cake"] == before - 1
    big = place_order(client, quantity=3, method="cod")
    assert big.status_code == 422 and "up to" in big.json()["detail"]
    # Ship then deliver → cash collected.
    owner.patch(f"/api/admin/orders/{order['id']}/status", json={"status": "shipped", "tracking": "DTDC 123", "notifyCustomer": False})
    done = owner.patch(f"/api/admin/orders/{order['id']}/status", json={"status": "delivered"}).json()
    assert done["paymentStatus"] == "cod_collected"


# --- Admin ------------------------------------------------------------------


def test_admin_requires_auth_and_roles(client):
    assert client.get("/api/admin/orders").status_code == 401
    assert client.get("/api/admin/stats").status_code == 401
    bad = client.post("/api/admin/auth/login", json={"email": "owner@example.com", "password": "wrong"})
    assert bad.status_code == 401
    staff = admin_client("staff")
    assert staff.get("/api/admin/orders").status_code == 200
    assert staff.put("/api/admin/settings", json={"codEnabled": True}).status_code == 403
    assert staff.patch("/api/admin/variants/1/stock", json={"stock": 5}).status_code == 403
    # Customer sessions are not admin sessions.
    c = TestClient(app)
    c.post("/api/auth/signup", json={"name": "Eve", "email": "eve@example.com", "password": "password123"})
    assert c.get("/api/admin/orders").status_code == 401


def test_admin_login_rate_limited(client):
    for _ in range(5):
        client.post("/api/admin/auth/login", json={"email": "owner@example.com", "password": "wrong"})
    r = client.post("/api/admin/auth/login", json={"email": "owner@example.com", "password": "OwnerPass#2026"})
    assert r.status_code == 429


def test_admin_order_management_and_stats(client):
    owner = admin_client()
    order = place_order(client, quantity=2).json()
    pay(client, order)
    listing = owner.get("/api/admin/orders", params={"filter": "to_ship"}).json()
    assert listing["total"] == 1 and listing["orders"][0]["itemCount"] == 2
    assert owner.get("/api/admin/orders", params={"q": "asha"}).json()["total"] == 1

    bad = owner.patch(f"/api/admin/orders/{order['id']}/status", json={"status": "delivered"})
    assert bad.status_code == 422  # must ship first
    shipped = owner.patch(f"/api/admin/orders/{order['id']}/status",
                          json={"status": "shipped", "tracking": "Delhivery 99", "notifyCustomer": True}).json()
    assert shipped["status"] == "shipped" and shipped["tracking"] == "Delhivery 99"

    s = owner.get("/api/admin/stats").json()
    assert s["totalOrders"] == 1 and s["totalRevenue"] == 1350 and s["bottlesSold"] == 2
    assert len(s["daily"]) == 30 and s["daily"][-1]["revenue"] == 1350


def test_cancel_restocks(client):
    owner = admin_client()
    before = stock(client)["vanilla-cake"]
    order = place_order(client, quantity=3).json()
    pay(client, order)
    assert stock(client)["vanilla-cake"] == before - 3
    r = owner.patch(f"/api/admin/orders/{order['id']}/status", json={"status": "cancelled"}).json()
    assert r["status"] == "cancelled" and "refund" in r["needsAttention"].lower()
    assert stock(client)["vanilla-cake"] == before


def test_product_editing(client):
    owner = admin_client()
    p = owner.get("/api/admin/products").json()[0]
    payload = {**{k: p[k] for k in ("name", "tagline", "category", "description", "sizeLabel", "ageRange",
                                     "maxQtyPerOrder", "isActive", "multiUnitMinQty", "multiUnitPercent")},
               "price": 799, "compareAtPrice": 999,
               "variants": [{**{k: v[k] for k in ("id", "name", "scent", "description", "icon", "isActive",
                                                   "lowStockThreshold")}, "stock": 7 if v["slug"] == "fruit-punch" else v["stock"]}
                            for v in p["variants"]]}
    r = owner.put(f"/api/admin/products/{p['id']}", json=payload)
    assert r.status_code == 200, r.text
    public = client.get("/api/products/cloud-mist").json()
    assert public["price"] == 799 and public["compareAtPrice"] == 999
    assert {v["id"]: v["inStock"] for v in public["variants"]}["fruit-punch"] is True
    assert owner.put(f"/api/admin/products/{p['id']}", json={**payload, "compareAtPrice": 500}).status_code == 422


def test_image_upload_validation(client, monkeypatch):
    from app.services import cloudinary_service

    owner = admin_client()
    bad = owner.post("/api/admin/images/upload", data={"product_id": "1", "role": "hero"},
                     files={"file": ("x.png", b"not really a png", "image/png")})
    assert bad.status_code == 422
    exe = owner.post("/api/admin/images/upload", data={"product_id": "1"},
                     files={"file": ("x.exe", b"MZ\x90\x00", "application/octet-stream")})
    assert exe.status_code == 422

    monkeypatch.setattr(cloudinary_service, "upload", lambda data, folder: {
        "url": "https://res.cloudinary.com/demo/image/upload/v1/ltc/hero.png", "public_id": "ltc/hero",
        "width": 900, "height": 1350})
    deleted = []
    monkeypatch.setattr(cloudinary_service, "destroy", lambda pid: deleted.append(pid))
    png = b"\x89PNG\r\n\x1a\n" + b"\x00" * 64
    ok = owner.post("/api/admin/images/upload", data={"product_id": "1", "role": "hero", "alt": "Hero"},
                    files={"file": ("hero.png", png, "image/png")})
    assert ok.status_code == 201, ok.text
    image = ok.json()
    assert client.get("/api/products/cloud-mist").json()["images"][0]["url"].startswith("https://res.cloudinary.com")
    assert owner.delete(f"/api/admin/images/{image['id']}").status_code == 204
    assert deleted == ["ltc/hero"]
    staff = admin_client("staff")
    assert staff.post("/api/admin/images/upload", data={"product_id": "1"},
                      files={"file": ("hero.png", png, "image/png")}).status_code == 403


# --- Customer accounts ------------------------------------------------------


def test_customer_account_flow(client):
    guest_order = place_order(client).json()
    pay(client, guest_order)

    r = client.post("/api/auth/signup", json={"name": "Asha Kumar", "email": "ASHA@example.com", "password": "password123"})
    assert r.status_code == 201 and r.json()["email"] == "asha@example.com"
    assert client.get("/api/auth/me").json()["name"] == "Asha Kumar"
    # Earlier guest order with the same email shows in the account.
    assert [o["number"] for o in client.get("/api/account/orders").json()] == [guest_order["number"]]

    prof = client.put("/api/account/profile", json={"name": "Asha K", "phone": "9876543210", "address": "1 Lane",
                                                    "city": "Pune", "state": "Maharashtra", "pincode": "411001"})
    assert prof.json()["city"] == "Pune"
    assert client.put("/api/account/profile", json={"name": "Asha K", "pincode": "12"}).status_code == 422

    client.post("/api/auth/logout")
    assert client.get("/api/auth/me").json() is None
    assert client.get("/api/account/orders").status_code == 401
    assert client.post("/api/auth/signup", json={"name": "X", "email": "asha@example.com", "password": "password123"}).status_code in (409, 422)
    assert client.post("/api/auth/login", json={"email": "asha@example.com", "password": "nope"}).status_code == 401
    assert client.post("/api/auth/login", json={"email": "asha@example.com", "password": "password123"}).status_code == 200


def test_login_rate_limit(client):
    client.post("/api/auth/signup", json={"name": "Ravi", "email": "ravi@example.com", "password": "password123"})
    codes = [client.post("/api/auth/login", json={"email": "ravi@example.com", "password": "bad"}).status_code
             for _ in range(9)]
    assert codes[:8] == [401] * 8 and codes[8] == 429


def test_password_reset(client, monkeypatch):
    from app.services import email

    sent = {}
    monkeypatch.setattr(email, "send_password_reset", lambda to, name, link: sent.update(link=link))
    client.post("/api/auth/signup", json={"name": "Meera", "email": "meera@example.com", "password": "password123"})
    client.post("/api/auth/logout")
    assert client.post("/api/auth/forgot-password", json={"email": "meera@example.com"}).status_code == 202
    assert client.post("/api/auth/forgot-password", json={"email": "nobody@example.com"}).status_code == 202
    token = sent["link"].split("token=")[1]
    assert client.post("/api/auth/reset-password", json={"token": token, "password": "newpassword1"}).status_code == 200
    assert client.post("/api/auth/reset-password", json={"token": token, "password": "another123"}).status_code == 400
    client.post("/api/auth/logout")
    assert client.post("/api/auth/login", json={"email": "meera@example.com", "password": "newpassword1"}).status_code == 200
