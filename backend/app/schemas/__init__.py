"""Request/response schemas. JSON uses camelCase to match the React app."""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, PlainSerializer, StringConstraints, field_validator
from pydantic.alias_generators import to_camel

# Money is Decimal internally and a JSON number on the wire (display only; the server recalculates).
MoneyOut = Annotated[Decimal, PlainSerializer(lambda v: float(v), return_type=float, when_used="json")]
OptMoneyOut = Annotated[
    Decimal | None, PlainSerializer(lambda v: None if v is None else float(v), return_type=float | None, when_used="json")
]
MoneyIn = Annotated[Decimal, Field(ge=0, le=1_000_000, max_digits=10, decimal_places=2)]

PHONE_RE = r"^(\+?91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}$"
PINCODE_RE = r"^[1-9]\d{5}$"
Str = Annotated[str, StringConstraints(strip_whitespace=True)]


class Schema(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, from_attributes=True)


# ---------------------------------------------------------------------------
# Catalog
# ---------------------------------------------------------------------------


class VariantOut(Schema):
    id: str  # slug, e.g. "vanilla-cake" (what the cart stores)
    sku: str
    name: str
    scent: str
    description: str
    icon: str
    price: MoneyOut
    in_stock: bool
    stock_left: int | None  # only when running low


class ImageOut(Schema):
    id: int
    role: str
    url: str
    alt: str
    width: int | None
    height: int | None
    variant_id: str | None


class MultiUnitDiscountOut(Schema):
    min_quantity: int
    percent: MoneyOut


class ShippingOut(Schema):
    fee: MoneyOut
    free_shipping_min: OptMoneyOut


class CodOut(Schema):
    enabled: bool
    fee: MoneyOut
    max_order_total: OptMoneyOut


class ProductOut(Schema):
    id: str
    name: str
    tagline: str
    category: str
    description: str
    size: str
    age_range: str
    price: MoneyOut
    compare_at_price: OptMoneyOut
    multi_unit_discount: MultiUnitDiscountOut | None
    max_quantity: int
    variants: list[VariantOut]
    images: list[ImageOut]
    shipping: ShippingOut
    cod: CodOut


# ---------------------------------------------------------------------------
# Cart & checkout
# ---------------------------------------------------------------------------


class CartLineIn(Schema):
    variant_id: Annotated[str, StringConstraints(min_length=1, max_length=80)]
    quantity: int = Field(ge=1, le=10)


class QuoteIn(Schema):
    product_id: str = "cloud-mist"
    lines: list[CartLineIn] = Field(min_length=1, max_length=10)
    payment_method: Literal["razorpay", "cod"] = "razorpay"


class QuoteOut(Schema):
    quantity: int
    subtotal: MoneyOut
    discount: MoneyOut
    shipping: MoneyOut
    cod_fee: MoneyOut
    total: MoneyOut


class CustomerDetailsIn(Schema):
    name: Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=80)]
    email: EmailStr
    phone: Annotated[str, StringConstraints(strip_whitespace=True, pattern=PHONE_RE)]
    address: Annotated[str, StringConstraints(strip_whitespace=True, min_length=5, max_length=200)]
    city: Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=60)]
    state: Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=60)]
    pincode: Annotated[str, StringConstraints(strip_whitespace=True, pattern=PINCODE_RE)]
    notes: Annotated[str, StringConstraints(strip_whitespace=True, max_length=500)] = ""

    @field_validator("email")
    @classmethod
    def _lower(cls, v: str) -> str:
        return v.lower()


class OrderCreateIn(QuoteIn):
    customer: CustomerDetailsIn


class OrderItemOut(Schema):
    product_name: str
    variant_name: str
    sku: str
    unit_price: MoneyOut
    quantity: int
    line_total: MoneyOut


class OrderOut(Schema):
    id: int
    number: str
    status: str
    payment_status: str
    payment_method: str
    created_at: datetime
    paid_at: datetime | None
    shipped_at: datetime | None
    name: str
    email: str
    phone: str
    address: str
    city: str
    state: str
    pincode: str
    notes: str
    tracking: str
    subtotal: MoneyOut
    discount: MoneyOut
    shipping: MoneyOut
    cod_fee: MoneyOut
    total: MoneyOut
    items: list[OrderItemOut]


class OrderCreatedOut(OrderOut):
    access_token: str


class PaymentOrderIn(Schema):
    order_id: int
    access_token: str


class PaymentOrderOut(Schema):
    key_id: str
    razorpay_order_id: str
    amount: int  # paise, as Razorpay Checkout expects
    currency: str
    order_number: str
    name: str
    email: str
    phone: str


class VerifyIn(BaseModel):
    razorpay_order_id: Annotated[str, StringConstraints(min_length=1, max_length=64)]
    razorpay_payment_id: Annotated[str, StringConstraints(min_length=1, max_length=64)]
    razorpay_signature: Annotated[str, StringConstraints(min_length=1, max_length=256)]


class VerifyOut(Schema):
    verified: bool
    order_number: str | None = None
    access_token: str | None = None


# ---------------------------------------------------------------------------
# Customer accounts
# ---------------------------------------------------------------------------

Password = Annotated[str, StringConstraints(min_length=8, max_length=200)]


class SignupIn(Schema):
    name: Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=80)]
    email: EmailStr
    phone: Annotated[str, StringConstraints(strip_whitespace=True, max_length=20)] = ""
    password: Password

    @field_validator("phone")
    @classmethod
    def _phone(cls, v: str) -> str:
        import re

        if v and not re.match(PHONE_RE, v):
            raise ValueError("Please enter a valid 10-digit Indian mobile number.")
        return v


class LoginIn(Schema):
    email: EmailStr
    password: Annotated[str, StringConstraints(min_length=1, max_length=200)]


class CustomerOut(Schema):
    id: int
    email: str
    name: str
    phone: str
    address: str = ""
    city: str = ""
    state: str = ""
    pincode: str = ""


class ProfileIn(Schema):
    name: Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=80)]
    phone: Annotated[str, StringConstraints(strip_whitespace=True, max_length=20)] = ""
    address: Annotated[str, StringConstraints(strip_whitespace=True, max_length=200)] = ""
    city: Annotated[str, StringConstraints(strip_whitespace=True, max_length=60)] = ""
    state: Annotated[str, StringConstraints(strip_whitespace=True, max_length=60)] = ""
    pincode: Annotated[str, StringConstraints(strip_whitespace=True, max_length=6)] = ""
    current_password: str = ""
    new_password: str = ""


class ForgotIn(Schema):
    email: EmailStr


class ResetIn(Schema):
    token: Annotated[str, StringConstraints(min_length=10, max_length=200)]
    password: Password


# ---------------------------------------------------------------------------
# Admin
# ---------------------------------------------------------------------------


class AdminLoginIn(Schema):
    email: EmailStr
    password: Annotated[str, StringConstraints(min_length=1, max_length=200)]


class AdminOut(Schema):
    id: int
    email: str
    name: str
    role: str


class PaymentOut(Schema):
    id: int
    provider: str
    razorpay_payment_id: str | None
    amount: MoneyOut
    status: str
    method: str
    error_reason: str
    created_at: datetime


class AdminOrderListItem(Schema):
    id: int
    number: str
    created_at: datetime
    status: str
    payment_status: str
    payment_method: str
    name: str
    email: str
    phone: str
    total: MoneyOut
    item_count: int
    needs_attention: str


class AdminOrderList(Schema):
    orders: list[AdminOrderListItem]
    total: int
    page: int
    page_size: int


class AdminOrderDetail(OrderOut):
    razorpay_order_id: str | None
    customer_id: int | None
    needs_attention: str
    payments: list[PaymentOut]
    allowed_statuses: list[str]


class StatusUpdateIn(Schema):
    status: Literal["pending", "confirmed", "shipped", "delivered", "cancelled"]
    tracking: Annotated[str, StringConstraints(max_length=200)] | None = None
    notify_customer: bool = True
    clear_attention: bool = False


class AdminVariantOut(Schema):
    id: int
    slug: str
    sku: str
    name: str
    scent: str
    description: str
    icon: str
    price: OptMoneyOut
    sort_order: int
    is_active: bool
    stock: int
    low_stock_threshold: int


class AdminImageOut(Schema):
    id: int
    role: str
    url: str
    public_id: str
    alt: str
    width: int | None
    height: int | None
    sort_order: int
    variant_id: int | None


class AdminProductOut(Schema):
    id: int
    slug: str
    name: str
    tagline: str
    category: str
    description: str
    size_label: str
    age_range: str
    price: MoneyOut
    compare_at_price: OptMoneyOut
    multi_unit_min_qty: int | None
    multi_unit_percent: OptMoneyOut
    max_qty_per_order: int
    is_active: bool
    variants: list[AdminVariantOut]
    images: list[AdminImageOut]


class AdminVariantIn(Schema):
    id: int
    name: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=80)]
    scent: Annotated[str, StringConstraints(max_length=120)] = ""
    description: Annotated[str, StringConstraints(max_length=1000)] = ""
    icon: Annotated[str, StringConstraints(max_length=16)] = ""
    price: MoneyIn | None = None
    is_active: bool = True
    stock: int = Field(ge=0, le=1_000_000)
    low_stock_threshold: int = Field(default=10, ge=0, le=100_000)


class AdminProductIn(Schema):
    name: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=120)]
    tagline: Annotated[str, StringConstraints(max_length=200)] = ""
    category: Annotated[str, StringConstraints(max_length=120)] = ""
    description: Annotated[str, StringConstraints(max_length=5000)] = ""
    size_label: Annotated[str, StringConstraints(max_length=40)] = ""
    age_range: Annotated[str, StringConstraints(max_length=40)] = ""
    price: MoneyIn
    compare_at_price: MoneyIn | None = None
    multi_unit_min_qty: int | None = Field(default=None, ge=2, le=100)
    multi_unit_percent: Annotated[Decimal, Field(ge=0, le=90, max_digits=5, decimal_places=2)] | None = None
    max_qty_per_order: int = Field(default=10, ge=1, le=100)
    is_active: bool = True
    variants: list[AdminVariantIn] = []


class StockAdjustIn(Schema):
    stock: int = Field(ge=0, le=1_000_000)


class ImageUpdateIn(Schema):
    role: Literal["hero", "gallery", "what_is", "scent_slide", "badge"] | None = None
    alt: Annotated[str, StringConstraints(max_length=255)] | None = None
    sort_order: int | None = Field(default=None, ge=0, le=1000)
    variant_id: int | None = None


class SettingsOut(Schema):
    shipping_fee: MoneyOut
    free_shipping_min: OptMoneyOut
    cod_enabled: bool
    cod_fee: MoneyOut
    cod_max_order_total: OptMoneyOut


class SettingsIn(Schema):
    shipping_fee: MoneyIn = Decimal("0")
    free_shipping_min: MoneyIn | None = None
    cod_enabled: bool = False
    cod_fee: MoneyIn = Decimal("0")
    cod_max_order_total: MoneyIn | None = None


class DailySales(Schema):
    date: str
    orders: int
    revenue: MoneyOut


class StatsOut(Schema):
    total_orders: int
    total_revenue: MoneyOut
    pending_orders: int
    to_ship: int
    completed_orders: int
    failed_payments: int
    cod_pending: int
    bottles_sold: int
    low_stock: list[str]
    needs_attention: int
    daily: list[DailySales]
