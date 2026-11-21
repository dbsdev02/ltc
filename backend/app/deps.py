"""Request dependencies: database session, current customer, current admin + roles."""

from __future__ import annotations

from collections.abc import Callable
from typing import Annotated

from fastapi import Cookie, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import AdminUser, Customer
from app.services.security import ADMIN_COOKIE, CUSTOMER_COOKIE, read_token

DB = Annotated[Session, Depends(get_db)]


def optional_customer(db: DB, ltc_session: Annotated[str | None, Cookie()] = None) -> Customer | None:
    customer_id = read_token(ltc_session, "customer")
    return db.get(Customer, customer_id) if customer_id else None


def require_customer(customer: Annotated[Customer | None, Depends(optional_customer)]) -> Customer:
    if customer is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Please log in.")
    return customer


def current_admin(db: DB, ltc_admin: Annotated[str | None, Cookie()] = None) -> AdminUser:
    admin_id = read_token(ltc_admin, "admin")
    admin = db.get(AdminUser, admin_id) if admin_id else None
    if admin is None or not admin.is_active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Admin login required.")
    return admin


def require_role(*roles: str) -> Callable[..., AdminUser]:
    def checker(admin: Annotated[AdminUser, Depends(current_admin)]) -> AdminUser:
        if admin.role not in roles:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "You don't have permission to do this.")
        return admin

    return checker


OptionalCustomer = Annotated[Customer | None, Depends(optional_customer)]
CurrentCustomer = Annotated[Customer, Depends(require_customer)]
AnyAdmin = Annotated[AdminUser, Depends(require_role("owner", "staff"))]
OwnerAdmin = Annotated[AdminUser, Depends(require_role("owner"))]

# Re-exported for routes that only need the cookie names.
__all__ = ["ADMIN_COOKIE", "CUSTOMER_COOKIE", "DB", "OptionalCustomer", "CurrentCustomer", "AnyAdmin", "OwnerAdmin"]
