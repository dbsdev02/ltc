"""Settings come only from environment variables (Vercel → Settings → Environment Variables)."""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path


def _list(value: str) -> list[str]:
    return [item.strip().rstrip("/") for item in value.split(",") if item.strip()]


@dataclass(frozen=True)
class Settings:
    database_url: str = ""
    razorpay_key_id: str = ""
    razorpay_key_secret: str = ""
    razorpay_webhook_secret: str = ""
    cloudinary_cloud_name: str = ""
    cloudinary_api_key: str = ""
    cloudinary_api_secret: str = ""
    cloudinary_folder: str = "little-todds-club"
    jwt_secret_key: str = ""
    frontend_url: str = "http://localhost:5173"
    allowed_origins: list[str] = field(default_factory=list)
    resend_api_key: str = ""
    email_from: str = "Little Todds Club <orders@littletodds.club>"
    notify_email: str = "littletoddsclub@gmail.com"
    environment: str = "development"

    @property
    def is_production(self) -> bool:
        return self.environment == "production"

    @property
    def razorpay_configured(self) -> bool:
        return bool(self.razorpay_key_id and self.razorpay_key_secret)

    @property
    def cloudinary_configured(self) -> bool:
        return bool(self.cloudinary_cloud_name and self.cloudinary_api_key and self.cloudinary_api_secret)


def _load_local_env() -> None:
    """Local development only: read backend/.env (Vercel injects real environment variables)."""
    if os.environ.get("VERCEL"):
        return
    path = Path(__file__).resolve().parent.parent / ".env"
    if not path.is_file():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


@lru_cache
def get_settings() -> Settings:
    _load_local_env()
    env = os.environ.get
    environment = env("ENVIRONMENT") or ("production" if env("VERCEL_ENV") == "production" else "development")
    settings = Settings(
        database_url=env("DATABASE_URL", ""),
        razorpay_key_id=env("RAZORPAY_KEY_ID", ""),
        razorpay_key_secret=env("RAZORPAY_KEY_SECRET", ""),
        razorpay_webhook_secret=env("RAZORPAY_WEBHOOK_SECRET", ""),
        cloudinary_cloud_name=env("CLOUDINARY_CLOUD_NAME", ""),
        cloudinary_api_key=env("CLOUDINARY_API_KEY", ""),
        cloudinary_api_secret=env("CLOUDINARY_API_SECRET", ""),
        cloudinary_folder=env("CLOUDINARY_FOLDER", "little-todds-club"),
        jwt_secret_key=env("JWT_SECRET_KEY", ""),
        frontend_url=(env("FRONTEND_URL") or "http://localhost:5173").rstrip("/"),
        allowed_origins=_list(env("ALLOWED_ORIGINS", "")),
        resend_api_key=env("RESEND_API_KEY", ""),
        email_from=env("EMAIL_FROM") or Settings.email_from,
        notify_email=env("NOTIFY_EMAIL") or Settings.notify_email,
        environment=environment,
    )
    if settings.is_production and len(settings.jwt_secret_key) < 32:
        raise RuntimeError("JWT_SECRET_KEY must be set to at least 32 random characters in production.")
    return settings
