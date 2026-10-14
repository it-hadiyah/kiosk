import 'dart:math';

import 'package:flutter/material.dart';

import '../theme/theme.dart';

/// رسم متحرك لتقريب البطاقة من القارئ (NFC): البطاقة تقترب وتنبض الموجات.
/// [t] قيمة 0..1 متكررة، [reading] تُظهر تأكيد القراءة (توهج أخضر).
class NfcPainter extends CustomPainter {
  NfcPainter({required this.t, required this.reading});
  final double t;
  final bool reading;

  @override
  void paint(Canvas canvas, Size size) {
    final w = size.width, h = size.height;
    final accent = reading ? HColors.success : HColors.teal;

    // القارئ (الجهاز) في الأسفل
    final reader = RRect.fromRectAndRadius(
      Rect.fromLTWH(w * .22, h * .62, w * .56, h * .30),
      Radius.circular(w * .06),
    );
    canvas.drawRRect(
      reader.shift(Offset(0, h * .02)),
      Paint()
        ..color = Colors.black.withValues(alpha: .08)
        ..maskFilter = MaskFilter.blur(BlurStyle.normal, w * .03),
    );
    canvas.drawRRect(reader, Paint()..color = const Color(0xFF263B39));
    // شاشة صغيرة على القارئ
    canvas.drawRRect(
      RRect.fromRectAndRadius(
        Rect.fromLTWH(w * .30, h * .67, w * .40, h * .08),
        Radius.circular(w * .02),
      ),
      Paint()..color = accent.withValues(alpha: .9),
    );

    // موجات NFC تنبض من القارئ إلى الأعلى
    final center = Offset(w * .5, h * .60);
    for (var i = 0; i < 3; i++) {
      final p = (t + i / 3) % 1.0;
      final r = w * (.10 + .26 * p);
      final paint = Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = w * .018
        ..strokeCap = StrokeCap.round
        ..color = accent.withValues(alpha: (1 - p) * .85);
      canvas.drawArc(
        Rect.fromCircle(center: center, radius: r),
        -pi * .82,
        pi * .64,
        false,
        paint,
      );
    }

    // البطاقة: تنزل نحو القارئ ثم تعود (حركة طبيعية)
    final move = (sin(t * 2 * pi - pi / 2) + 1) / 2; // 0..1
    final cardW = w * .42, cardH = cardW * .63;
    final top = h * (.10 + .22 * move);
    canvas.save();
    canvas.translate(w * .5, top + cardH / 2);
    canvas.rotate(-.12 + .08 * move);
    final card = RRect.fromRectAndRadius(
      Rect.fromCenter(center: Offset.zero, width: cardW, height: cardH),
      Radius.circular(cardW * .09),
    );
    canvas.drawRRect(
      card.shift(Offset(0, cardH * .08)),
      Paint()
        ..color = Colors.black.withValues(alpha: .15)
        ..maskFilter = MaskFilter.blur(BlurStyle.normal, cardW * .06),
    );
    canvas.drawRRect(
      card,
      Paint()
        ..shader = LinearGradient(
          colors: [accent, HColors.tealDark],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ).createShader(card.outerRect),
    );
    // شريط وشريحة
    canvas.drawRect(
      Rect.fromLTWH(-cardW / 2, -cardH * .22, cardW, cardH * .16),
      Paint()..color = Colors.black.withValues(alpha: .25),
    );
    canvas.drawRRect(
      RRect.fromRectAndRadius(
        Rect.fromLTWH(-cardW * .38, cardH * .08, cardW * .2, cardH * .24),
        Radius.circular(cardW * .03),
      ),
      Paint()..color = const Color(0xFFF1D88A),
    );
    canvas.restore();
  }

  @override
  bool shouldRepaint(NfcPainter old) => old.t != t || old.reading != reading;
}

/// علامة صح تُرسم تدريجياً (حركة نجاح).
class CheckPainter extends CustomPainter {
  CheckPainter(this.p);
  final double p; // 0..1

  @override
  void paint(Canvas canvas, Size size) {
    final c = size.center(Offset.zero);
    final r = size.width / 2;
    final fill = Paint()..color = HColors.success.withValues(alpha: .12);
    canvas.drawCircle(
      c,
      r * Curves.easeOutBack.transform(min(1, p * 1.6)).clamp(0.0, 1.2),
      fill,
    );

    final ring = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = r * .09
      ..strokeCap = StrokeCap.round
      ..color = HColors.success;
    canvas.drawArc(
      Rect.fromCircle(center: c, radius: r * .86),
      -pi / 2,
      2 * pi * min(1, p * 1.4),
      false,
      ring,
    );

    final path = Path()
      ..moveTo(c.dx - r * .34, c.dy + r * .02)
      ..lineTo(c.dx - r * .10, c.dy + r * .27)
      ..lineTo(c.dx + r * .38, c.dy - r * .22);
    final m = path.computeMetrics().first;
    final tick = ((p - .45) / .55).clamp(0.0, 1.0);
    canvas.drawPath(
      m.extractPath(0, m.length * tick),
      ring..strokeWidth = r * .12,
    );
  }

  @override
  bool shouldRepaint(CheckPainter old) => old.p != p;
}
