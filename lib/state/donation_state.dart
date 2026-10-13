import 'dart:math';

import 'package:flutter/foundation.dart';

import '../data/projects.dart';

/// حالة جلسة المتبرع الحالية. تُمسح بالكامل عند انتهاء الجلسة.
class DonationState extends ChangeNotifier {
  bool arabic = true;
  DonationProject? project;
  int amount = 0;
  String? reference;

  void toggleLanguage() {
    arabic = !arabic;
    notifyListeners();
  }

  void selectProject(DonationProject p) {
    project = p;
    notifyListeners();
  }

  void setAmount(int a) {
    amount = a;
    notifyListeners();
  }

  /// محاكاة تأكيد التبرع (بدون دفع حقيقي).
  Future<void> confirm() async {
    await Future<void>.delayed(const Duration(seconds: 2));
    final r = Random();
    reference =
        'HD-${DateTime.now().millisecondsSinceEpoch % 1000000}'
        '${r.nextInt(90) + 10}';
    notifyListeners();
  }

  /// مسح بيانات المتبرع (الخصوصية) مع الإبقاء على اللغة الافتراضية.
  void reset() {
    project = null;
    amount = 0;
    reference = null;
    arabic = true;
    notifyListeners();
  }
}
