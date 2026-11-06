import enum
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (JSON, Boolean, Date, DateTime, Enum, ForeignKey,
                        Integer, Numeric, String, Text, func)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


class OrderStatus(str, enum.Enum):
    new = "new"                              # طلب جديد
    pending_pharmacist = "pending_pharmacist"  # بانتظار مراجعة الصيدلانية (منتج يتطلب تواصل)
    confirmed = "confirmed"                  # مؤكد
    preparing = "preparing"                  # قيد التجهيز
    out_for_delivery = "out_for_delivery"    # في الطريق
    delivered = "delivered"                  # تم التسليم
    cancelled = "cancelled"                  # ملغي


class User(Base):
    """حساب الصيدلانية (مدير لوحة التحكم)."""
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    full_name: Mapped[str] = mapped_column(String(120), default="")
    hashed_password: Mapped[str] = mapped_column(String(255))
    is_admin: Mapped[bool] = mapped_column(Boolean, default=True)


class Category(Base):
    __tablename__ = "categories"

    id: Mapped[int] = mapped_column(primary_key=True)
    name_ar: Mapped[str] = mapped_column(String(120))
    name_en: Mapped[str] = mapped_column(String(120), default="")
    slug: Mapped[str] = mapped_column(String(140), unique=True, index=True)
    description_ar: Mapped[str] = mapped_column(Text, default="")
    image_url: Mapped[str | None] = mapped_column(String(500))
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    is_visible: Mapped[bool] = mapped_column(Boolean, default=True)

    products: Mapped[list["Product"]] = relationship(back_populates="category")


class Product(Base):
    __tablename__ = "products"

    id: Mapped[int] = mapped_column(primary_key=True)
    category_id: Mapped[int] = mapped_column(ForeignKey("categories.id"), index=True)
    name_ar: Mapped[str] = mapped_column(String(200))
    name_en: Mapped[str] = mapped_column(String(200), default="")
    slug: Mapped[str] = mapped_column(String(220), unique=True, index=True)
    description_ar: Mapped[str] = mapped_column(Text, default="")
    usage_ar: Mapped[str] = mapped_column(Text, default="")  # طريقة الاستخدام
    price: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    sale_price: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))
    stock_qty: Mapped[int] = mapped_column(Integer, default=0)
    low_stock_threshold: Mapped[int] = mapped_column(Integer, default=5)
    expiry_date: Mapped[date | None] = mapped_column(Date)
    # True = لا يُباع مباشرة؛ الطلب يمر بمراجعة الصيدلانية قبل التأكيد
    requires_pharmacist: Mapped[bool] = mapped_column(Boolean, default=False)
    is_visible: Mapped[bool] = mapped_column(Boolean, default=True)
    is_featured: Mapped[bool] = mapped_column(Boolean, default=False)
    images: Mapped[list] = mapped_column(JSON, default=list)  # قائمة روابط الصور
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    category: Mapped[Category] = relationship(back_populates="products")


class DeliveryZone(Base):
    """مناطق التوصيل (بدون رسوم ثابتة — الرسوم تُحدد لكل طلب)."""
    __tablename__ = "delivery_zones"

    id: Mapped[int] = mapped_column(primary_key=True)
    name_ar: Mapped[str] = mapped_column(String(120))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class Order(Base):
    __tablename__ = "orders"

    id: Mapped[int] = mapped_column(primary_key=True)
    order_number: Mapped[str] = mapped_column(String(20), unique=True, index=True)
    status: Mapped[OrderStatus] = mapped_column(Enum(OrderStatus), default=OrderStatus.new)
    customer_name: Mapped[str] = mapped_column(String(120))
    phone: Mapped[str] = mapped_column(String(30))
    zone_id: Mapped[int | None] = mapped_column(ForeignKey("delivery_zones.id"))
    zone_name: Mapped[str] = mapped_column(String(120), default="")
    address: Mapped[str] = mapped_column(Text, default="")
    notes: Mapped[str] = mapped_column(Text, default="")
    currency: Mapped[str] = mapped_column(String(3), default="ILS")  # شيكل
    subtotal: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0)
    # None = لم تُحدد بعد؛ الصيدلانية تدخل رسوم التوصيل اليومية عند تأكيد الطلب
    delivery_fee: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))
    total: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))  # المجموع شاملاً التوصيل بعد تحديده
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    items: Mapped[list["OrderItem"]] = relationship(
        back_populates="order", cascade="all, delete-orphan"
    )


class OrderItem(Base):
    """نحفظ الاسم والسعر وقت الطلب حتى لا يتغير الطلب القديم لو تغير المنتج."""
    __tablename__ = "order_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    order_id: Mapped[int] = mapped_column(ForeignKey("orders.id"), index=True)
    product_id: Mapped[int | None] = mapped_column(ForeignKey("products.id"))
    name_ar: Mapped[str] = mapped_column(String(200))
    unit_price: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    quantity: Mapped[int] = mapped_column(Integer, default=1)

    order: Mapped[Order] = relationship(back_populates="items")
