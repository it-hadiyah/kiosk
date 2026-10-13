class S {
  const S(this.ar);
  final bool ar;

  String _t(String a, String e) => ar ? a : e;

  String get appName => _t('هدية', 'Hadiyah');
  String get welcomeTitle => _t('مرحباً بك', 'Welcome');
  String get welcomeSub => _t(
    'ساهم في أعمال الخير بخطوات بسيطة',
    'Give to charity in a few simple steps',
  );
  String get start => _t('ابدأ التبرع', 'Start Donating');
  String get otherLang => _t('English', 'العربية');
  String get chooseProject => _t('اختر مشروع التبرع', 'Choose a project');
  String get chooseAmount => _t('اختر مبلغ التبرع', 'Choose an amount');
  String get otherAmount => _t('مبلغ آخر', 'Other amount');
  String get currency => _t('ر.س', 'SAR');
  String get next => _t('التالي', 'Next');
  String get back => _t('رجوع', 'Back');
  String get cancel => _t('إلغاء', 'Cancel');
  String get review => _t('مراجعة التبرع', 'Review your donation');
  String get project => _t('المشروع', 'Project');
  String get amount => _t('المبلغ', 'Amount');
  String get confirm => _t('تأكيد التبرع', 'Confirm Donation');
  String get processing => _t('جاري المعالجة...', 'Processing...');
  String get paymentNote => _t(
    'وضع تجريبي: لا يتم أي دفع حقيقي حالياً',
    'Demo mode: no real payment is processed',
  );
  String get thanksTitle => _t('جزاك الله خيراً', 'Thank you!');
  String get thanksSub =>
      _t('تم استلام تبرعك بنجاح', 'Your donation was received');
  String get receiptNo => _t('رقم العملية', 'Reference');
  String get done => _t('إنهاء', 'Done');
  String get backHomeIn => _t('العودة للرئيسية خلال', 'Returning home in');
  String get seconds => _t('ثانية', 's');
  String get idleTitle => _t('هل ما زلت هنا؟', 'Are you still there?');
  String get idleSub =>
      _t('سيتم إنهاء الجلسة تلقائياً', 'The session will end automatically');
  String get stay => _t('أنا هنا', "I'm here");
  String get enterAmount => _t('أدخل المبلغ', 'Enter amount');
  String get minAmount => _t('الحد الأدنى 1 ريال', 'Minimum is 1 SAR');
  String get clear => _t('مسح', 'Clear');
}
