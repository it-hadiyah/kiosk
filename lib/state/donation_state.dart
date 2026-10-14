import 'package:flutter/foundation.dart';

import '../data/projects.dart';
import '../l10n/strings.dart';

/// حالة جلسة الكيوسك: اللغة + المشروع والمبلغ المختارين. تُمسح كاملة عند انتهاء الجلسة.
class DonationState extends ChangeNotifier {
  AppLang lang = AppLang.ar;
  Project? project;
  int amount = 0;

  void setLang(AppLang l) {
    if (l == lang) return;
    lang = l;
    notifyListeners();
  }

  void reset() {
    lang = AppLang.ar;
    project = null;
    amount = 0;
    notifyListeners();
  }
}
