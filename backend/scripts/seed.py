"""Creates the Cloud Mist product, its variants, stock, store settings and the owner admin.

Safe to run repeatedly: existing rows are left as they are (it never overwrites prices or stock).

    cd backend
    python -m scripts.seed                                   # product + settings
    python -m scripts.seed --admin-email you@example.com     # …and an owner admin (asks for a password)
"""

from __future__ import annotations

import argparse
import getpass
import os
import sys
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.database import get_engine
from app.models import AdminUser, Inventory, Product, ProductVariant, StoreSettings
from app.services.security import hash_password

PRODUCT = {
    "slug": "cloud-mist",
    "name": "Cloud Mist",
    "tagline": "A little mist. A lot of magic.",
    "category": "Toddler Skin & Hair Mist",
    "description": (
        "A gentle, moisturising skin & hair mist made especially for little ones who want to smell as lovely "
        "as they feel. Made with fractionated coconut oil, Vitamin E and lots of love — and completely alcohol-free."
    ),
    "size_label": "25 ml",
    "age_range": "2 to 9 years",
    "price": Decimal("750.00"),
    "compare_at_price": None,
    "multi_unit_min_qty": 2,
    "multi_unit_percent": Decimal("10.00"),
    "max_qty_per_order": 10,
}

VARIANTS = [
    {
        "slug": "vanilla-cake",
        "sku": "LTC-CM-VAN-25",
        "name": "Vanilla Cake",
        "scent": "Smells like Vanilla Cake",
        "description": "Warm, sweet and cosy — like a slice of birthday cake fresh from the oven.",
        "icon": "🧁",
        "sort_order": 0,
        "stock": 50,
    },
    {
        "slug": "fruit-punch",
        "sku": "LTC-CM-FRP-25",
        "name": "Fruit Punch",
        "scent": "Smells like Fruit Punch",
        "description": "Bright, juicy and playful — a happy splash of orange, apple and pineapple.",
        "icon": "🍹",
        "sort_order": 1,
        "stock": 0,  # sold out for now
    },
]


def seed_catalog(db: Session) -> None:
    product = db.scalar(select(Product).where(Product.slug == PRODUCT["slug"]))
    if product is None:
        product = Product(**PRODUCT)
        db.add(product)
        db.flush()
        print(f"Created product {product.name}")
    existing = {v.slug for v in product.variants}
    for data in VARIANTS:
        if data["slug"] in existing:
            continue
        stock = data["stock"]
        variant = ProductVariant(product_id=product.id, **{k: v for k, v in data.items() if k != "stock"})
        variant.inventory = Inventory(quantity=stock, low_stock_threshold=10)
        db.add(variant)
        print(f"Created variant {data['name']} (stock {stock})")
    if db.get(StoreSettings, 1) is None:
        db.add(StoreSettings(id=1, shipping_fee=Decimal("0"), cod_enabled=False, cod_fee=Decimal("0")))
        print("Created store settings (free shipping, COD off)")
    db.commit()


def seed_admin(db: Session, email: str, password: str | None, role: str) -> None:
    email = email.strip().lower()
    admin = db.scalar(select(AdminUser).where(func.lower(AdminUser.email) == email))
    if password is None:
        password = os.environ.get("ADMIN_PASSWORD") or getpass.getpass(f"Password for {email} (12+ characters): ")
    if len(password) < 12:
        sys.exit("Admin passwords must be at least 12 characters.")
    if admin is None:
        db.add(AdminUser(email=email, password_hash=hash_password(password), name=email.split("@")[0], role=role))
        print(f"Created {role} admin {email}")
    else:
        admin.password_hash = hash_password(password)
        admin.role = role
        admin.is_active = True
        print(f"Updated password for admin {email}")
    db.commit()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--admin-email")
    parser.add_argument("--role", choices=["owner", "staff"], default="owner")
    args = parser.parse_args()
    with Session(get_engine()) as db:
        seed_catalog(db)
        if args.admin_email:
            seed_admin(db, args.admin_email, None, args.role)


if __name__ == "__main__":
    main()
