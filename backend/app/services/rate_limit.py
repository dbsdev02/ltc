"""Fixed-window rate limiting stored in Postgres (serverless instances share no memory)."""

from __future__ import annotations

import hashlib
import time

from fastapi import HTTPException, Request, status
from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models import RateLimitHit


def client_ip(request: Request) -> str:
    # Vercel sets x-forwarded-for; the first entry is the real client.
    forwarded = request.headers.get("x-forwarded-for", "")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def hit(db: Session, key: str, limit: int, window_seconds: int) -> bool:
    """Counts one hit; returns False when the limit for this window is exceeded."""
    hashed = hashlib.sha256(key.encode()).hexdigest()
    now = int(time.time())
    window = now - now % window_seconds
    row = db.scalar(select(RateLimitHit).where(RateLimitHit.key == hashed, RateLimitHit.window_start == window))
    if row is None:
        row = RateLimitHit(key=hashed, window_start=window, count=0)
        db.add(row)
        try:
            db.flush()
        except IntegrityError:  # another request created it first
            db.rollback()
            row = db.scalar(
                select(RateLimitHit).where(RateLimitHit.key == hashed, RateLimitHit.window_start == window)
            )
            assert row is not None
    row.count += 1
    # Opportunistic cleanup of old windows.
    if row.count == 1:
        db.execute(delete(RateLimitHit).where(RateLimitHit.window_start < now - 86400))
    db.commit()
    return row.count <= limit


def enforce(db: Session, request: Request, scope: str, limit: int, window_seconds: int, extra: str = "") -> None:
    if not hit(db, f"{scope}|{client_ip(request)}|{extra}", limit, window_seconds):
        raise HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many attempts. Please wait a few minutes and try again.",
        )


def reset(db: Session, request: Request, scope: str, extra: str = "") -> None:
    hashed = hashlib.sha256(f"{scope}|{client_ip(request)}|{extra}".encode()).hexdigest()
    db.execute(delete(RateLimitHit).where(RateLimitHit.key == hashed))
    db.commit()
