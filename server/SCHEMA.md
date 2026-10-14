# عقد البيانات (catalog.json) وواجهات الخادم

## catalog.json
```
{
  "schemaVersion": 1,
  "updatedAt": "ISO-8601",
  "settings": {
    "idleSeconds": 60,            // خمول قبل التنبيه (10..600)
    "warnSeconds": 15,            // مهلة التنبيه قبل مسح الجلسة (5..120)
    "maxAmount": 99999,           // أقصى مبلغ عام (1..9999999)
    "quickAmounts": [10,50,100,200],  // المبالغ السريعة الافتراضية (1..8 قيم)
    "welcomeBackground": "/uploads/x.jpg" | "asset:assets/images/x.jpg" | "https://...",
    "homeTitle":    { "ar","fr","en","ur" },   // عنوان صفحة البرامج (اختياري)
    "homeSubtitle": { "ar","fr","en","ur" }
  },
  "programs": [ Program ],
  "catalogs": [ Catalog ],
  "home":     [ { "type": "program"|"catalog", "id": "...", "size": "small"|"medium"|"large" } ],
  "featured": {                    // شريط «الأكثر رواجاً» أعلى صفحة المتبرع
    "enabled": true,
    "intervalSeconds": 5,          // مدة بقاء كل عنصر قبل التبديل (2..60)
    "title": { "ar","fr","en","ur" },   // اختياري: نص الشارة (الافتراضي من التطبيق)
    "items": [ { "type": "program"|"catalog", "id": "..." } ]   // حتى 10، بالترتيب
  }
}
```
- **Program**: `id` (a-z0-9_-، فريد)، `active`، `title{ar,fr,en,ur}` (العربية إلزامية)، `image`، `imageAlign` (`center|top|bottom`)،
  `kind` = `open` (مبالغ سريعة + «مبلغ آخر») | `presets` (مبالغ محددة فقط) | `fixed` (قيمة ثابتة) | `free` (بلا مبالغ جاهزة، المتبرع يكتب المبلغ)،
  `price` (للثابت)، `presets[]` (فارغة = تُستخدم `settings.quickAmounts`)، `minAmount`، `maxAmount`،
  `allowQuantity` (للثابت: عدّاد كمية)، `maxQuantity`.
- **Catalog**: `id`، `active`، `title`، `subtitle`، `image`، `imageAlign`، `items:[{programId,size}]`.
- **الأحجام**: `small` = ثلث العرض، `medium` = نصف العرض، `large` = العرض كاملاً. تُرصّ البطاقات في صفوف سعتها 6 وحدات (2/3/6).
- ما لا يظهر: برنامج/كتالوج `active:false`، أو برنامج غير موضوع في الرئيسية ولا في كتالوج.

## الواجهات
| الطريقة | المسار | الوصف |
|---|---|---|
| GET | `/api/catalog` | النسخة **المنشورة** (عامة، تدعم ETag و CORS) — يقرؤها التطبيق |
| GET | `/api/health` | فحص سريع |
| POST | `/api/login` `{password}` | يعيد `{token, expiresAt}` |
| GET | `/api/admin/catalog` | المسودة + `{published:false/true, hasUnpublished}` |
| PUT | `/api/admin/catalog` | حفظ المسودة (تحقق وتطبيع) |
| POST | `/api/admin/publish` | نشر المسودة (ينسخ النسخة السابقة للتاريخ) |
| GET | `/api/admin/history` | قائمة النسخ السابقة `[{id, at}]` |
| POST | `/api/admin/restore` `{id}` | استرجاع نسخة إلى المسودة |
| POST | `/api/admin/upload?name=x.jpg` | جسم الطلب = الصورة (jpg/png/webp حتى 6MB) → `{url}` |
| GET | `/uploads/<file>` | الصور |

الإدارة تتطلب `Authorization: Bearer <token>`.
