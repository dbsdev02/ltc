"""Public catalog + cart quote."""

from __future__ import annotations

from fastapi import APIRouter, Response
from sqlalchemy import select

from app.deps import DB
from app.models import Product, StoreSettings
from app.schemas import (
    CodOut,
    ImageOut,
    MultiUnitDiscountOut,
    ProductOut,
    QuoteIn,
    QuoteOut,
    ShippingOut,
    VariantOut,
)
from app.services.orders import get_product, resolve_lines, store_settings
from app.services.pricing import build_quote

router = APIRouter(prefix="/api", tags=["products"])


def product_out(product: Product, settings: StoreSettings) -> ProductOut:
    slug_by_id = {v.id: v.slug for v in product.variants}
    variants = []
    for v in product.variants:
        if not v.is_active:
            continue
        threshold = v.inventory.low_stock_threshold if v.inventory else 0
        variants.append(
            VariantOut(
                id=v.slug,
                sku=v.sku,
                name=v.name,
                scent=v.scent,
                description=v.description,
                icon=v.icon,
                price=v.effective_price,
                in_stock=v.stock > 0,
                stock_left=v.stock if 0 < v.stock <= threshold else None,
            )
        )
    discount = (
        MultiUnitDiscountOut(min_quantity=product.multi_unit_min_qty, percent=product.multi_unit_percent)
        if product.multi_unit_min_qty and product.multi_unit_percent
        else None
    )
    return ProductOut(
        id=product.slug,
        name=product.name,
        tagline=product.tagline,
        category=product.category,
        description=product.description,
        size=product.size_label,
        age_range=product.age_range,
        price=product.price,
        compare_at_price=product.compare_at_price,
        multi_unit_discount=discount,
        max_quantity=product.max_qty_per_order,
        variants=variants,
        images=[
            ImageOut(
                id=i.id,
                role=i.role,
                url=i.url,
                alt=i.alt,
                width=i.width,
                height=i.height,
                variant_id=slug_by_id.get(i.variant_id) if i.variant_id else None,
            )
            for i in product.images
        ],
        shipping=ShippingOut(fee=settings.shipping_fee, free_shipping_min=settings.free_shipping_min),
        cod=CodOut(
            enabled=settings.cod_enabled, fee=settings.cod_fee, max_order_total=settings.cod_max_order_total
        ),
    )


def _short_cache(response: Response) -> None:
    # Edge-cache briefly so traffic spikes don't hit the database, while stock stays fresh.
    response.headers["Cache-Control"] = "public, max-age=0, s-maxage=30, stale-while-revalidate=60"


@router.get("/products", response_model=list[ProductOut])
def list_products(db: DB, response: Response):
    _short_cache(response)
    settings = store_settings(db)
    slugs = db.scalars(select(Product.slug).where(Product.is_active.is_(True)).order_by(Product.id)).all()
    return [product_out(get_product(db, slug), settings) for slug in slugs]


@router.get("/products/{slug}", response_model=ProductOut)
def read_product(slug: str, db: DB, response: Response):
    _short_cache(response)
    return product_out(get_product(db, slug), store_settings(db))


@router.post("/cart/quote", response_model=QuoteOut)
def quote(payload: QuoteIn, db: DB):
    product = get_product(db, payload.product_id)
    lines = resolve_lines(product, [(line.variant_id, line.quantity) for line in payload.lines])
    q = build_quote(product, lines, store_settings(db), payload.payment_method)
    return QuoteOut(
        quantity=q.quantity, subtotal=q.subtotal, discount=q.discount, shipping=q.shipping, cod_fee=q.cod_fee, total=q.total
    )
