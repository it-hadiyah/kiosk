import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hadiyah_kiosk/app.dart';

void _size(WidgetTester t) {
  t.view.physicalSize = const Size(1080, 1920);
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

  testWidgets('sadaqah: keypad amount -> payment -> success -> home', (
    t,
  ) async {
    _size(t);
    await t.pumpWidget(const KioskApp());
    await t.tap(find.byKey(const Key('sadaqah')));
    await t.pumpAndSettle();

    expect(find.byKey(const Key('continue_pay')), findsOneWidget);
    await t.tap(find.byKey(const Key('key_2')));
    await t.tap(find.byKey(const Key('key_5')));
    await t.pump();
    expect(find.text('25'), findsOneWidget);
    await t.tap(find.byKey(const Key('continue_pay')));
    await t.pumpAndSettle();

    expect(find.text('25 ر.س'), findsOneWidget);
    await t.pump(const Duration(seconds: 7));
    await t.pump(const Duration(milliseconds: 300));
    expect(find.byKey(const Key('success')), findsOneWidget);
    await t.tap(find.byKey(const Key('done')));
    await t.pumpAndSettle();
    expect(find.byKey(const Key('sadaqah')), findsOneWidget);
  });

  testWidgets('category: chip + qty => total, donate opens payment', (t) async {
    _size(t);
    await t.pumpWidget(const KioskApp());
    await t.tap(find.byKey(const Key('cat_water')));
    await t.pumpAndSettle();

    await t.tap(find.byKey(const Key('chip_iftar_50')));
    await t.tap(find.byKey(const Key('plus_iftar')));
    await t.pump();
    expect(
      find.descendant(
        of: find.byKey(const Key('total_iftar')),
        matching: find.text('100'),
      ),
      findsNothing,
    );
    expect(find.text('100'), findsOneWidget); // 50 × 2
    await t.tap(find.byKey(const Key('donate_iftar')));
    await t.pumpAndSettle();
    expect(find.byKey(const Key('pay_amount')), findsOneWidget);
    await t.tap(find.byKey(const Key('pay_cancel')));
    await t.pumpAndSettle();
    await t.tap(find.byKey(const Key('back')));
    await t.pumpAndSettle();
    expect(find.byKey(const Key('zakat')), findsOneWidget);
  });

  testWidgets('language toggle and idle reset', (t) async {
    _size(t);
    await t.pumpWidget(
      const KioskApp(
        idleTimeout: Duration(seconds: 5),
        warnFor: Duration(seconds: 3),
      ),
    );
    await t.tap(find.byKey(const Key('lang')));
    await t.pumpAndSettle();
    expect(find.text('Donate now'), findsOneWidget);

    await t.tap(find.byKey(const Key('cat_water')));
    await t.pumpAndSettle();
    await t.pump(const Duration(seconds: 5));
    await t.pump(const Duration(milliseconds: 300));
    await t.pump(const Duration(seconds: 3));
    await t.pumpAndSettle();
    expect(find.byKey(const Key('zakat')), findsOneWidget);
    expect(find.text('تبرع الان'), findsOneWidget); // رجعت للعربية
  });
}
