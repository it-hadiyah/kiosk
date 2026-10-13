# كيوسك هدية للتبرع — Hadiyah Donation Kiosk

تطبيق Flutter (Android) للخدمة الذاتية للتبرع. **الدفع غير مربوط حالياً** (وضع تجريبي).

- رحلة: ترحيب ← مشروع ← مبلغ ← مراجعة ← شكراً (تعود تلقائياً للرئيسية)
- عربي RTL / English، اتجاه عمودي، ملء الشاشة
- مهلة خمول 60 ثانية مع تنبيه ثم مسح الجلسة
- المشاريع تجريبية في `lib/data/projects.dart`

```
flutter pub get
flutter test
flutter run            # أو: flutter build apk --release
adb install build/app/outputs/flutter-apk/app-release.apk
```
