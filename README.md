# Soulmate Image Chooser (Server Version)

نسخة سيرفر تستخدم Playwright عشان تفتح جوجل صور وتختار صورة وترجع رابطها.

## التثبيت المحلي (للتجربة)

```bash
npm install
npx playwright install chromium
node index.js
```

بعدين جرب:

```bash
curl -X POST http://localhost:3000/search -H "Content-Type: application/json" -d "{\"query\":\"صور زهور\"}"
```

## النشر على Railway (الأسهل)

1. اعمل حساب على https://railway.app
2. New Project → Deploy from GitHub (أو ارفع الملفات)
3. أضف المتغيرات إذا احتجت (PORT يجي تلقائي)
4. في Settings → Deploy اضغط Deploy
5. بعد ما يشتغل، خذ الرابط العام (مثل https://xxx.up.railway.app)

### أوامر مهمة بعد الرفع:
Railway يحتاج تثبيت المتصفح. أضف في package.json أو في Build Command:

```
npm install && npx playwright install chromium
```

أو استخدم Dockerfile (أقدر أعطيك إياه إذا احتجت).

## النشر على Render

1. https://render.com → New → Web Service
2. اربط المستودع أو ارفع الملفات
3. Build Command: `npm install && npx playwright install --with-deps chromium`
4. Start Command: `node index.js`
5. اختر Instance من نوع يكون فيه ذاكرة كافية (Playwright يحتاج شوية رام)

## كيف تستخدمه مع البوت

بعد ما يصير عندك رابط السيرفر (مثلاً `https://your-app.up.railway.app`):

من البوت (أو من أي مكان) ترسل:

```
POST https://your-app.up.railway.app/choose
Content-Type: application/json

{
  "url": "https://www.google.com/search?tbm=isch&q=صور+زهور"
}
```

أو:

```
POST https://your-app.up.railway.app/search
{
  "query": "صور زهور طبيعية"
}
```

الرد يكون تقريبًا:

```json
{
  "ok": true,
  "chosen": {
    "title": "...",
    "imageUrl": "https://....jpg",
    "pageUrl": "...",
    "reverseUrl": "https://yandex.com/..."
  }
}
```

## ملاحظات مهمة

- Playwright يحتاج سيرفر فيه رام كافية (يفضل 1GB+).
- جوجل أحيانًا يطلب CAPTCHA، فإذا صار كثير لازم تضيف proxies أو تنتظر.
- هذا الهيكل الأساسي، تقدر توسعه وتربطه بالبوت كامل بعدين.
