import 'dart:math';

import 'package:flutter/material.dart';

const kFont = 'IBMPlexSansArabic';

/// ألوان هوية هدية: أخضر تركوازي رئيسي، أبيض/رمادي فاتح، وأخضر داكن للنصوص.
class HColors {
  static const teal = Color(0xFF00A092);
  static const tealDark = Color(0xFF0A7E72);
  static const tealLight = Color(0xFFE6F4F2);
  static const ink = Color(0xFF1F4A47);
  static const muted = Color(0xFF6F8582);
  static const bg = Color(0xFFF4F6F6);
  static const border = Color(0xFFE0E6E5);
  static const success = Color(0xFF2E9E5B);
}

/// التصميم مبني على شاشة 1080×1920 عمودية، ويتكيّف مع الجوال واللوح والكيوسك.
double kioskScale(BuildContext c) {
  final s = MediaQuery.sizeOf(c);
  return min(s.width / 1080, s.height / 1920);
}

extension DimX on BuildContext {
  /// يحوّل قياس التصميم (عرض 1080) إلى قياس الشاشة الفعلية.
  double d(num v) => v * kioskScale(this);

  /// احترام إعداد تقليل الحركة في النظام.
  bool get reduceMotion => MediaQuery.disableAnimationsOf(this);

  Duration ms(int v) =>
      reduceMotion ? Duration.zero : Duration(milliseconds: v);
}

ThemeData buildTheme() => ThemeData(
  useMaterial3: true,
  fontFamily: kFont,
  colorScheme: ColorScheme.fromSeed(
    seedColor: HColors.teal,
    primary: HColors.teal,
  ),
  scaffoldBackgroundColor: HColors.bg,
  splashFactory: InkRipple.splashFactory,
);

/// يحصر المحتوى في عمود بنسبة الشاشة العمودية (للأجهزة العريضة/الأفقية).
Widget kioskFrame(BuildContext context, Widget? child) {
  final w = MediaQuery.sizeOf(context).width;
  final cw = min(w, 1080 * kioskScale(context));
  return ColoredBox(
    color: HColors.bg,
    child: Center(
      child: SizedBox(width: cw, child: child),
    ),
  );
}
