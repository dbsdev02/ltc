"""Customer accounts: signup, login, logout, profile, order history, password reset."""

from __future__ import annotations

import re
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, HTTPException, Request, Response, status
from sqlalchemy import func, or_, select, update
from sqlalchemy.orm import selectinload

from app.config import get_settings
from app.deps import DB, CurrentCustomer, OptionalCustomer
from app.models import Address, Customer, Order
from app.schemas import CustomerOut, ForgotIn, LoginIn, OrderOut, PHONE_RE, PINCODE_RE, ProfileIn, ResetIn, SignupIn
from app.services import email, rate_limit
from app.services.security import (
    CUSTOMER_COOKIE,
    CUSTOMER_SESSION_DAYS,
    clear_session_cookie,
    create_token,
    hash_password,
    hash_token,
    needs_rehash,
    new_secret_token,
    set_session_cookie,
    verify_password,
)

router = APIRouter(prefix="/api", tags=["customer accounts"])


def customer_out(c: Customer) -> CustomerOut:
    address = next((a for a in c.addresses if a.is_default), c.addresses[0] if c.addresses else None)
    return CustomerOut(
        id=c.id,
        email=c.email,
        name=c.name,
        phone=c.phone,
        address=address.line1 if address else "",
        city=address.city if address else "",
        state=address.state if address else "",
        pincode=address.pincode if address else "",
    )


def _log_in(response: Response, customer: Customer) -> None:
    token = create_token(customer.id, "customer", timedelta(days=CUSTOMER_SESSION_DAYS))
    set_session_cookie(response, CUSTOMER_COOKIE, token, CUSTOMER_SESSION_DAYS * 86400)


@router.post("/auth/signup", response_model=CustomerOut, status_code=status.HTTP_201_CREATED)
def signup(payload: SignupIn, request: Request, response: Response, db: DB):
    rate_limit.enforce(db, request, "signup", limit=10, window_seconds=3600)
    email_addr = payload.email.lower()
    if db.scalar(select(Customer.id).where(func.lower(Customer.email) == email_addr)):
        raise HTTPException(status.HTTP_409_CONFLICT, "An account with this email already exists. Please log in.")
    customer = Customer(email=email_addr, password_hash=hash_password(payload.password), name=payload.name, phone=payload.phone)
    db.add(customer)
    db.flush()
    # Earlier guest orders placed with this email now show in the account.
    db.execute(update(Order).where(Order.customer_id.is_(None), func.lower(Order.email) == email_addr).values(customer_id=customer.id))
    db.commit()
    _log_in(response, customer)
    return customer_out(customer)


@router.post("/auth/login", response_model=CustomerOut)
def login(payload: LoginIn, request: Request, response: Response, db: DB):
    email_addr = payload.email.lower()
    rate_limit.enforce(db, request, "login", limit=8, window_seconds=900, extra=email_addr)
    customer = db.scalar(
        select(Customer).where(func.lower(Customer.email) == email_addr).options(selectinload(Customer.addresses))
    )
    if not verify_password(customer.password_hash if customer else None, payload.password) or customer is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Wrong email or password.")
    if needs_rehash(customer.password_hash):
        customer.password_hash = hash_password(payload.password)
    db.commit()
    rate_limit.reset(db, request, "login", extra=email_addr)
    _log_in(response, customer)
    return customer_out(customer)


@router.post("/auth/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(response: Response):
    clear_session_cookie(response, CUSTOMER_COOKIE)


@router.get("/auth/me", response_model=CustomerOut | None)
def me(customer: OptionalCustomer):
    return customer_out(customer) if customer else None


@router.put("/account/profile", response_model=CustomerOut)
def update_profile(payload: ProfileIn, customer: CurrentCustomer, db: DB):
    if payload.phone and not re.match(PHONE_RE, payload.phone):
        raise HTTPException(422, "Please enter a valid 10-digit Indian mobile number.")
    if payload.pincode and not re.match(PINCODE_RE, payload.pincode):
        raise HTTPException(422, "Please enter a valid 6-digit PIN code.")
    customer.name = payload.name
    customer.phone = payload.phone
    if payload.address or payload.city or payload.state or payload.pincode:
        address = next((a for a in customer.addresses if a.is_default), None)
        if address is None:
            address = Address(customer_id=customer.id, is_default=True, line1="", city="", state="", pincode="")
            customer.addresses.append(address)
        address.name, address.phone = payload.name, payload.phone
        address.line1, address.city = payload.address, payload.city
        address.state, address.pincode = payload.state, payload.pincode
    if payload.new_password:
        if not verify_password(customer.password_hash, payload.current_password):
            raise HTTPException(422, "Your current password is not correct.")
        if len(payload.new_password) < 8:
            raise HTTPException(422, "New password must be at least 8 characters.")
        customer.password_hash = hash_password(payload.new_password)
    db.commit()
    return customer_out(customer)


@router.get("/account/orders", response_model=list[OrderOut])
def my_orders(customer: CurrentCustomer, db: DB):
    return db.scalars(
        select(Order)
        .where(
            or_(Order.customer_id == customer.id, func.lower(Order.email) == customer.email),
            or_(Order.payment_status.in_(("paid", "cod_pending", "cod_collected", "refunded")), Order.status == "cancelled"),
        )
        .options(selectinload(Order.items))
        .order_by(Order.id.desc())
        .limit(100)
    ).all()


@router.post("/auth/forgot-password", status_code=status.HTTP_202_ACCEPTED)
def forgot_password(payload: ForgotIn, request: Request, db: DB):
    rate_limit.enforce(db, request, "forgot", limit=5, window_seconds=3600)
    customer = db.scalar(select(Customer).where(func.lower(Customer.email) == payload.email.lower()))
    # Same response whether or not the account exists, so emails can't be probed.
    if customer:
        token, token_hash = new_secret_token()
        customer.reset_token_hash = token_hash
        customer.reset_expires_at = datetime.now(UTC) + timedelta(hours=1)
        db.commit()
        email.send_password_reset(
            customer.email, customer.name, f"{get_settings().frontend_url}/reset-password?token={token}"
        )
    return {"ok": True}


@router.post("/auth/reset-password", response_model=CustomerOut)
def reset_password(payload: ResetIn, request: Request, response: Response, db: DB):
    rate_limit.enforce(db, request, "reset", limit=10, window_seconds=3600)
    customer = db.scalar(
        select(Customer)
        .where(Customer.reset_token_hash == hash_token(payload.token))
        .options(selectinload(Customer.addresses))
    )
    expires = customer.reset_expires_at if customer else None
    if expires is not None and expires.tzinfo is None:  # SQLite returns naive datetimes
        expires = expires.replace(tzinfo=UTC)
    if customer is None or expires is None or expires < datetime.now(UTC):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "This reset link has expired. Please request a new one.")
    customer.password_hash = hash_password(payload.password)
    customer.reset_token_hash = None
    customer.reset_expires_at = None
    db.commit()
    _log_in(response, customer)
    return customer_out(customer)
