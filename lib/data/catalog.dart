/// بيانات الأقسام والمشاريع (تجريبية محلياً — لاحقاً تُستبدل بـ API).
class Project {
  const Project(this.id, this.ar, this.en, this.image);
  final String id;
  final String ar;
  final String en;
  final String image;
  String title(bool isAr) => isAr ? ar : en;
}

class Category {
  const Category({
    required this.id,
    required this.ar,
    required this.en,
    required this.cardImage,
    required this.bannerImage,
    required this.bannerAr,
    required this.bannerEn,
    required this.bannerSubAr,
    required this.bannerSubEn,
    required this.projects,
  });
  final String id;
  final String ar;
  final String en;
  final String cardImage;
  final String bannerImage;
  final String bannerAr;
  final String bannerEn;
  final String bannerSubAr;
  final String bannerSubEn;
  final List<Project> projects;
  String title(bool isAr) => isAr ? ar : en;
  String banner(bool isAr) => isAr ? bannerAr : bannerEn;
  String bannerSub(bool isAr) => isAr ? bannerSubAr : bannerSubEn;
}

const kQuickAmounts = <int>[10, 50, 100, 200];

const kCategories = <Category>[
  Category(
    id: 'water',
    ar: 'السقيا والإطعام',
    en: 'Water & Food',
    cardImage: 'assets/images/cat_water.jpg',
    bannerImage: 'assets/images/banner_water.jpg',
    bannerAr: 'سُقيا تروي ظمأهم\nوإطعامٌ يقوّي خطاهم',
    bannerEn:
        'Water that quenches their thirst\nand food that strengthens them',
    bannerSubAr: 'وبعطائك نحقق رجاهم',
    bannerSubEn: 'With your giving, we answer their hopes',
    projects: [
      Project(
        'water',
        'سقيا الماء',
        'Water Giving',
        'assets/images/p_water.jpg',
      ),
      Project(
        'iftar',
        'إفطار صائم',
        'Feed a Fasting Person',
        'assets/images/p_iftar.jpg',
      ),
      Project('meal', 'وجبة إطعام', 'Meal Giving', 'assets/images/p_meal.jpg'),
    ],
  ),
  // TODO: مشاريع هذا القسم والذي يليه مؤقتة — لم يُرسل لها تصميم.
  Category(
    id: 'quran',
    ar: 'القرآن الكريم',
    en: 'The Holy Quran',
    cardImage: 'assets/images/cat_quran.jpg',
    bannerImage: 'assets/images/cat_quran.jpg',
    bannerAr: 'كلام الله نور\nوهداية للناس',
    bannerEn: 'The words of Allah,\na light and guidance',
    bannerSubAr: 'وبعطائك ينتشر خيره',
    bannerSubEn: 'With your giving, its goodness spreads',
    projects: [
      Project(
        'mushaf',
        'إهداء مصحف',
        'Gift a Mushaf',
        'assets/images/cat_quran.jpg',
      ),
      Project(
        'waqf',
        'وقف مصاحف',
        'Mushaf Endowment',
        'assets/images/cat_quran.jpg',
      ),
    ],
  ),
  Category(
    id: 'kaffarat',
    ar: 'الكفارات',
    en: 'Kaffarat',
    cardImage: 'assets/images/cat_kaffarat.jpg',
    bannerImage: 'assets/images/cat_kaffarat.jpg',
    bannerAr: 'كفارة تُطعم بها المحتاج\nوتُبرئ بها الذمة',
    bannerEn: 'An expiation that feeds the needy\nand clears your obligation',
    bannerSubAr: 'وبعطائك نحقق رجاهم',
    bannerSubEn: 'With your giving, we answer their hopes',
    projects: [
      Project(
        'yameen',
        'كفارة يمين',
        'Oath Expiation',
        'assets/images/cat_kaffarat.jpg',
      ),
      Project(
        'siyam',
        'فدية وكفارة صيام',
        'Fasting Expiation',
        'assets/images/cat_kaffarat.jpg',
      ),
    ],
  ),
];
