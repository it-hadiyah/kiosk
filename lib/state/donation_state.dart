import 'package:flutter/foundation.dart';

import '../data/catalog_service.dart';
import '../data/models.dart';
import '../l10n/strings.dart';

/// حالة جلسة الكيوسك: اللغة + البرنامج والمبلغ المختارين + مصدر الكتالوج.
/// تُمسح كاملة عند انتهاء الجلسة.
class DonationState extends ChangeNotifier {
  DonationState(this.catalog);

  final CatalogService catalog;
  AppLang lang = AppLang.ar;
  Program? program;
  int amount = 0;

  CatalogData get data => catalog.data;

  void setLang(AppLang l) {
    if (l == lang) return;
    lang = l;
    notifyListeners();
  }

  /// لإعادة بناء الشاشات عند وصول كتالوج جديد.
  void touch() => notifyListeners();

  void reset() {
    lang = AppLang.ar;
    program = null;
    amount = 0;
    notifyListeners();
  }
}
