import 'package:flutter/material.dart';

/// ألوان وقياسات هوية هدية. التصميم مبني على شاشة 1080×1920.
const kFont = 'IBMPlexSansArabic';

class HColors {
  static const teal = Color(0xFF00A092);
  static const tealDark = Color(0xFF0A7E72);
  static const tealLight = Color(0xFFE6F4F2);
  static const ink = Color(0xFF33595A);
  static const bg = Color(0xFFF4F4F4);
  static const border = Color(0xFFE2E2E2);
  static const gold = Color(0xFFC4B06A);
}

extension DimX on BuildContext {
  /// يحوّل قياس التصميم (عرض 1080) إلى قياس الشاشة الفعلية.
  double d(num v) => v * MediaQuery.sizeOf(this).width / 1080;
}

ThemeData buildTheme() => ThemeData(
  useMaterial3: true,
  fontFamily: kFont,
  colorScheme: ColorScheme.fromSeed(
    seedColor: HColors.teal,
    primary: HColors.teal,
  ),
  scaffoldBackgroundColor: HColors.bg,
);
