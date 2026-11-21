"""Admin API. Every route requires an admin session; owner-only routes are marked with OwnerAdmin."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from zoneinfo import ZoneInfo
from decimal import Decimal
from typing import Literal

from fastapi import APIRouter, File, Form, HTTPException, Request, Response, UploadFile, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import selectinload

from app.deps import DB, AnyAdmin, OwnerAdmin
from app.models import AdminUser, Inventory, Order, OrderItem, Product, ProductImage, ProductVariant
from app.schemas import (
    AdminImageOut,
    AdminLoginIn,
    AdminOrderDetail,
    AdminOrderList,
    AdminOrderListItem,
    AdminOut,
    AdminProductIn,
    AdminProductOut,
    AdminVariantOut,
    DailySales,
    ImageUpdateIn,
    SettingsIn,
    SettingsOut,
    StatsOut,
    StatusUpdateIn,
    StockAdjustIn,
)
from app.services import cloudinary_service, rate_limit
from app.services import orders as order_service
from app.services.security import (
    ADMIN_COOKIE,
    ADMIN_SESSION_HOURS,
    clear_session_cookie,
    create_token,
    hash_password,
    needs_rehash,
    set_session_cookie,
    verify_password,
)

router = APIRouter(prefix="/api/admin", tags=["admin"])

PAID_STATES = ("paid", "cod_pending", "cod_collected")
IST = ZoneInfo("Asia/Kolkata")


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------


@router.post("/auth/login", response_model=AdminOut)
def admin_login(payload: AdminLoginIn, request: Request, response: Response, db: DB):
    email_addr = payload.email.lower()
    rate_limit.enforce(db, request, "admin-login", limit=5, window_seconds=900, extra=email_addr)
    admin = db.scalar(select(AdminUser).where(func.lower(AdminUser.email) == email_addr))
    if not verify_password(admin.password_hash if admin else None, payload.password) or not admin or not admin.is_active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Wrong email or password.")
    if needs_rehash(admin.password_hash):
        admin.password_hash = hash_password(payload.password)
    admin.last_login_at = datetime.now(UTC)
    db.commit()
    rate_limit.reset(db, request, "admin-login", extra=email_addr)
    token = create_token(admin.id, "admin", timedelta(hours=ADMIN_SESSION_HOURS))
    set_session_cookie(response, ADMIN_COOKIE, token, ADMIN_SESSION_HOURS * 3600)
    return admin


@router.post("/auth/logout", status_code=status.HTTP_204_NO_CONTENT)
def admin_logout(response: Response):
    clear_session_cookie(response, ADMIN_COOKIE)


@router.get("/auth/me", response_model=AdminOut)
def admin_me(admin: AnyAdmin):
    return admin


# ---------------------------------------------------------------------------
# Dashboard & reports
# ---------------------------------------------------------------------------


@router.get("/stats", response_model=StatsOut)
def stats(admin: AnyAdmin, db: DB, days: int = 30):
    days = max(1, min(days, 365))
    count = lambda *where: db.scalar(select(func.count(Order.id)).where(*where)) or 0  # noqa: E731
    revenue = db.scalar(
        select(func.coalesce(func.sum(Order.total), 0)).where(
            Order.payment_status.in_(("paid", "cod_collected")), Order.status != "cancelled"
        )
    )
    bottles = db.scalar(
        select(func.coalesce(func.sum(OrderItem.quantity), 0))
        .join(Order)
        .where(Order.payment_status.in_(PAID_STATES), Order.status != "cancelled")
    )
    low = db.execute(
        select(ProductVariant.name, Inventory.quantity)
        .join(Inventory)
        .where(ProductVariant.is_active.is_(True), Inventory.quantity <= Inventory.low_stock_threshold)
    ).all()

    # Group by calendar day in India time, in Python so it behaves the same on Postgres and SQLite.
    today = datetime.now(IST).date()
    first_day = today - timedelta(days=days - 1)
    since = datetime.combine(first_day, datetime.min.time(), IST)
    rows = db.execute(
        select(Order.created_at, Order.total).where(
            Order.created_at >= since, Order.payment_status.in_(PAID_STATES), Order.status != "cancelled"
        )
    ).all()
    by_day: dict[str, list] = {}
    for created_at, total in rows:
        if created_at.tzinfo is None:  # SQLite returns naive UTC
            created_at = created_at.replace(tzinfo=UTC)
        bucket = by_day.setdefault(created_at.astimezone(IST).date().isoformat(), [0, Decimal("0")])
        bucket[0] += 1
        bucket[1] += Decimal(str(total))
    daily = []
    for i in range(days):
        key = (first_day + timedelta(days=i)).isoformat()
        n, t = by_day.get(key, (0, Decimal("0")))
        daily.append(DailySales(date=key, orders=n, revenue=t))

    return StatsOut(
        total_orders=count(Order.payment_status.in_(PAID_STATES)),
        total_revenue=Decimal(str(revenue or 0)),
        pending_orders=count(Order.status == "pending"),
        to_ship=count(Order.status == "confirmed"),
        completed_orders=count(Order.status == "delivered"),
        failed_payments=count(Order.payment_status == "failed"),
        cod_pending=count(Order.payment_status == "cod_pending", Order.status != "cancelled"),
        bottles_sold=int(bottles or 0),
        low_stock=[f"{name} (out of stock)" if qty == 0 else f"{name} ({qty} left)" for name, qty in low],
        needs_attention=count(Order.needs_attention != ""),
        daily=daily,
    )


# ---------------------------------------------------------------------------
# Orders
# ---------------------------------------------------------------------------

OrderFilter = Literal["all", "to_ship", "shipped", "delivered", "pending", "failed", "cod", "cancelled", "attention"]


@router.get("/orders", response_model=AdminOrderList)
def list_orders(admin: AnyAdmin, db: DB, filter: OrderFilter = "all", q: str = "", page: int = 1, page_size: int = 25):
    page, page_size = max(page, 1), max(1, min(page_size, 100))
    conditions = {
        "all": [Order.payment_status.in_(PAID_STATES) | (Order.status == "cancelled")],
        "to_ship": [Order.status == "confirmed"],
        "shipped": [Order.status == "shipped"],
        "delivered": [Order.status == "delivered"],
        "pending": [Order.status == "pending", Order.payment_status == "pending"],
        "failed": [Order.payment_status == "failed"],
        "cod": [Order.payment_method == "cod"],
        "cancelled": [Order.status == "cancelled"],
        "attention": [Order.needs_attention != ""],
    }[filter]
    if q.strip():
        like = f"%{q.strip().lower()}%"
        conditions.append(
            or_(
                func.lower(Order.number).like(like),
                func.lower(Order.email).like(like),
                func.lower(Order.name).like(like),
                Order.phone.like(like),
            )
        )
    total = db.scalar(select(func.count(Order.id)).where(*conditions)) or 0
    orders = db.scalars(
        select(Order)
        .where(*conditions)
        .options(selectinload(Order.items))
        .order_by(Order.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()
    return AdminOrderList(
        orders=[
            AdminOrderListItem(
                id=o.id,
                number=o.number or "",
                created_at=o.created_at,
                status=o.status,
                payment_status=o.payment_status,
                payment_method=o.payment_method,
                name=o.name,
                email=o.email,
                phone=o.phone,
                total=o.total,
                item_count=sum(i.quantity for i in o.items),
                needs_attention=o.needs_attention,
            )
            for o in orders
        ],
        total=total,
        page=page,
        page_size=page_size,
    )


def _detail(order: Order) -> AdminOrderDetail:
    data = AdminOrderDetail.model_validate(
        {
            **{c: getattr(order, c) for c in AdminOrderDetail.model_fields if c not in ("allowed_statuses",)},
            "allowed_statuses": sorted(order_service.ALLOWED_TRANSITIONS.get(order.status, set())),
        }
    )
    return data


def _load_order(db: DB, order_id: int) -> Order:
    order = db.scalar(
        select(Order).where(Order.id == order_id).options(selectinload(Order.items), selectinload(Order.payments))
    )
    if order is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Order not found.")
    return order


@router.get("/orders/{order_id}", response_model=AdminOrderDetail)
def order_detail(order_id: int, admin: AnyAdmin, db: DB):
    return _detail(_load_order(db, order_id))


@router.patch("/orders/{order_id}/status", response_model=AdminOrderDetail)
def update_order_status(order_id: int, payload: StatusUpdateIn, admin: AnyAdmin, db: DB):
    order = _load_order(db, order_id)
    if payload.clear_attention:
        order.needs_attention = ""
    order_service.change_status(db, order, payload.status, payload.tracking, payload.notify_customer)
    return _detail(_load_order(db, order_id))


# ---------------------------------------------------------------------------
# Products, stock & images (owner only)
# ---------------------------------------------------------------------------


def _product(db: DB, product_id: int) -> Product:
    product = db.scalar(
        select(Product)
        .where(Product.id == product_id)
        .options(selectinload(Product.variants).selectinload(ProductVariant.inventory), selectinload(Product.images))
    )
    if product is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Product not found.")
    return product


def _product_out(p: Product) -> AdminProductOut:
    return AdminProductOut(
        id=p.id,
        slug=p.slug,
        name=p.name,
        tagline=p.tagline,
        category=p.category,
        description=p.description,
        size_label=p.size_label,
        age_range=p.age_range,
        price=p.price,
        compare_at_price=p.compare_at_price,
        multi_unit_min_qty=p.multi_unit_min_qty,
        multi_unit_percent=p.multi_unit_percent,
        max_qty_per_order=p.max_qty_per_order,
        is_active=p.is_active,
        variants=[
            AdminVariantOut(
                id=v.id,
                slug=v.slug,
                sku=v.sku,
                name=v.name,
                scent=v.scent,
                description=v.description,
                icon=v.icon,
                price=v.price,
                sort_order=v.sort_order,
                is_active=v.is_active,
                stock=v.stock,
                low_stock_threshold=v.inventory.low_stock_threshold if v.inventory else 10,
            )
            for v in p.variants
        ],
        images=[AdminImageOut.model_validate(i) for i in p.images],
    )


@router.get("/products", response_model=list[AdminProductOut])
def admin_products(admin: AnyAdmin, db: DB):
    ids = db.scalars(select(Product.id).order_by(Product.id)).all()
    return [_product_out(_product(db, i)) for i in ids]


@router.put("/products/{product_id}", response_model=AdminProductOut)
def update_product(product_id: int, payload: AdminProductIn, admin: OwnerAdmin, db: DB):
    product = _product(db, product_id)
    if payload.compare_at_price is not None and payload.compare_at_price <= payload.price:
        raise HTTPException(422, "The 'was' price must be higher than the price.")
    if (payload.multi_unit_min_qty is None) != (payload.multi_unit_percent is None):
        raise HTTPException(422, "Set both the bottle count and percent for the multi-bottle discount, or neither.")
    for field in (
        "name", "tagline", "category", "description", "size_label", "age_range", "price",
        "compare_at_price", "multi_unit_min_qty", "multi_unit_percent", "max_qty_per_order", "is_active",
    ):
        setattr(product, field, getattr(payload, field))
    variants = {v.id: v for v in product.variants}
    for vin in payload.variants:
        variant = variants.get(vin.id)
        if variant is None:
            raise HTTPException(422, f"Unknown variant {vin.id}.")
        variant.name, variant.scent, variant.description = vin.name, vin.scent, vin.description
        variant.icon, variant.price, variant.is_active = vin.icon, vin.price, vin.is_active
        if variant.inventory is None:
            variant.inventory = Inventory(quantity=0)
        variant.inventory.quantity = vin.stock
        variant.inventory.low_stock_threshold = vin.low_stock_threshold
    db.commit()
    return _product_out(_product(db, product_id))


@router.patch("/variants/{variant_id}/stock", response_model=AdminVariantOut)
def set_stock(variant_id: int, payload: StockAdjustIn, admin: OwnerAdmin, db: DB):
    variant = db.get(ProductVariant, variant_id)
    if variant is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Variant not found.")
    if variant.inventory is None:
        variant.inventory = Inventory(quantity=0)
    variant.inventory.quantity = payload.stock
    db.commit()
    return next(v for v in _product_out(_product(db, variant.product_id)).variants if v.id == variant_id)


@router.post("/images/upload", response_model=AdminImageOut, status_code=status.HTTP_201_CREATED)
async def upload_image(
    admin: OwnerAdmin,
    db: DB,
    file: UploadFile = File(...),
    product_id: int = Form(...),
    role: Literal["hero", "gallery", "what_is", "scent_slide", "badge"] = Form("gallery"),
    alt: str = Form(""),
    variant_id: int | None = Form(None),
    replace_image_id: int | None = Form(None),
):
    product = _product(db, product_id)
    data = await file.read(cloudinary_service.MAX_IMAGE_BYTES + 1)
    try:
        cloudinary_service.validate_image(data, file.content_type or "")
    except cloudinary_service.ImageError as exc:
        raise HTTPException(422, str(exc)) from exc
    if variant_id is not None and variant_id not in {v.id for v in product.variants}:
        raise HTTPException(422, "That variant doesn't belong to this product.")
    old = None
    if replace_image_id is not None:
        old = db.get(ProductImage, replace_image_id)
        if old is None or old.product_id != product.id:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Image to replace not found.")
    try:
        uploaded = cloudinary_service.upload(data, product.slug)
    except cloudinary_service.ImageError as exc:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, str(exc)) from exc
    except Exception as exc:  # Cloudinary SDK raises its own error types
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, "Image upload failed. Please try again.") from exc

    if old is not None:
        image = old
        old_public_id = old.public_id
        image.url, image.public_id = uploaded["url"], uploaded["public_id"]
        image.width, image.height = uploaded["width"], uploaded["height"]
        image.alt = alt[:255] or image.alt
    else:
        old_public_id = None
        next_sort = max((i.sort_order for i in product.images if i.role == role), default=-1) + 1
        image = ProductImage(
            product_id=product.id,
            variant_id=variant_id,
            role=role,
            alt=alt[:255],
            sort_order=next_sort,
            **uploaded,
        )
        db.add(image)
    db.commit()
    if old_public_id:
        try:
            cloudinary_service.destroy(old_public_id)
        except Exception:
            pass  # orphaned file in Cloudinary is harmless
    db.refresh(image)
    return image


@router.patch("/images/{image_id}", response_model=AdminImageOut)
def update_image(image_id: int, payload: ImageUpdateIn, admin: OwnerAdmin, db: DB):
    image = db.get(ProductImage, image_id)
    if image is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Image not found.")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(image, field, value)
    db.commit()
    return image


@router.delete("/images/{image_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_image(image_id: int, admin: OwnerAdmin, db: DB):
    image = db.get(ProductImage, image_id)
    if image is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Image not found.")
    public_id = image.public_id
    db.delete(image)
    db.commit()
    try:
        cloudinary_service.destroy(public_id)
    except Exception:
        pass


# ---------------------------------------------------------------------------
# Store settings (owner only)
# ---------------------------------------------------------------------------


@router.get("/settings", response_model=SettingsOut)
def get_store_settings(admin: AnyAdmin, db: DB):
    settings = order_service.store_settings(db)
    db.commit()
    return settings


@router.put("/settings", response_model=SettingsOut)
def put_store_settings(payload: SettingsIn, admin: OwnerAdmin, db: DB):
    settings = order_service.store_settings(db)
    for field, value in payload.model_dump().items():
        setattr(settings, field, value)
    db.commit()
    return settings
