"""Password hashing (Argon2id), session JWTs in HttpOnly cookies, and token helpers."""

from __future__ import annotations

import hashlib
import secrets
from datetime import UTC, datetime, timedelta

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError
from fastapi import Response

from app.config import get_settings

_hasher = PasswordHasher()

CUSTOMER_COOKIE = "ltc_session"
ADMIN_COOKIE = "ltc_admin"
CUSTOMER_SESSION_DAYS = 30
ADMIN_SESSION_HOURS = 12

# Verifying against this keeps login timing the same whether or not the email exists.
_DUMMY_HASH = _hasher.hash("timing-equaliser")


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password_hash: str | None, password: str) -> bool:
    try:
        return _hasher.verify(password_hash or _DUMMY_HASH, password) and password_hash is not None
    except (VerificationError, InvalidHashError):
        return False


def needs_rehash(password_hash: str) -> bool:
    return _hasher.check_needs_rehash(password_hash)


def _secret() -> str:
    secret = get_settings().jwt_secret_key
    if not secret:
        # Development only; production refuses to start without JWT_SECRET_KEY (see config.py).
        secret = "dev-insecure-secret-change-me-dev-insecure-secret"
    return secret


def create_token(subject: int, kind: str, lifetime: timedelta) -> str:
    now = datetime.now(UTC)
    payload = {"sub": str(subject), "kind": kind, "iat": now, "exp": now + lifetime}
    return jwt.encode(payload, _secret(), algorithm="HS256")


def read_token(token: str | None, kind: str) -> int | None:
    if not token:
        return None
    try:
        payload = jwt.decode(token, _secret(), algorithms=["HS256"], options={"require": ["exp", "sub"]})
    except jwt.PyJWTError:
        return None
    if payload.get("kind") != kind:
        return None
    try:
        return int(payload["sub"])
    except (TypeError, ValueError):
        return None


def set_session_cookie(response: Response, name: str, token: str, max_age: int) -> None:
    settings = get_settings()
    response.set_cookie(
        name,
        token,
        max_age=max_age,
        httponly=True,
        secure=settings.is_production or settings.frontend_url.startswith("https://"),
        samesite="lax",
        path="/",
    )


def clear_session_cookie(response: Response, name: str) -> None:
    response.delete_cookie(name, path="/")


def new_secret_token() -> tuple[str, str]:
    """Returns (token for the user, sha256 hash to store)."""
    token = secrets.token_urlsafe(32)
    return token, hashlib.sha256(token.encode()).hexdigest()


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()
