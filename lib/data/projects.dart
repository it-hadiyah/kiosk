import 'package:flutter/painting.dart';

/// مشاريع التبرع (بيانات محلية — لاحقاً تُستبدل بـ API).
class Project {
  const Project(
    this.id,
    this.ar,
    this.en,
    this.image, {
    this.align = Alignment.center,
  });
  final String id;
  final String ar;
  final String en;
  final String image;
  final Alignment align;
  String title(bool isAr) => isAr ? ar : en;
}

const kProjects = <Project>[
  Project('water', 'سقيا الماء', 'Water Giving', 'assets/images/p_water.jpg'),
  Project(
    'iftar',
    'إفطار صائم',
    'Feed a Fasting Person',
    'assets/images/p_iftar.jpg',
  ),
  Project('meal', 'وجبة إطعام', 'Meal Giving', 'assets/images/p_meal.jpg'),
  Project(
    'quran',
    'القرآن الكريم',
    'The Holy Quran',
    'assets/images/cat_quran.jpg',
  ),
  Project('kaffarat', 'الكفارات', 'Kaffarat', 'assets/images/cat_kaffarat.jpg'),
  Project(
    'zakat',
    'الزكاة',
    'Zakat',
    'assets/images/p_zakat.jpg',
    align: Alignment.bottomCenter,
  ),
  Project(
    'sadaqah',
    'صدقتك هدية',
    'Your Sadaqah',
    'assets/images/p_sadaqah.jpg',
  ),
];

const kQuickAmounts = <int>[10, 50, 100, 200];
const kMaxAmount = 99999;
