"""Checkout: create orders (Razorpay or COD) and view an order."""

from __future__ import annotations

import secrets

from fastapi import APIRouter, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.deps import DB, OptionalCustomer
from app.models import Address, Order
from app.schemas import OrderCreatedOut, OrderCreateIn, OrderOut
from app.services import orders as order_service
from app.services import rate_limit

router = APIRouter(prefix="/api", tags=["orders"])


@router.post("/orders", response_model=OrderCreatedOut, status_code=status.HTTP_201_CREATED)
def create_order(payload: OrderCreateIn, request: Request, db: DB, customer: OptionalCustomer):
    rate_limit.enforce(db, request, "create-order", limit=20, window_seconds=600)
    details = payload.customer
    order = order_service.create_order(
        db,
        product_slug=payload.product_id,
        raw_lines=[(line.variant_id, line.quantity) for line in payload.lines],
        customer_fields={
            "email": details.email or "",
            "name": details.name,
            "phone": details.phone,
            "address": details.address,
            "city": details.city,
            "state": details.state,
            "pincode": details.pincode,
            "notes": details.notes,
        },
        payment_method=payload.payment_method,
        customer=customer,
    )
    # Logged-in customers: remember the delivery address if none is saved yet.
    if customer and not customer.addresses:
        customer.addresses.append(
            Address(
                name=details.name,
                phone=details.phone,
                line1=details.address,
                city=details.city,
                state=details.state,
                pincode=details.pincode,
                is_default=True,
            )
        )
        if not customer.phone:
            customer.phone = details.phone
        db.commit()
    db.refresh(order)
    return order


@router.get("/orders/{number}", response_model=OrderOut)
def read_order(number: str, db: DB, customer: OptionalCustomer, token: str = ""):
    order = db.scalar(select(Order).where(Order.number == number).options(selectinload(Order.items)))
    allowed = order is not None and (
        (token and secrets.compare_digest(token, order.access_token))
        or (customer is not None and (order.customer_id == customer.id or (order.email != "" and order.email == customer.email)))
    )
    if not allowed:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Order not found.")
    return order
