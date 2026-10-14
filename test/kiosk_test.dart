import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hadiyah_kiosk/app.dart';
import 'package:hadiyah_kiosk/l10n/strings.dart';

void _size(WidgetTester t, [Size size = const Size(1080, 1920)]) {
  t.view.physicalSize = size;
  t.view.devicePixelRatio = 1.0;
  addTearDown(t.view.reset);
}

Future<void> _loadFonts() async {
  final f = FontLoader('IBMPlexSansArabic');
  for (final n in ['Regular', 'Medium', 'Bold']) {
    f.addFont(rootBundle.load('assets/fonts/IBMPlexSansArabic-$n.ttf'));
  }
  await f.load();
}

/// صفحة البداية فيها نبضة متكررة، فلا نستخدم pumpAndSettle عليها.
Future<void> _wait(WidgetTester t, [int ms = 700]) async {
  await t.pump();
  await t.pump(Duration(milliseconds: ms));
}

Future<void> _openProjects(WidgetTester t) async {
  await t.tap(find.byKey(const Key('welcome_donate')));
  await _wait(t);
}

void main() {
  setUpAll(_loadFonts);

  testWidgets('welcome: 4 languages, button text follows the language', (
    t,
  ) async {
    _size(t);
    await t.pumpWidget(const KioskApp());
    await _wait(t);
    for (final l in AppLang.values) {
      expect(find.text(l.nativeName), findsOneWidget);
    }
    // أسماء اللغات بلغاتها وبالإملاء الصحيح
    expect(AppLang.values.map((l) => l.nativeName), [
      'العربية',
      'Français',
      'English',
      'اردو',
    ]);

    final expected = {
      'ar': 'تبرع الآن',
      'fr': 'Faire un don',
      'en': 'Donate now',
      'ur': 'ابھی عطیہ دیں',
    };
    for (final e in expected.entries) {
      await t.tap(find.byKey(Key('lang_${e.key}')));
      await _wait(t, 500);
      expect(find.text(e.value), findsOneWidget, reason: e.key);
    }
  });

  testWidgets('chosen language carries into the projects page', (t) async {
    _size(t);
    await t.pumpWidget(const KioskApp());
    await _wait(t);
    await t.tap(find.byKey(const Key('lang_fr')));
    await _wait(t, 500);
    await _openProjects(t);
    expect(find.text('Votre don crée un impact'), findsOneWidget);
    // تغيير اللغة من الشريط العلوي
    await t.tap(find.byKey(const Key('lang_ur')));
    await _wait(t, 500);
    expect(find.text('آپ کا عطیہ فرق پیدا کرتا ہے'), findsOneWidget);
    // رجوع لصفحة البداية
    await t.tap(find.byKey(const Key('back')));
    await _wait(t);
    expect(find.byKey(const Key('welcome_donate')), findsOneWidget);
  });

  testWidgets(
    '3 steps: project -> amount -> demo payment -> success -> welcome',
    (t) async {
      _size(t);
      await t.pumpWidget(const KioskApp());
      await _wait(t);
      await _openProjects(t);
      expect(find.text('عطاؤك يصنع أثراً'), findsOneWidget);

      await t.tap(find.byKey(const Key('project_iftar')));
      await t.pumpAndSettle();
      expect(find.byKey(const Key('project_name')), findsOneWidget);

      // لا يمكن المتابعة بدون مبلغ
      await t.tap(find.byKey(const Key('continue_pay')));
      await t.pumpAndSettle();
      expect(find.byKey(const Key('pay_amount')), findsNothing);

      await t.tap(find.byKey(const Key('amount_100')));
      await t.pumpAndSettle();
      expect(find.text('100 ر.س'), findsWidgets);
      await t.tap(find.byKey(const Key('continue_pay')));
      await _wait(t);

      expect(find.byKey(const Key('demo_badge')), findsOneWidget);
      expect(find.text('يرجى تقريب بطاقتك'), findsOneWidget);
      await t.pump(const Duration(seconds: 7));
      await t.pump(const Duration(milliseconds: 600));
      expect(find.byKey(const Key('success')), findsOneWidget);

      await t.tap(find.byKey(const Key('done')));
      await _wait(t, 800);
      expect(find.byKey(const Key('welcome_donate')), findsOneWidget);
      expect(find.text('تبرع الآن'), findsOneWidget); // عادت اللغة للعربية
    },
  );

  testWidgets('custom amount keypad, validation and back keeps flow', (
    t,
  ) async {
    _size(t);
    await t.pumpWidget(const KioskApp());
    await _wait(t);
    await _openProjects(t);
    await t.tap(find.byKey(const Key('project_quran')));
    await t.pumpAndSettle();

    await t.tap(find.byKey(const Key('amount_other')));
    await t.pumpAndSettle();
    await t.tap(find.byKey(const Key('key_0'))); // الصفر الأول مرفوض
    await t.tap(find.byKey(const Key('key_2')));
    await t.tap(find.byKey(const Key('key_5')));
    await t.pumpAndSettle();
    expect(find.text('25 ر.س'), findsWidgets);
    await t.tap(find.byKey(const Key('key_back')));
    await t.pumpAndSettle();
    expect(find.text('2 ر.س'), findsWidgets);

    await t.tap(find.byKey(const Key('back')));
    await t.pumpAndSettle();
    expect(find.byKey(const Key('project_zakat')), findsOneWidget);
  });

  testWidgets('cancel during simulation returns to amount, no leaked timers', (
    t,
  ) async {
    _size(t);
    await t.pumpWidget(const KioskApp());
    await _wait(t);
    await _openProjects(t);
    await t.tap(find.byKey(const Key('project_water')));
    await t.pumpAndSettle();
    await t.tap(find.byKey(const Key('amount_10')));
    await t.pumpAndSettle();
    await t.tap(find.byKey(const Key('continue_pay')));
    await _wait(t, 600);
    await t.tap(find.byKey(const Key('back')));
    await t.pump(const Duration(milliseconds: 600));
    await t.pump(
      const Duration(seconds: 10),
    ); // المؤقتات الملغاة لا تُنهي شيئاً
    await t.pumpAndSettle();
    expect(find.byKey(const Key('continue_pay')), findsOneWidget);
  });

  testWidgets('idle on a deep page returns to welcome in Arabic', (t) async {
    _size(t);
    await t.pumpWidget(
      const KioskApp(
        idleTimeout: Duration(seconds: 5),
        warnFor: Duration(seconds: 3),
      ),
    );
    await _wait(t);
    await t.tap(find.byKey(const Key('lang_en')));
    await _wait(t, 500);
    expect(find.text('Donate now'), findsOneWidget);
    await _openProjects(t);
    expect(find.text('Your giving makes an impact'), findsOneWidget);

    await t.pump(const Duration(seconds: 5));
    await t.pump(const Duration(milliseconds: 300));
    await t.pump(const Duration(seconds: 3));
    await _wait(t, 800);
    expect(find.byKey(const Key('welcome_donate')), findsOneWidget);
    expect(find.text('تبرع الآن'), findsOneWidget);
  });

  testWidgets('works on phone, tablet and landscape sizes without overflow', (
    t,
  ) async {
    for (final size in const [
      Size(412, 915),
      Size(1920, 1080),
      Size(800, 1280),
    ]) {
      for (final l in ['ar', 'fr', 'ur']) {
        _size(t, size);
        await t.pumpWidget(const SizedBox.shrink());
        await t.pumpWidget(const KioskApp());
        await _wait(t);
        await t.tap(find.byKey(Key('lang_$l')));
        await _wait(t, 500);
        await _openProjects(t);
        await t.pumpAndSettle();
        await t.ensureVisible(find.byKey(const Key('project_meal')));
        await t.pumpAndSettle();
        await t.tap(find.byKey(const Key('project_meal')));
        await t.pumpAndSettle();
        await t.tap(find.byKey(const Key('amount_50')));
        await t.pumpAndSettle();
        expect(t.takeException(), isNull, reason: '$size $l');
      }
    }
  });
}
