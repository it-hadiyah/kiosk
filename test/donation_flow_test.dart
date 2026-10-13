import 'package:flutter/material.dart' show Key, Size;
import 'package:flutter_test/flutter_test.dart';
import 'package:hadiyah_kiosk/app.dart';

void main() {
  testWidgets('full donation flow then returns home', (tester) async {
    tester.view.physicalSize = const Size(1200, 2000);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(const KioskApp());
    expect(find.text('ابدأ التبرع'), findsOneWidget);

    await tester.tap(find.text('ابدأ التبرع'));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('project_water')));
    await tester.pumpAndSettle();

    await tester.tap(find.byKey(const Key('amount_50')));
    await tester.pumpAndSettle();
    expect(find.text('50 ر.س'), findsWidgets);
    await tester.tap(find.text('التالي'));
    await tester.pumpAndSettle();

    await tester.tap(find.text('تأكيد التبرع'));
    await tester.pump(const Duration(seconds: 3));
    await tester.pumpAndSettle(const Duration(milliseconds: 100));
    expect(find.text('جزاك الله خيراً'), findsOneWidget);

    await tester.tap(find.text('إنهاء'));
    await tester.pumpAndSettle();
    expect(find.text('ابدأ التبرع'), findsOneWidget);
  });

  testWidgets('custom amount via keypad and language toggle', (tester) async {
    tester.view.physicalSize = const Size(1200, 2000);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(const KioskApp());
    await tester.tap(find.text('English'));
    await tester.pumpAndSettle();
    expect(find.text('Start Donating'), findsOneWidget);
    await tester.tap(find.text('Start Donating'));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('project_food')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('amount_other')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('key_2')));
    await tester.tap(find.byKey(const Key('key_5')));
    await tester.pump();
    expect(find.text('25 SAR'), findsOneWidget);
  });

  testWidgets('idle timeout resets session to home', (tester) async {
    tester.view.physicalSize = const Size(1200, 2000);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(
      const KioskApp(
        idleTimeout: Duration(seconds: 5),
        warnFor: Duration(seconds: 3),
      ),
    );
    await tester.tap(find.text('ابدأ التبرع'));
    await tester.pumpAndSettle();
    expect(find.text('اختر مشروع التبرع'), findsOneWidget);

    await tester.pump(const Duration(seconds: 5));
    await tester.pump(const Duration(milliseconds: 300));
    expect(find.text('هل ما زلت هنا؟'), findsOneWidget);
    await tester.pump(const Duration(seconds: 3));
    await tester.pumpAndSettle();
    expect(find.text('ابدأ التبرع'), findsOneWidget);
  });
}
