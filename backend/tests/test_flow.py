import os
import tempfile

os.environ["DATABASE_URL"] = f"sqlite:///{tempfile.mkdtemp()}/test.db"

from fastapi.testclient import TestClient  # noqa: E402

import seed  # noqa: E402
from app.main import app  # noqa: E402


def test_full_flow():
    with TestClient(app) as c:
        seed.main()
        assert c.get("/health").json() == {"status": "ok"}
        assert len(c.get("/api/categories").json()) == 5

        # الأدمن
        assert c.get("/api/admin/stats").status_code == 401
        r = c.post("/api/auth/login", data={"username": "admin@example.com", "password": "admin12345"})
        h = {"Authorization": f"Bearer {r.json()['access_token']}"}
        assert c.post("/api/auth/login", data={"username": "admin@example.com", "password": "x"}).status_code == 401

        r = c.post("/api/admin/products", headers=h, json={
            "category_id": 1, "name_ar": "دواء تجريبي", "name_en": "Test Med", "price": 20.5,
            "stock_qty": 10, "requires_pharmacist": True})
        assert r.status_code == 201, r.text
        pid = r.json()["id"]

        pub = c.get("/api/products").json()
        assert len(pub) == 1 and pub[0]["in_stock"] is True and "stock_qty" not in pub[0]

        # طلب: يتطلب مراجعة، بدون رسوم توصيل
        r = c.post("/api/orders", json={"customer_name": "زبون", "phone": "0590000000", "zone_id": 1,
                                        "address": "شارع الجلاء", "items": [{"product_id": pid, "quantity": 2}]})
        assert r.status_code == 201, r.text
        o = r.json()
        assert o["status"] == "pending_pharmacist" and o["delivery_fee"] is None and o["subtotal"] == 41.0

        assert c.get("/api/admin/products", headers=h).json()[0]["stock_qty"] == 8
        assert c.post("/api/orders", json={"customer_name": "زبون", "phone": "0590000000", "zone_id": 1,
                                           "address": "x y z", "items": [{"product_id": pid, "quantity": 50}]}
                      ).status_code == 400

        # الصيدلانية تحدد رسوم اليوم
        r = c.patch(f"/api/admin/orders/{o['id']}", headers=h, json={"delivery_fee": 15, "status": "confirmed"})
        assert r.json()["total"] == 56.0 and r.json()["status"] == "confirmed"

        # إلغاء يعيد الكمية
        c.patch(f"/api/admin/orders/{o['id']}", headers=h, json={"status": "cancelled"})
        assert c.get("/api/admin/products", headers=h).json()[0]["stock_qty"] == 10

        s = c.get("/api/admin/stats", headers=h).json()
        assert s["currency"] == "ILS" and s["orders_need_attention"] == 0
