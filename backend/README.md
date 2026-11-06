# Ph. Asma Store — Backend

```bash
cd backend
python -m venv venv && source venv/bin/activate   # ويندوز: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env        # عدّلي القيم (خصوصًا SECRET_KEY وكلمة المرور)
python seed.py              # ينشئ الجداول والأقسام وحساب الصيدلانية
uvicorn app.main:app --reload
```
افتحي http://localhost:8000/docs لتجربة كل الـ API (زر Authorize لتسجيل الدخول).

الاختبار: `pip install -r requirements-dev.txt && pytest`

## أهم المسارات
- الزبون: `GET /api/categories`، `GET /api/products`، `GET /api/zones`، `POST /api/orders`
- الصيدلانية (تحتاج تسجيل دخول): `/api/admin/{stats,categories,products,orders,upload-signature}`

للانتقال إلى Neon: ضعي رابط الاتصال في DATABASE_URL وأعيدي `python seed.py`.
