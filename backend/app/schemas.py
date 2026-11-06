from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field, computed_field

from .models import OrderStatus


class ORM(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ---------- الأقسام ----------
class CategoryIn(BaseModel):
    name_ar: str = Field(min_length=1)
    name_en: str = ""
    slug: str | None = None
    description_ar: str = ""
    image_url: str | None = None
    sort_order: int = 0
    is_visible: bool = True


class CategoryUpdate(BaseModel):
    name_ar: str | None = None
    name_en: str | None = None
    description_ar: str | None = None
    image_url: str | None = None
    sort_order: int | None = None
    is_visible: bool | None = None


class CategoryOut(ORM):
    id: int
    name_ar: str
    name_en: str
    slug: str
    description_ar: str
    image_url: str | None
    sort_order: int
    is_visible: bool


# ---------- المنتجات ----------
class ProductIn(BaseModel):
    category_id: int
    name_ar: str = Field(min_length=1)
    name_en: str = ""
    slug: str | None = None
    description_ar: str = ""
    usage_ar: str = ""
    price: float = Field(ge=0)
    sale_price: float | None = Field(None, ge=0)
    stock_qty: int = Field(0, ge=0)
    low_stock_threshold: int = Field(5, ge=0)
    expiry_date: date | None = None
    requires_pharmacist: bool = False
    is_visible: bool = True
    is_featured: bool = False
    images: list[str] = []


class ProductUpdate(BaseModel):
    category_id: int | None = None
    name_ar: str | None = None
    name_en: str | None = None
    description_ar: str | None = None
    usage_ar: str | None = None
    price: float | None = Field(None, ge=0)
    sale_price: float | None = Field(None, ge=0)
    stock_qty: int | None = Field(None, ge=0)
    low_stock_threshold: int | None = Field(None, ge=0)
    expiry_date: date | None = None
    requires_pharmacist: bool | None = None
    is_visible: bool | None = None
    is_featured: bool | None = None
    images: list[str] | None = None


class ProductAdmin(ORM):
    id: int
    category_id: int
    name_ar: str
    name_en: str
    slug: str
    description_ar: str
    usage_ar: str
    price: float
    sale_price: float | None
    stock_qty: int
    low_stock_threshold: int
    expiry_date: date | None
    requires_pharmacist: bool
    is_visible: bool
    is_featured: bool
    images: list[str]


class ProductPublic(ORM):
    """ما يراه الزبون: بدون الكمية الدقيقة أو تاريخ الصلاحية الداخلي."""
    id: int
    category_id: int
    name_ar: str
    name_en: str
    slug: str
    description_ar: str
    usage_ar: str
    price: float
    sale_price: float | None
    requires_pharmacist: bool
    is_featured: bool
    images: list[str]
    stock_qty: int = Field(exclude=True)

    @computed_field
    @property
    def in_stock(self) -> bool:
        return self.stock_qty > 0


# ---------- الطلبات ----------
class ZoneOut(ORM):
    id: int
    name_ar: str


class OrderItemIn(BaseModel):
    product_id: int
    quantity: int = Field(ge=1, le=50)


class OrderIn(BaseModel):
    customer_name: str = Field(min_length=2, max_length=120)
    phone: str = Field(min_length=7, max_length=30)
    zone_id: int
    address: str = Field(min_length=3)
    notes: str = ""
    items: list[OrderItemIn] = Field(min_length=1)


class OrderItemOut(ORM):
    product_id: int | None
    name_ar: str
    unit_price: float
    quantity: int


class OrderOut(ORM):
    id: int
    order_number: str
    status: OrderStatus
    customer_name: str
    phone: str
    zone_name: str
    address: str
    notes: str
    currency: str
    subtotal: float
    delivery_fee: float | None
    total: float | None
    created_at: datetime
    items: list[OrderItemOut]


class OrderUpdate(BaseModel):
    status: OrderStatus | None = None
    delivery_fee: float | None = Field(None, ge=0)
