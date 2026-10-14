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

  /// جلسة مفتوحة (بدأت بالضغط على «تبرع الآن» ولم تكتمل).
  bool sessionOpen = false;
  DateTime? _sessionAt;

  CatalogData get data => catalog.data;

  void setLang(AppLang l) {
    if (l == lang) return;
    lang = l;
    notifyListeners();
  }

  /// لإعادة بناء الشاشات عند وصول كتالوج جديد.
  void touch() => notifyListeners();

  void trackStart() {
    if (sessionOpen) return;
    sessionOpen = true;
    _sessionAt = DateTime.now();
    catalog.analytics.log('session_start', lang: lang.code);
  }

  void trackProgram(Program p) =>
      catalog.analytics.log('program_selected', programId: p.id);

  void trackAmount(int a) =>
      catalog.analytics.log('amount_chosen', programId: program?.id, amount: a);

  void trackPaymentStarted() => catalog.analytics.log('payment_started');

  void trackCompleted() {
    final ms = _sessionAt == null
        ? null
        : DateTime.now().difference(_sessionAt!).inMilliseconds;
    catalog.analytics.log(
      'payment_completed',
      programId: program?.id,
      durationMs: ms,
    );
    sessionOpen = false;
  }

  /// عند انتهاء المهلة قبل إتمام المحاكاة.
  void trackAbandoned() {
    if (!sessionOpen) return;
    sessionOpen = false;
    catalog.analytics.log('session_abandoned');
  }

  void reset() {
    lang = AppLang.ar;
    program = null;
    amount = 0;
    sessionOpen = false;
    notifyListeners();
  }
}
