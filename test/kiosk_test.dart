import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hadiyah_kiosk/app.dart';

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

void main() {
  setUpAll(_loadFonts);

  testWidgets('3 steps: project -> amount -> demo payment -> success -> home', (
    t,
  ) async {
    _size(t);
    await t.pumpWidget(const KioskApp());
    await t.pumpAndSettle();
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
    await t.pump();
    await t.pump(const Duration(milliseconds: 700));
    expect(find.byKey(const Key('demo_badge')), findsOneWidget);
    expect(find.text('يرجى تقريب بطاقتك'), findsOneWidget);
    await t.pump(const Duration(seconds: 7));
    await t.pump(const Duration(milliseconds: 600));
    expect(find.byKey(const Key('success')), findsOneWidget);

    await t.tap(find.byKey(const Key('done')));
    await t.pumpAndSettle();
    expect(find.text('عطاؤك يصنع أثراً'), findsOneWidget);
  });

  testWidgets('custom amount keypad, validation and back keeps flow', (
    t,
  ) async {
    _size(t);
    await t.pumpWidget(const KioskApp());
    await t.pumpAndSettle();
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
    await t.pumpAndSettle();
    await t.tap(find.byKey(const Key('project_water')));
    await t.pumpAndSettle();
    await t.tap(find.byKey(const Key('amount_10')));
    await t.pumpAndSettle();
    await t.tap(find.byKey(const Key('continue_pay')));
    await t.pump();
    await t.pump(const Duration(milliseconds: 600));
    await t.pump(const Duration(milliseconds: 600));
    await t.tap(find.byKey(const Key('back')));
    await t.pump(const Duration(milliseconds: 600));
    await t.pump(
      const Duration(seconds: 10),
    ); // المؤقتات الملغاة لا تُنهي شيئاً
    await t.pumpAndSettle();
    expect(find.byKey(const Key('continue_pay')), findsOneWidget);
  });

  testWidgets('language toggle and idle reset to projects', (t) async {
    _size(t);
    await t.pumpWidget(
      const KioskApp(
        idleTimeout: Duration(seconds: 5),
        warnFor: Duration(seconds: 3),
      ),
    );
    await t.pumpAndSettle();
    await t.tap(find.byKey(const Key('lang')));
    await t.pumpAndSettle();
    expect(find.text('Your giving makes an impact'), findsOneWidget);

    await t.tap(find.byKey(const Key('project_water')));
    await t.pumpAndSettle();
    await t.pump(const Duration(seconds: 5));
    await t.pump(const Duration(milliseconds: 300));
    await t.pump(const Duration(seconds: 3));
    await t.pumpAndSettle();
    expect(find.text('عطاؤك يصنع أثراً'), findsOneWidget); // رجعت للعربية
  });

  testWidgets('works on phone and landscape sizes without overflow', (t) async {
    for (final size in const [
      Size(412, 915),
      Size(1920, 1080),
      Size(800, 1280),
    ]) {
      _size(t, size);
      await t.pumpWidget(const SizedBox.shrink());
      await t.pumpWidget(const KioskApp());
      await t.pumpAndSettle();
      await t.ensureVisible(find.byKey(const Key('project_meal')));
      await t.pumpAndSettle();
      await t.tap(find.byKey(const Key('project_meal')));
      await t.pumpAndSettle();
      await t.tap(find.byKey(const Key('amount_50')));
      await t.pumpAndSettle();
      expect(hasNoError(t), isTrue);
    }
  });
}

bool hasNoError(WidgetTester t) => t.takeException() == null;
