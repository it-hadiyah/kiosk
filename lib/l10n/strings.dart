class S {
  const S(this.ar);
  final bool ar;

  String _t(String a, String e) => ar ? a : e;

  String get appName => _t('هدية', 'Hadiyah');
  String get langName => _t('العربية', 'English');
  String get back => _t('رجوع', 'Back');
  String get cancel => _t('إلغاء', 'Cancel');
  String get sar => _t('ر.س', 'SAR');

  // الرئيسية
  String get heroTitle => _t(
    'صدقتك في مكة\nبـ 100 ألف حسنة',
    'Your charity in Makkah\nis worth 100,000 rewards',
  );
  String get donateNow => _t('تبرع الان', 'Donate now');
  String get zakatTitle => _t('الزكاة', 'Zakat');
  String get zakatSub => _t(
    '" سيماهم " عون بلا سؤال\nللأسر الأشد حاجة',
    '"Simahum" - help without asking\nfor the families most in need',
  );
  String get sadaqahTitle => _t('صدقتك هدية', 'Your sadaqah, Hadiyah');
  String get sadaqahSub => _t(
    'إعانة لضيف الرحمن\nفي أداء المناسك',
    'Helping the guests of Allah\nperform their rituals',
  );

  // نوافذ المبلغ
  String get sadaqahDialogTitle =>
      _t('تصدق بما تجود به نفسك', 'Give what your heart allows');
  String get sadaqahHint => _t('مبلغ الصدقة', 'Sadaqah amount');
  String get zakatDialogTitle => _t('أخرج زكاتك', 'Pay your Zakat');
  String get zakatHint => _t('مبلغ الزكاة', 'Zakat amount');
  String get continueToPay => _t('متابعة للدفع', 'Continue to payment');

  // صفحة القسم
  String get total => _t('إجمالي المبلغ', 'Total');
  String get donate => _t('تبرع', 'Donate');

  // الدفع
  String get purchase => 'PURCHASE';
  String get tapCardAr => 'يرجى تمرير البطاقة';
  String get tapCardEn => 'Please tap your card';
  String get demoNote =>
      _t('وضع تجريبي: لا يتم أي دفع حقيقي', 'Demo mode: no real payment');
  String get successTitle => _t('جزاك الله خيراً', 'Thank you!');
  String get successSub =>
      _t('تم استلام تبرعك بنجاح', 'Your donation was received');
  String get reference => _t('رقم العملية', 'Reference');

  // الخمول
  String get idleTitle => _t('هل ما زلت هنا؟', 'Are you still there?');
  String get idleSub =>
      _t('سيتم إنهاء الجلسة تلقائياً', 'The session will end automatically');
  String get stay => _t('أنا هنا', "I'm here");
}
