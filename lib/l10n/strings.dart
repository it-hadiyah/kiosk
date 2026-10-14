class S {
  const S(this.ar);
  final bool ar;

  String _t(String a, String e) => ar ? a : e;

  String get appName => _t('هدية', 'Hadiyah');
  String get langName => _t('العربية', 'English');
  String get back => _t('رجوع', 'Back');
  String get cancel => _t('إلغاء', 'Cancel');
  String get sar => _t('ر.س', 'SAR');

  // 1 — المشروع
  String get headline => _t('عطاؤك يصنع أثراً', 'Your giving makes an impact');
  String get headlineSub => _t(
    'اختر المشروع الذي تود دعمه',
    'Choose the project you would like to support',
  );

  // 2 — المبلغ
  String get chooseAmount =>
      _t('اختر مبلغ تبرعك', 'Choose your donation amount');
  String get otherAmount => _t('مبلغ آخر', 'Other amount');
  String get enterAmount => _t('أدخل المبلغ', 'Enter amount');
  String get clear => _t('مسح', 'Clear');
  String get continueToPay => _t('المتابعة للدفع', 'Continue to payment');

  // 3 — محاكاة الدفع
  String get demoBadge =>
      _t('وضع تجريبي — لا يتم خصم أي مبلغ', 'Demo mode — no amount is charged');
  String get tapCard => _t('يرجى تقريب بطاقتك', 'Please tap your card');
  String get stepTap => _t('تقريب البطاقة', 'Tap card');
  String get stepRead => _t('قراءة البطاقة', 'Reading');
  String get stepProcess => _t('المعالجة', 'Processing');
  String get reading => _t('جارٍ قراءة البطاقة', 'Reading your card');
  String get processing =>
      _t('جارٍ معالجة العملية', 'Processing the transaction');
  String get successTitle => _t('تمت المحاكاة بنجاح', 'Simulation completed');
  String get successSub => _t(
    'جزاك الله خيراً — هذه تجربة ولم يتم خصم أي مبلغ',
    'Thank you — this was a demo, nothing was charged',
  );
  String backHomeIn(int n) =>
      _t('العودة للرئيسية خلال $n ثانية', 'Returning home in $n s');
  String get done => _t('إنهاء', 'Done');

  // الخمول
  String get idleTitle => _t('هل ما زلت هنا؟', 'Are you still there?');
  String get idleSub =>
      _t('سيتم إنهاء الجلسة تلقائياً', 'The session will end automatically');
  String get stay => _t('أنا هنا', "I'm here");
}
