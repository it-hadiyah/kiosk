/// اللغات المدعومة. الأسماء بلغتها الأصلية كما تظهر للمستخدم.
enum AppLang {
  ar('ar', 'العربية', true),
  fr('fr', 'Français', false),
  en('en', 'English', false),
  ur('ur', 'اردو', true);

  const AppLang(this.code, this.nativeName, this.rtl);
  final String code;
  final String nativeName;
  final bool rtl;
}

class S {
  const S(this.lang);
  final AppLang lang;

  bool get rtl => lang.rtl;

  String _t(String ar, String fr, String en, String ur) => switch (lang) {
    AppLang.ar => ar,
    AppLang.fr => fr,
    AppLang.en => en,
    AppLang.ur => ur,
  };

  String get appName => _t('هدية', 'Hadiyah', 'Hadiyah', 'ہدیہ');
  String get back => _t('رجوع', 'Retour', 'Back', 'واپس');
  String get cancel => _t('إلغاء', 'Annuler', 'Cancel', 'منسوخ کریں');
  String get sar => _t('ر.س', 'SAR', 'SAR', 'ریال');

  // الترحيب
  String get donateNow =>
      _t('تبرع الآن', 'Faire un don', 'Donate now', 'ابھی عطیہ دیں');

  // 1 — المشروع
  String get headline => _t(
    'عطاؤك يصنع أثراً',
    'Votre don crée un impact',
    'Your giving makes an impact',
    'آپ کا عطیہ فرق پیدا کرتا ہے',
  );
  String get headlineSub => _t(
    'اختر المشروع الذي تود دعمه',
    'Choisissez le projet que vous souhaitez soutenir',
    'Choose the project you would like to support',
    'وہ منصوبہ منتخب کریں جس کی آپ مدد کرنا چاہتے ہیں',
  );

  // 2 — المبلغ
  String get chooseAmount => _t(
    'اختر مبلغ تبرعك',
    'Choisissez le montant de votre don',
    'Choose your donation amount',
    'اپنے عطیے کی رقم منتخب کریں',
  );
  String get otherAmount =>
      _t('مبلغ آخر', 'Autre montant', 'Other amount', 'دوسری رقم');
  String get amountLabel => _t('المبلغ', 'Montant', 'Amount', 'رقم');
  String get continueToPay => _t(
    'المتابعة للدفع',
    'Continuer vers le paiement',
    'Continue to payment',
    'ادائیگی کے لیے آگے بڑھیں',
  );

  // 3 — محاكاة الدفع
  String get demoBadge => _t(
    'وضع تجريبي — لا يتم خصم أي مبلغ',
    "Mode démo — aucun montant n'est débité",
    'Demo mode — no amount is charged',
    'ڈیمو موڈ — کوئی رقم نہیں کاٹی جائے گی',
  );
  String get tapCard => _t(
    'يرجى تقريب بطاقتك',
    'Veuillez approcher votre carte',
    'Please tap your card',
    'براہِ کرم اپنا کارڈ قریب لائیں',
  );
  String get stepTap =>
      _t('تقريب البطاقة', 'Approcher', 'Tap card', 'کارڈ قریب لائیں');
  String get stepRead =>
      _t('قراءة البطاقة', 'Lecture', 'Reading', 'کارڈ پڑھنا');
  String get stepProcess =>
      _t('المعالجة', 'Traitement', 'Processing', 'پروسیسنگ');
  String get reading => _t(
    'جارٍ قراءة البطاقة',
    'Lecture de la carte…',
    'Reading your card',
    'کارڈ پڑھا جا رہا ہے',
  );
  String get processing => _t(
    'جارٍ معالجة العملية',
    'Traitement de la transaction…',
    'Processing the transaction',
    'لین دین پر کارروائی ہو رہی ہے',
  );
  String get successTitle => _t(
    'تمت المحاكاة بنجاح',
    'Simulation réussie',
    'Simulation completed',
    'سمولیشن کامیاب رہی',
  );
  String get successSub => _t(
    'جزاك الله خيراً — هذه تجربة ولم يتم خصم أي مبلغ',
    "Merci — il s'agissait d'une démonstration, rien n'a été débité",
    'Thank you — this was a demo, nothing was charged',
    'جزاک اللہ خیراً — یہ صرف ڈیمو تھا، کوئی رقم نہیں کاٹی گئی',
  );
  String backHomeIn(int n) => _t(
    'العودة للرئيسية خلال $n ثانية',
    "Retour à l'accueil dans $n s",
    'Returning home in $n s',
    '$n سیکنڈ میں ہوم پیج پر واپسی',
  );
  String get done => _t('إنهاء', 'Terminer', 'Done', 'مکمل');

  // الخمول
  String get idleTitle => _t(
    'هل ما زلت هنا؟',
    'Êtes-vous toujours là ?',
    'Are you still there?',
    'کیا آپ ابھی موجود ہیں؟',
  );
  String get idleSub => _t(
    'سيتم إنهاء الجلسة تلقائياً',
    'La session se terminera automatiquement',
    'The session will end automatically',
    'سیشن خودبخود ختم ہو جائے گا',
  );
  String get stay => _t('أنا هنا', 'Je suis là', "I'm here", 'میں یہاں ہوں');
}
