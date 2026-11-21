"""All tables. Money is always Numeric(10, 2) → Decimal; never float."""

from __future__ import annotations

from datetime import UTC, datetime
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

Money = Numeric(10, 2)


def utcnow() -> datetime:
    return datetime.now(UTC)


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False
    )


# ---------------------------------------------------------------------------
# Catalog
# ---------------------------------------------------------------------------


class Product(TimestampMixin, Base):
    __tablename__ = "products"

    id: Mapped[int] = mapped_column(primary_key=True)
    slug: Mapped[str] = mapped_column(String(80), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    tagline: Mapped[str] = mapped_column(String(200), default="", nullable=False)
    category: Mapped[str] = mapped_column(String(120), default="", nullable=False)
    description: Mapped[str] = mapped_column(Text, default="", nullable=False)
    size_label: Mapped[str] = mapped_column(String(40), default="", nullable=False)
    age_range: Mapped[str] = mapped_column(String(40), default="", nullable=False)
    price: Mapped[Decimal] = mapped_column(Money, nullable=False)
    # Shown struck through when set and higher than price ("discount pricing").
    compare_at_price: Mapped[Decimal | None] = mapped_column(Money)
    # "Buy N+ bottles, get P% off the whole order".
    multi_unit_min_qty: Mapped[int | None] = mapped_column(Integer)
    multi_unit_percent: Mapped[Decimal | None] = mapped_column(Numeric(5, 2))
    max_qty_per_order: Mapped[int] = mapped_column(Integer, default=10, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    variants: Mapped[list[ProductVariant]] = relationship(
        back_populates="product", order_by="ProductVariant.sort_order", cascade="all, delete-orphan"
    )
    images: Mapped[list[ProductImage]] = relationship(
        back_populates="product", order_by="ProductImage.sort_order", cascade="all, delete-orphan"
    )

    __table_args__ = (
        CheckConstraint("price >= 0", name="ck_products_price"),
        CheckConstraint("max_qty_per_order >= 1", name="ck_products_max_qty"),
    )


class ProductVariant(TimestampMixin, Base):
    __tablename__ = "product_variants"

    id: Mapped[int] = mapped_column(primary_key=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id", ondelete="CASCADE"), index=True, nullable=False)
    sku: Mapped[str] = mapped_column(String(60), unique=True, nullable=False)
    slug: Mapped[str] = mapped_column(String(80), nullable=False)
    name: Mapped[str] = mapped_column(String(80), nullable=False)
    scent: Mapped[str] = mapped_column(String(120), default="", nullable=False)
    description: Mapped[str] = mapped_column(Text, default="", nullable=False)
    icon: Mapped[str] = mapped_column(String(16), default="", nullable=False)
    # Optional per-variant price; falls back to the product price.
    price: Mapped[Decimal | None] = mapped_column(Money)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    product: Mapped[Product] = relationship(back_populates="variants")
    inventory: Mapped[Inventory | None] = relationship(
        back_populates="variant", uselist=False, cascade="all, delete-orphan"
    )

    __table_args__ = (UniqueConstraint("product_id", "slug", name="uq_variant_product_slug"),)

    @property
    def effective_price(self) -> Decimal:
        return self.price if self.price is not None else self.product.price

    @property
    def stock(self) -> int:
        return self.inventory.quantity if self.inventory else 0


class Inventory(Base):
    __tablename__ = "inventory"

    id: Mapped[int] = mapped_column(primary_key=True)
    variant_id: Mapped[int] = mapped_column(
        ForeignKey("product_variants.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    quantity: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    low_stock_threshold: Mapped[int] = mapped_column(Integer, default=10, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    variant: Mapped[ProductVariant] = relationship(back_populates="inventory")

    __table_args__ = (CheckConstraint("quantity >= 0", name="ck_inventory_quantity"),)


IMAGE_ROLES = ("hero", "gallery", "what_is", "scent_slide", "badge")


class ProductImage(Base):
    __tablename__ = "product_images"

    id: Mapped[int] = mapped_column(primary_key=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id", ondelete="CASCADE"), index=True, nullable=False)
    variant_id: Mapped[int | None] = mapped_column(ForeignKey("product_variants.id", ondelete="SET NULL"))
    role: Mapped[str] = mapped_column(String(20), default="gallery", nullable=False)
    url: Mapped[str] = mapped_column(String(500), nullable=False)
    public_id: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    alt: Mapped[str] = mapped_column(String(255), default="", nullable=False)
    width: Mapped[int | None] = mapped_column(Integer)
    height: Mapped[int | None] = mapped_column(Integer)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)

    product: Mapped[Product] = relationship(back_populates="images")


# ---------------------------------------------------------------------------
# Customers
# ---------------------------------------------------------------------------


class Customer(TimestampMixin, Base):
    __tablename__ = "customers"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)  # stored lower-case
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    name: Mapped[str] = mapped_column(String(80), nullable=False)
    phone: Mapped[str] = mapped_column(String(20), default="", nullable=False)
    reset_token_hash: Mapped[str | None] = mapped_column(String(64), index=True)
    reset_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    addresses: Mapped[list[Address]] = relationship(
        back_populates="customer", cascade="all, delete-orphan", order_by="Address.id"
    )


class Address(TimestampMixin, Base):
    __tablename__ = "addresses"

    id: Mapped[int] = mapped_column(primary_key=True)
    customer_id: Mapped[int] = mapped_column(ForeignKey("customers.id", ondelete="CASCADE"), index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(80), default="", nullable=False)
    phone: Mapped[str] = mapped_column(String(20), default="", nullable=False)
    line1: Mapped[str] = mapped_column(String(200), nullable=False)
    city: Mapped[str] = mapped_column(String(60), nullable=False)
    state: Mapped[str] = mapped_column(String(60), nullable=False)
    pincode: Mapped[str] = mapped_column(String(6), nullable=False)
    is_default: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    customer: Mapped[Customer] = relationship(back_populates="addresses")


# ---------------------------------------------------------------------------
# Orders & payments
# ---------------------------------------------------------------------------

ORDER_STATUSES = ("pending", "confirmed", "shipped", "delivered", "cancelled")
PAYMENT_STATUSES = ("pending", "paid", "failed", "refunded", "cod_pending", "cod_collected")
PAYMENT_METHODS = ("razorpay", "cod")


class Order(TimestampMixin, Base):
    __tablename__ = "orders"

    id: Mapped[int] = mapped_column(primary_key=True)
    number: Mapped[str | None] = mapped_column(String(20), unique=True)
    access_token: Mapped[str] = mapped_column(String(64), nullable=False)
    customer_id: Mapped[int | None] = mapped_column(ForeignKey("customers.id", ondelete="SET NULL"), index=True)
    email: Mapped[str] = mapped_column(String(255), nullable=False)
    name: Mapped[str] = mapped_column(String(80), nullable=False)
    phone: Mapped[str] = mapped_column(String(20), nullable=False)
    address: Mapped[str] = mapped_column(String(200), nullable=False)
    city: Mapped[str] = mapped_column(String(60), nullable=False)
    state: Mapped[str] = mapped_column(String(60), nullable=False)
    pincode: Mapped[str] = mapped_column(String(6), nullable=False)
    notes: Mapped[str] = mapped_column(String(500), default="", nullable=False)
    payment_method: Mapped[str] = mapped_column(String(20), nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="pending", nullable=False)
    payment_status: Mapped[str] = mapped_column(String(20), default="pending", nullable=False)
    subtotal: Mapped[Decimal] = mapped_column(Money, nullable=False)
    discount: Mapped[Decimal] = mapped_column(Money, default=Decimal("0"), nullable=False)
    shipping: Mapped[Decimal] = mapped_column(Money, default=Decimal("0"), nullable=False)
    cod_fee: Mapped[Decimal] = mapped_column(Money, default=Decimal("0"), nullable=False)
    total: Mapped[Decimal] = mapped_column(Money, nullable=False)
    currency: Mapped[str] = mapped_column(String(3), default="INR", nullable=False)
    razorpay_order_id: Mapped[str | None] = mapped_column(String(64), unique=True)
    tracking: Mapped[str] = mapped_column(String(200), default="", nullable=False)
    stock_committed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    needs_attention: Mapped[str] = mapped_column(String(200), default="", nullable=False)
    emails_sent: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    shipped_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    items: Mapped[list[OrderItem]] = relationship(back_populates="order", cascade="all, delete-orphan")
    payments: Mapped[list[Payment]] = relationship(
        back_populates="order", cascade="all, delete-orphan", order_by="Payment.id"
    )

    __table_args__ = (
        Index("ix_orders_status_created", "status", "created_at"),
        Index("ix_orders_payment_status", "payment_status"),
        Index("ix_orders_email", "email"),
        CheckConstraint("total >= 0", name="ck_orders_total"),
    )


class OrderItem(Base):
    __tablename__ = "order_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    order_id: Mapped[int] = mapped_column(ForeignKey("orders.id", ondelete="CASCADE"), index=True, nullable=False)
    variant_id: Mapped[int | None] = mapped_column(ForeignKey("product_variants.id", ondelete="SET NULL"))
    product_name: Mapped[str] = mapped_column(String(120), nullable=False)
    variant_name: Mapped[str] = mapped_column(String(80), nullable=False)
    sku: Mapped[str] = mapped_column(String(60), nullable=False)
    unit_price: Mapped[Decimal] = mapped_column(Money, nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    line_total: Mapped[Decimal] = mapped_column(Money, nullable=False)

    order: Mapped[Order] = relationship(back_populates="items")

    __table_args__ = (CheckConstraint("quantity > 0", name="ck_order_items_quantity"),)


class Payment(TimestampMixin, Base):
    __tablename__ = "payments"

    id: Mapped[int] = mapped_column(primary_key=True)
    order_id: Mapped[int] = mapped_column(ForeignKey("orders.id", ondelete="CASCADE"), index=True, nullable=False)
    provider: Mapped[str] = mapped_column(String(20), nullable=False)  # razorpay | cod
    razorpay_order_id: Mapped[str | None] = mapped_column(String(64), index=True)
    razorpay_payment_id: Mapped[str | None] = mapped_column(String(64), unique=True)
    amount: Mapped[Decimal] = mapped_column(Money, nullable=False)
    currency: Mapped[str] = mapped_column(String(3), default="INR", nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False)  # created | captured | failed | refunded | pending
    method: Mapped[str] = mapped_column(String(30), default="", nullable=False)
    error_reason: Mapped[str] = mapped_column(String(255), default="", nullable=False)

    order: Mapped[Order] = relationship(back_populates="payments")


class WebhookEvent(Base):
    """Razorpay event ids already processed, so retries are ignored."""

    __tablename__ = "webhook_events"

    id: Mapped[int] = mapped_column(primary_key=True)
    event_id: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    event_type: Mapped[str] = mapped_column(String(60), nullable=False)
    received_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)


# ---------------------------------------------------------------------------
# Admin & settings
# ---------------------------------------------------------------------------

ADMIN_ROLES = ("owner", "staff")


class AdminUser(TimestampMixin, Base):
    __tablename__ = "admin_users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    name: Mapped[str] = mapped_column(String(80), default="", nullable=False)
    # owner: everything; staff: orders only.
    role: Mapped[str] = mapped_column(String(20), default="staff", nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class StoreSettings(Base):
    """Single row (id = 1) of shop-wide settings editable from the admin."""

    __tablename__ = "store_settings"

    id: Mapped[int] = mapped_column(primary_key=True)
    shipping_fee: Mapped[Decimal] = mapped_column(Money, default=Decimal("0"), nullable=False)
    free_shipping_min: Mapped[Decimal | None] = mapped_column(Money)
    cod_enabled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    cod_fee: Mapped[Decimal] = mapped_column(Money, default=Decimal("0"), nullable=False)
    cod_max_order_total: Mapped[Decimal | None] = mapped_column(Money)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)


class RateLimitHit(Base):
    """Fixed-window counters. Serverless functions share no memory, so these live in the database."""

    __tablename__ = "rate_limit_hits"

    id: Mapped[int] = mapped_column(primary_key=True)
    key: Mapped[str] = mapped_column(String(128), nullable=False)
    window_start: Mapped[int] = mapped_column(Integer, nullable=False)
    count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    __table_args__ = (UniqueConstraint("key", "window_start", name="uq_rate_limit_window"),)
