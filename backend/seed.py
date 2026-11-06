"""تشغيل مرة واحدة: python seed.py  — ينشئ الأقسام الخمسة وحساب الصيدلانية ومناطق التوصيل."""
import bcrypt
from sqlalchemy import select

from app import models
from app.config import settings
from app.database import Base, SessionLocal, engine

CATEGORIES = [
    ("منتجات وعلاجية", "Medicines & Treatments", "medicines"),
    ("منتجات عناية", "Care Products", "care"),
    ("منتجات تجميلية", "Beauty Products", "beauty"),
    ("عناية أطفال", "Baby Care", "baby-care"),
    ("أدوات صحية", "Health Devices", "health-tools"),
]
ZONES = ["مدينة غزة", "شمال غزة", "الوسطى", "خان يونس", "رفح"]


def main():
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        for i, (ar, en, slug) in enumerate(CATEGORIES):
            if not db.scalar(select(models.Category).where(models.Category.slug == slug)):
                db.add(models.Category(name_ar=ar, name_en=en, slug=slug, sort_order=i))
        for name in ZONES:
            if not db.scalar(select(models.DeliveryZone).where(models.DeliveryZone.name_ar == name)):
                db.add(models.DeliveryZone(name_ar=name))
        if not db.scalar(select(models.User).where(models.User.email == settings.admin_email)):
            hashed = bcrypt.hashpw(settings.admin_password.encode(), bcrypt.gensalt()).decode()
            db.add(models.User(email=settings.admin_email, full_name="أسماء بسام",
                               hashed_password=hashed, is_admin=True))
        db.commit()
    print("تم تجهيز قاعدة البيانات ✔")


if __name__ == "__main__":
    main()
