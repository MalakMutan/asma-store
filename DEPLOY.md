# نشر متجر الصيدلانية أسماء مجانًا

المتجر مقسوم لثلاث خدمات مجانية: **Neon** (قاعدة البيانات) + **Render** (الباك إند) + **Vercel** (الواجهة).
حدود الخطط المجانية بتتغير، فتأكدي من صفحات الأسعار الرسمية قبل ما تعتمدي عليها.

## 0) رفع المشروع على GitHub
1. أنشئي حساب على github.com ومستودع (Repository) جديد، يفضل Private.
2. من مجلد المشروع:
```bash
git init && git add . && git commit -m "first version"
git branch -M main
git remote add origin https://github.com/USERNAME/asma-store.git
git push -u origin main
```

## 1) قاعدة البيانات على Neon
1. سجّلي على neon.tech وأنشئي Project جديد.
2. من الصفحة الرئيسية للمشروع اضغطي **Connect** وانسخي رابط الاتصال (Connection string)، شكله `postgresql://user:pass@host/db?sslmode=require`.
3. جهزي الجداول والأقسام من جهازك (مرة واحدة):
```bash
cd backend
python -m venv venv && source venv/bin/activate      # ويندوز: venv\Scripts\activate
pip install -r requirements.txt
export DATABASE_URL="رابط_Neon"  ADMIN_EMAIL="بريد_أسماء"  ADMIN_PASSWORD="كلمة_مرور_قوية"
python seed.py
```
(ويندوز PowerShell: `$env:DATABASE_URL="..."` وهكذا لكل متغير.)

## 2) الباك إند على Render
1. سجّلي على render.com، واختاري **New → Web Service** وصلي المستودع.
2. الإعدادات:
   - Root Directory: `backend`
   - Runtime: Python 3
   - Build Command: `pip install -r requirements.txt`
   - Start Command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
   - Instance Type: **Free**
3. Environment Variables:
   - `DATABASE_URL` = رابط Neon
   - `SECRET_KEY` = نص عشوائي طويل (مثلًا ناتج `python -c "import secrets;print(secrets.token_hex(32))"`)
   - `PYTHON_VERSION` = `3.12.7`
   - `FRONTEND_URL` = رابط Vercel (بنضيفه بالخطوة 4)
4. بعد النشر افتحي `https://اسم-خدمتك.onrender.com/health` ولازم يظهر `{"status":"ok"}`. انسخي هذا الرابط.

## 3) الواجهة على Vercel
1. سجّلي على vercel.com، واختاري **Add New → Project** واستوردي المستودع.
2. الإعدادات: Root Directory = `frontend`، Framework = Vite (بيتعرف عليه تلقائيًا).
3. Environment Variables: `VITE_API_URL` = رابط Render (بدون `/` بالنهاية).
4. اضغطي Deploy، وانسخي رابط الموقع.

## 4) ربط الباك إند بالواجهة
ارجعي لـ Render ← Environment، وضعي `FRONTEND_URL` = رابط Vercel بالضبط (بدون `/` بالنهاية)، وأعيدي النشر. بدون هالخطوة المتصفح بيمنع الطلبات (CORS).

## 5) إبقاء الباك إند صاحي (اختياري)
الخدمة المجانية على Render بتنام بعد فترة خمول، وأول زبون بعدها بيستنى. حلّ مجاني: حساب على uptimerobot.com ومراقبة (HTTP) على `.../health` كل 5 دقائق.

## 6) أول استخدام
- المتجر: رابط Vercel. لوحة التحكم: `رابط-Vercel/admin/login` بالبريد وكلمة المرور اللي حطيتيها بالخطوة 1.
- أضيفي المنتجات من "المنتجات"، وحدّدي رسوم التوصيل لكل طلب من "الطلبات".
- لروابط الصور: ارفعي الصورة على Cloudinary أو أي استضافة صور وانسخي الرابط (رفع الصور المباشر من اللوحة لسا ما انضاف).

## 7) تجربة محلية
```bash
cd backend && cp .env.example .env && python seed.py && uvicorn app.main:app --reload
cd frontend && cp .env.example .env && npm install && npm run dev      # http://localhost:5173
```

## قبل ما تفتحي المتجر للزبائن
- غيّري كلمة مرور الأدمن و`SECRET_KEY` عن القيم الافتراضية.
- جربي طلب كامل بنفسك، وتأكدي من ظهوره بلوحة التحكم.
- تحققي من قانونية بيع الأدوية عن طريق الإنترنت عندكم، وراجعي نقابة الصيادلة إذا لزم.
