import 'package:flutter/foundation.dart';

import '../data/projects.dart';

/// حالة جلسة الكيوسك: اللغة + المشروع والمبلغ المختارين. تُمسح كاملة عند انتهاء الجلسة.
class DonationState extends ChangeNotifier {
  bool arabic = true;
  Project? project;
  int amount = 0;

  void toggleLanguage() {
    arabic = !arabic;
    notifyListeners();
  }

  void reset() {
    arabic = true;
    project = null;
    amount = 0;
    notifyListeners();
  }
}
