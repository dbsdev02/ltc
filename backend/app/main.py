"""Little Todds Club API. Vercel finds `app` here (see [tool.vercel] in pyproject.toml)."""

from __future__ import annotations

import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text

from app.config import get_settings
from app.database import get_engine
from app.routes import admin, auth, orders, payments, products

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("ltc")

settings = get_settings()

app = FastAPI(
    title="Little Todds Club API",
    version="1.0.0",
    docs_url=None if settings.is_production else "/api/docs",
    redoc_url=None,
    openapi_url=None if settings.is_production else "/api/openapi.json",
)

# The React app calls the API through a same-origin /api rewrite, so CORS is only
# needed for local development or a separately hosted frontend listed in ALLOWED_ORIGINS.
origins = settings.allowed_origins or ([settings.frontend_url] if not settings.is_production else [])
if origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
        allow_headers=["content-type"],
        max_age=600,
    )


@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
    response.headers.setdefault("X-Frame-Options", "DENY")
    if request.url.path.startswith(("/api/admin", "/api/auth", "/api/account", "/api/orders", "/api/payments")):
        response.headers["Cache-Control"] = "no-store"
    return response


_FIELD_LABELS = {"pincode": "PIN code", "phone": "mobile number", "email": "email"}


@app.exception_handler(RequestValidationError)
async def validation_error(_: Request, exc: RequestValidationError):
    """Turns pydantic errors into one readable sentence plus per-field details."""
    errors = []
    for err in exc.errors():
        field = str(err["loc"][-1]) if err.get("loc") else ""
        message = str(err.get("msg", "Invalid value")).removeprefix("Value error, ")
        if err.get("type") == "string_pattern_mismatch":
            message = f"Please enter a valid {_FIELD_LABELS.get(field, field)}."
        errors.append({"field": field, "message": message})
    first = errors[0]["message"] if errors else "Please check your details."
    return JSONResponse(status_code=422, content={"detail": first, "errors": errors})


@app.exception_handler(Exception)
async def unhandled_error(request: Request, exc: Exception):
    log.exception("Unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(status_code=500, content={"detail": "Something went wrong. Please try again."})


for module in (products, auth, orders, payments, admin):
    app.include_router(module.router)


@app.get("/api/health")
def health():
    """Setup check: which integrations are configured (never secret values)."""
    db_ok = True
    try:
        with get_engine().connect() as conn:
            conn.execute(text("SELECT 1"))
    except Exception:
        log.exception("Database health check failed")
        db_ok = False
    s = get_settings()
    return {
        "ok": db_ok,
        "database": db_ok,
        "razorpay": s.razorpay_configured,
        "razorpayMode": "live" if s.razorpay_key_id.startswith("rzp_live_") else ("test" if s.razorpay_key_id else None),
        "webhookSecret": bool(s.razorpay_webhook_secret),
        "cloudinary": s.cloudinary_configured,
        "email": bool(s.resend_api_key),
        "environment": s.environment,
    }
