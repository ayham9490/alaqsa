# نظام المحاسبة الاحترافي

## 🚀 نظرة عامة

نظام محاسبة احترافي متكامل يعمل كـ PWA (Progressive Web App) مع دعم:
- إدارة العمليات المالية (بيع، شراء، دفعات، مصاريف)
- إدارة الحسابات
- كشف الحساب
- إدارة الصندوق متعدد العملات
- تقارير بيانية
- التثبيت على الهاتف والعمل Offline

---

## 📁 هيكل المشروع

```
accounting-system/
├── index.html                  # الصفحة الرئيسية
├── manifest.json               # إعدادات PWA
├── service-worker.js           # Service Worker للـ Offline
├── css/
│   └── style.css               # ملف الأنماط الكامل
├── js/
│   ├── api.js                  # التواصل مع Google Sheets + LocalStorage
│   ├── auth.js                 # تسجيل الدخول والخروج
│   ├── app.js                  # الملف الرئيسي + UI helpers
│   ├── transactions.js         # إدارة العمليات
│   ├── accounts.js             # إدارة الحسابات
│   ├── statement.js            # كشف الحساب
│   ├── cashbox.js              # الصندوق
│   ├── reports.js              # التقارير والرسوم البيانية
│   └── settings.js             # الإعدادات
├── assets/
│   └── icons/                  # أيقونات PWA
├── google-apps-script/
│   └── Code.gs                 # Backend Google Apps Script
└── README.md
```

---

## ⚙️ خطوات النشر

### 1. GitHub Pages

```bash
# رفع المشروع إلى GitHub
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/USERNAME/REPO.git
git push -u origin main

# تفعيل GitHub Pages من Settings > Pages > Source: main branch
```

### 2. Google Apps Script (اختياري)

1. افتح [Google Sheets](https://sheets.google.com) وأنشئ جدولاً جديداً
2. افتح `Extensions > Apps Script`
3. الصق محتوى `google-apps-script/Code.gs`
4. اضغط `Deploy > New deployment`
   - Type: Web App
   - Execute as: Me
   - Who has access: Anyone
5. انسخ الرابط
6. في التطبيق: الإعدادات > إعدادات Google Sheets > الصق الرابط

> **ملاحظة:** التطبيق يعمل بـ LocalStorage بدون Google Sheets

---

## 🔑 بيانات الدخول الافتراضية

| الحقل | القيمة |
|-------|--------|
| اسم المستخدم | `admin` |
| كلمة المرور | `1234` |

يمكن تغييرها من الإعدادات > إدارة المستخدم

---

## 💱 العملات المدعومة

- USD (دولار أمريكي) - افتراضي
- TRY (ليرة تركية)
- SYP (ليرة سورية)
- إضافة أي عملة من الإعدادات

---

## 🛢 حساب البراميل

```
البراميل = الوزن (كغ) ÷ الكثافة (كغ/لتر) ÷ 220
الإجمالي (USD) = البراميل × سعر البرميل
```

---

## 📦 المتطلبات

- متصفح حديث (Chrome / Firefox / Safari / Edge)
- لا يحتاج Node.js أو أي أدوات بناء
- اتصال إنترنت للمزامنة مع Google Sheets (اختياري)

---

## 🔧 التخصيص

### تغيير الألوان
من الإعدادات > المظهر، أو عبر CSS Variables في `style.css`:
```css
:root {
  --primary: #1a3c5e;      /* اللون الرئيسي */
  --secondary: #c9a227;    /* اللون الثانوي */
}
```

### تغيير الخط
يدعم: Amiri، Noto Kufi Arabic، Tajawal

---

## 📱 PWA - تثبيت التطبيق

### Android
1. افتح الموقع في Chrome
2. اضغط القائمة (⋮) > "إضافة إلى الشاشة الرئيسية"

### iOS
1. افتح الموقع في Safari
2. اضغط زر المشاركة > "إضافة إلى الشاشة الرئيسية"

---

## 🔒 الأمان

- البيانات تُحفظ في `localStorage` على الجهاز
- كلمات المرور لا تُرسل لأي خادم
- يُنصح بتفعيل HTTPS عند النشر

---

## 🛠️ PWABuilder (Windows MSIX / Android APK)

1. انشر المشروع على GitHub Pages
2. اذهب إلى [pwabuilder.com](https://pwabuilder.com)
3. أدخل رابط موقعك
4. اختر المنصة (Windows / Android)
5. حمّل الحزمة وانشرها

---

## 📄 الترخيص

MIT License - مشروع مفتوح المصدر
