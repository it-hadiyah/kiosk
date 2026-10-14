import 'package:flutter/painting.dart';

import '../l10n/strings.dart';

/// مشاريع التبرع (بيانات محلية — لاحقاً تُستبدل بـ API).
class Project {
  const Project(
    this.id,
    this.ar,
    this.fr,
    this.en,
    this.ur,
    this.image, {
    this.align = Alignment.center,
  });
  final String id;
  final String ar;
  final String fr;
  final String en;
  final String ur;
  final String image;
  final Alignment align;

  String title(AppLang l) => switch (l) {
    AppLang.ar => ar,
    AppLang.fr => fr,
    AppLang.en => en,
    AppLang.ur => ur,
  };
}

const kProjects = <Project>[
  Project(
    'water',
    'سقيا الماء',
    "Offrir de l'eau",
    'Water Giving',
    'پانی پلانا',
    'assets/images/p_water.jpg',
  ),
  Project(
    'iftar',
    'إفطار صائم',
    "Iftar d'un jeûneur",
    'Feed a Fasting Person',
    'روزہ دار کا افطار',
    'assets/images/p_iftar.jpg',
  ),
  Project(
    'meal',
    'وجبة إطعام',
    'Offrir un repas',
    'Meal Giving',
    'کھانا کھلانا',
    'assets/images/p_meal.jpg',
  ),
  Project(
    'quran',
    'القرآن الكريم',
    'Le Saint Coran',
    'The Holy Quran',
    'قرآنِ کریم',
    'assets/images/cat_quran.jpg',
  ),
  Project(
    'kaffarat',
    'الكفارات',
    'Expiations (Kaffarat)',
    'Kaffarat',
    'کفارات',
    'assets/images/cat_kaffarat.jpg',
  ),
  Project(
    'zakat',
    'الزكاة',
    'Zakat',
    'Zakat',
    'زکوٰۃ',
    'assets/images/p_zakat.jpg',
    align: Alignment.bottomCenter,
  ),
  Project(
    'sadaqah',
    'صدقتك هدية',
    'Votre sadaqa',
    'Your Sadaqah',
    'آپ کا صدقہ',
    'assets/images/p_sadaqah.jpg',
    align: Alignment.bottomCenter,
  ),
];

const kQuickAmounts = <int>[10, 50, 100, 200];
const kMaxAmount = 99999;
