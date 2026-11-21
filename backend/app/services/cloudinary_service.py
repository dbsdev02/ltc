"""Server-side Cloudinary uploads. API secret stays on the server; the browser only sees secure URLs."""

from __future__ import annotations

import cloudinary
import cloudinary.uploader

from app.config import get_settings

MAX_IMAGE_BYTES = 4 * 1024 * 1024  # Vercel request bodies are capped at 4.5 MB.

_SIGNATURES = {
    "image/jpeg": [b"\xff\xd8\xff"],
    "image/png": [b"\x89PNG\r\n\x1a\n"],
    "image/webp": [b"RIFF"],
    "image/avif": [b"ftypavif", b"ftypavis"],
}


class ImageError(Exception):
    pass


def validate_image(data: bytes, content_type: str) -> None:
    if not data:
        raise ImageError("The file is empty.")
    if len(data) > MAX_IMAGE_BYTES:
        raise ImageError("Images must be 4 MB or smaller.")
    signatures = _SIGNATURES.get(content_type)
    if not signatures:
        raise ImageError("Only JPG, PNG, WebP or AVIF images are allowed.")
    head = data[:32]
    ok = any(
        head.startswith(sig) if content_type != "image/avif" else sig in head for sig in signatures
    ) and (content_type != "image/webp" or head[8:12] == b"WEBP")
    if not ok:
        raise ImageError("The file content doesn't match its image type.")


def _configure() -> None:
    s = get_settings()
    if not s.cloudinary_configured:
        raise ImageError("Cloudinary is not configured. Add the CLOUDINARY_* environment variables.")
    cloudinary.config(
        cloud_name=s.cloudinary_cloud_name,
        api_key=s.cloudinary_api_key,
        api_secret=s.cloudinary_api_secret,
        secure=True,
    )


def upload(data: bytes, subfolder: str) -> dict:
    _configure()
    result = cloudinary.uploader.upload(
        data,
        folder=f"{get_settings().cloudinary_folder}/{subfolder}",
        resource_type="image",
        unique_filename=True,
        overwrite=False,
    )
    return {
        "url": result["secure_url"],
        "public_id": result["public_id"],
        "width": result.get("width"),
        "height": result.get("height"),
    }


def destroy(public_id: str) -> None:
    _configure()
    cloudinary.uploader.destroy(public_id, resource_type="image", invalidate=True)
