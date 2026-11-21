"""The only place totals are calculated. Everything uses Decimal; prices come from the database."""

from __future__ import annotations

from dataclasses import dataclass
from decimal import ROUND_HALF_UP, Decimal

from app.models import Product, ProductVariant, StoreSettings

ZERO = Decimal("0")


def rupees(value: Decimal) -> Decimal:
    """Whole-rupee rounding for discounts and fees (prices are whole rupees)."""
    return value.quantize(Decimal("1"), rounding=ROUND_HALF_UP).quantize(Decimal("0.01"))


@dataclass(frozen=True)
class QuoteLine:
    variant: ProductVariant
    quantity: int
    unit_price: Decimal

    @property
    def line_total(self) -> Decimal:
        return (self.unit_price * self.quantity).quantize(Decimal("0.01"))


@dataclass(frozen=True)
class Quote:
    lines: list[QuoteLine]
    quantity: int
    subtotal: Decimal
    discount: Decimal
    shipping: Decimal
    cod_fee: Decimal
    total: Decimal


def build_quote(
    product: Product,
    lines: list[tuple[ProductVariant, int]],
    settings: StoreSettings,
    payment_method: str = "razorpay",
) -> Quote:
    quote_lines = [QuoteLine(v, q, v.effective_price) for v, q in lines]
    quantity = sum(line.quantity for line in quote_lines)
    subtotal = sum((line.line_total for line in quote_lines), ZERO)

    discount = ZERO
    if product.multi_unit_min_qty and product.multi_unit_percent and quantity >= product.multi_unit_min_qty:
        discount = rupees(subtotal * product.multi_unit_percent / Decimal(100))

    after_discount = subtotal - discount
    shipping = settings.shipping_fee if quantity else ZERO
    if settings.free_shipping_min is not None and after_discount >= settings.free_shipping_min:
        shipping = ZERO

    cod_fee = settings.cod_fee if payment_method == "cod" else ZERO
    total = after_discount + shipping + cod_fee
    return Quote(quote_lines, quantity, subtotal, discount, shipping, cod_fee, total)
