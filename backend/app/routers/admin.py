import hashlib
import time
from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from ..config import settings
from ..database import get_db
from ..models import Category, Order, OrderItem, OrderStatus, Product
from ..schemas import (CategoryIn, CategoryOut, CategoryUpdate, OrderOut, OrderUpdate,
                       ProductAdmin, ProductIn, ProductUpdate)
from ..security import get_admin
from ..utils import D, make_slug

router = APIRouter(prefix="/api/admin", dependencies=[Depends(get_admin)])


# ---------- لوحة المعلومات ----------
@router.get("/stats")
def stats(db: Session = Depends(get_db)):
    def count(model, *where):
        return db.scalar(select(func.count()).select_from(model).where(*where))

    soon = date.today() + timedelta(days=60)
    sales = db.scalar(select(func.coalesce(func.sum(Order.subtotal), 0))
                      .where(Order.status == OrderStatus.delivered))
    return {
        "orders_need_attention": count(Order, Order.status.in_(
            [OrderStatus.new, OrderStatus.pending_pharmacist])),
        "low_stock": count(Product, Product.stock_qty <= Product.low_stock_threshold),
        "expiring_soon": count(Product, Product.expiry_date.is_not(None), Product.expiry_date <= soon),
        "delivered_sales": float(sales),
        "currency": settings.currency,
    }


# ---------- الأقسام ----------
@router.get("/categories", response_model=list[CategoryOut])
def list_categories(db: Session = Depends(get_db)):
    return db.scalars(select(Category).order_by(Category.sort_order, Category.id)).all()


@router.post("/categories", response_model=CategoryOut, status_code=201)
def create_category(data: CategoryIn, db: Session = Depends(get_db)):
    values = data.model_dump(exclude={"slug"})
    c = Category(**values, slug=data.slug or make_slug(db, Category, data.name_en, "cat"))
    db.add(c)
    db.commit()
    return c


@router.patch("/categories/{cid}", response_model=CategoryOut)
def update_category(cid: int, data: CategoryUpdate, db: Session = Depends(get_db)):
    c = db.get(Category, cid)
    if not c:
        raise HTTPException(404, "القسم غير موجود")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(c, k, v)
    db.commit()
    return c


@router.delete("/categories/{cid}", status_code=204)
def delete_category(cid: int, db: Session = Depends(get_db)):
    c = db.get(Category, cid)
    if not c:
        raise HTTPException(404, "القسم غير موجود")
    if db.scalar(select(func.count()).select_from(Product).where(Product.category_id == cid)):
        raise HTTPException(400, "القسم فيه منتجات. أخفيه بدل ما تحذفيه")
    db.delete(c)
    db.commit()


# ---------- المنتجات ----------
@router.get("/products", response_model=list[ProductAdmin])
def list_products(db: Session = Depends(get_db)):
    return db.scalars(select(Product).order_by(Product.id.desc())).all()


@router.post("/products", response_model=ProductAdmin, status_code=201)
def create_product(data: ProductIn, db: Session = Depends(get_db)):
    if not db.get(Category, data.category_id):
        raise HTTPException(400, "القسم غير موجود")
    values = data.model_dump(exclude={"slug", "price", "sale_price"})
    p = Product(**values, price=D(data.price),
                sale_price=D(data.sale_price) if data.sale_price is not None else None,
                slug=data.slug or make_slug(db, Product, data.name_en, "p"))
    db.add(p)
    db.commit()
    return p


@router.patch("/products/{pid}", response_model=ProductAdmin)
def update_product(pid: int, data: ProductUpdate, db: Session = Depends(get_db)):
    p = db.get(Product, pid)
    if not p:
        raise HTTPException(404, "المنتج غير موجود")
    for k, v in data.model_dump(exclude_unset=True).items():
        if k in ("price", "sale_price") and v is not None:
            v = D(v)
        setattr(p, k, v)
    db.commit()
    return p


@router.delete("/products/{pid}", status_code=204)
def delete_product(pid: int, db: Session = Depends(get_db)):
    p = db.get(Product, pid)
    if not p:
        raise HTTPException(404, "المنتج غير موجود")
    # الطلبات القديمة تبقى سليمة (الاسم والسعر محفوظان فيها)
    db.execute(update(OrderItem).where(OrderItem.product_id == pid).values(product_id=None))
    db.delete(p)
    db.commit()


# ---------- الطلبات ----------
@router.get("/orders", response_model=list[OrderOut])
def list_orders(status: OrderStatus | None = None, db: Session = Depends(get_db)):
    stmt = select(Order).order_by(Order.id.desc()).limit(200)
    if status:
        stmt = stmt.where(Order.status == status)
    return db.scalars(stmt).all()


@router.get("/orders/{oid}", response_model=OrderOut)
def get_order(oid: int, db: Session = Depends(get_db)):
    o = db.get(Order, oid)
    if not o:
        raise HTTPException(404, "الطلب غير موجود")
    return o


@router.patch("/orders/{oid}", response_model=OrderOut)
def update_order(oid: int, data: OrderUpdate, db: Session = Depends(get_db)):
    o = db.get(Order, oid)
    if not o:
        raise HTTPException(404, "الطلب غير موجود")
    if data.delivery_fee is not None:  # رسوم التوصيل اليومية تُدخلها الصيدلانية
        o.delivery_fee = D(data.delivery_fee)
        o.total = o.subtotal + o.delivery_fee
    if data.status and data.status != o.status:
        if o.status == OrderStatus.cancelled:
            raise HTTPException(400, "لا يمكن إعادة فتح طلب ملغي")
        if data.status == OrderStatus.cancelled:
            for it in o.items:  # إعادة الكميات للمخزون
                if it.product_id and (p := db.get(Product, it.product_id)):
                    p.stock_qty += it.quantity
        o.status = data.status
    db.commit()
    return o


# ---------- رفع الصور (Cloudinary، توقيع مباشر من المتصفح) ----------
@router.get("/upload-signature")
def upload_signature():
    if not settings.cloudinary_api_secret:
        raise HTTPException(503, "Cloudinary غير مضبوط بعد")
    ts, folder = int(time.time()), "asma-store"
    to_sign = f"folder={folder}&timestamp={ts}{settings.cloudinary_api_secret}"
    return {"cloud_name": settings.cloudinary_cloud_name, "api_key": settings.cloudinary_api_key,
            "timestamp": ts, "folder": folder,
            "signature": hashlib.sha1(to_sign.encode()).hexdigest()}
