import 'package:flutter/foundation.dart';

/// حالة الكيوسك: اللغة فقط. تُعاد للافتراضي عند انتهاء الجلسة (خصوصية).
class DonationState extends ChangeNotifier {
  bool arabic = true;

  void toggleLanguage() {
    arabic = !arabic;
    notifyListeners();
  }

  void reset() {
    arabic = true;
    notifyListeners();
  }
}
