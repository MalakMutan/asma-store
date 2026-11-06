import re
import secrets
from decimal import Decimal

from sqlalchemy import select


def D(x) -> Decimal:
    return Decimal(str(x))


def make_slug(db, model, base_en: str, prefix: str) -> str:
    base = re.sub(r"[^a-z0-9]+", "-", (base_en or "").lower()).strip("-") or prefix
    slug = base
    while db.scalar(select(model).where(model.slug == slug)):
        slug = f"{base}-{secrets.token_hex(2)}"
    return slug
