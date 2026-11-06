import secrets
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Category, DeliveryZone, Order, OrderItem, OrderStatus, Product, User
from ..schemas import CategoryOut, OrderIn, OrderOut, ProductPublic, ZoneOut
from ..security import create_token, verify_password

router = APIRouter(prefix="/api")


@router.post("/auth/login")
def login(form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.email == form.username))
    if not user or not verify_password(form.password, user.hashed_password):
        raise HTTPException(401, "البريد أو كلمة المرور غير صحيحة")
    return {"access_token": create_token(user.id), "token_type": "bearer"}


@router.get("/categories", response_model=list[CategoryOut])
def categories(db: Session = Depends(get_db)):
    q = select(Category).where(Category.is_visible).order_by(Category.sort_order, Category.id)
    return db.scalars(q).all()


@router.get("/zones", response_model=list[ZoneOut])
def zones(db: Session = Depends(get_db)):
    return db.scalars(select(DeliveryZone).where(DeliveryZone.is_active)).all()


@router.get("/products", response_model=list[ProductPublic])
def products(category: str | None = None, q: str | None = None, featured: bool = False,
             on_sale: bool = False, limit: int = 60, offset: int = 0,
             db: Session = Depends(get_db)):
    stmt = select(Product).join(Category).where(Product.is_visible, Category.is_visible)
    if category:
        stmt = stmt.where(Category.slug == category)
    if q:
        like = f"%{q}%"
        stmt = stmt.where(or_(Product.name_ar.ilike(like), Product.name_en.ilike(like),
                              Product.description_ar.ilike(like)))
    if featured:
        stmt = stmt.where(Product.is_featured)
    if on_sale:
        stmt = stmt.where(Product.sale_price.is_not(None))
    stmt = stmt.order_by(Product.is_featured.desc(), Product.id.desc()).limit(min(limit, 100)).offset(offset)
    return db.scalars(stmt).all()


@router.get("/products/{slug}", response_model=ProductPublic)
def product(slug: str, db: Session = Depends(get_db)):
    p = db.scalar(select(Product).where(Product.slug == slug, Product.is_visible))
    if not p:
        raise HTTPException(404, "المنتج غير موجود")
    return p


@router.post("/orders", response_model=OrderOut, status_code=201)
def create_order(data: OrderIn, db: Session = Depends(get_db)):
    zone = db.get(DeliveryZone, data.zone_id)
    if not zone or not zone.is_active:
        raise HTTPException(400, "منطقة التوصيل غير صحيحة")

    qty: dict[int, int] = {}
    for it in data.items:
        qty[it.product_id] = qty.get(it.product_id, 0) + it.quantity
    found = db.scalars(select(Product).where(Product.id.in_(qty), Product.is_visible)).all()
    products = {p.id: p for p in found}

    order = Order(customer_name=data.customer_name, phone=data.phone, zone_id=zone.id,
                  zone_name=zone.name_ar, address=data.address, notes=data.notes)
    subtotal, needs_review = Decimal(0), False
    for pid, q in qty.items():
        p = products.get(pid)
        if not p:
            raise HTTPException(400, "أحد المنتجات لم يعد متوفرًا")
        if p.stock_qty < q:
            raise HTTPException(400, f"الكمية المتاحة من «{p.name_ar}» غير كافية")
        price = p.sale_price if p.sale_price is not None else p.price
        p.stock_qty -= q  # حجز الكمية؛ تُعاد إذا أُلغي الطلب
        subtotal += price * q
        needs_review = needs_review or p.requires_pharmacist
        order.items.append(OrderItem(product_id=p.id, name_ar=p.name_ar, unit_price=price, quantity=q))

    order.subtotal = subtotal
    order.status = OrderStatus.pending_pharmacist if needs_review else OrderStatus.new
    while True:
        number = f"AS-{secrets.randbelow(900000) + 100000}"
        if not db.scalar(select(Order.id).where(Order.order_number == number)):
            break
    order.order_number = number
    db.add(order)
    db.commit()
    return order
