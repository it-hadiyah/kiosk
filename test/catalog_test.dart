import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hadiyah_kiosk/app.dart';
import 'package:hadiyah_kiosk/data/analytics.dart';
import 'package:hadiyah_kiosk/data/catalog_service.dart';
import 'package:hadiyah_kiosk/data/models.dart';
import 'package:hadiyah_kiosk/l10n/strings.dart';
import 'package:hadiyah_kiosk/theme/theme.dart';

Map<String, dynamic> _prog(
  String id, {
  Map<String, dynamic> extra = const {},
}) => {
  'id': id,
  'title': {'ar': 'برنامج $id', 'en': 'Program $id'},
  'image': '',
  'kind': 'open',
  ...extra,
};

CatalogData _data({
  List<Map<String, dynamic>> programs = const [],
  List<Map<String, dynamic>> catalogs = const [],
  List<Map<String, dynamic>> home = const [],
  Map<String, dynamic> settings = const {},
  Map<String, dynamic>? featured,
}) => CatalogData.fromJson({
  'featured': ?featured,
  'settings': settings,
  'programs': programs,
  'catalogs': catalogs,
  'home': home,
});

void main() {
  setUpAll(() async {
    final f = FontLoader('IBMPlexSansArabic');
    for (final n in ['Regular', 'Medium', 'Bold']) {
      f.addFont(rootBundle.load('assets/fonts/IBMPlexSansArabic-$n.ttf'));
    }
    await f.load();
  });

  group('models', () {
    test('packRows fills rows of 6 units (small=2, medium=3, large=6)', () {
      Tile t(String id, TileSize s) =>
          Tile.program(Program(id: id, title: Localized.empty, image: ''), s);
      final rows = packRows([
        t('a', TileSize.medium), t('b', TileSize.medium), // 3+3
        t('c', TileSize.small),
        t('d', TileSize.small),
        t('e', TileSize.small), // 2+2+2
        t('f', TileSize.large), // 6
        t('g', TileSize.medium), // 3 وحيد
        t('h', TileSize.large), // لا يتسع بجانب g → صف جديد
      ]);
      expect(rows.map((r) => r.map((x) => x.program!.id).join()).toList(), [
        'ab',
        'cde',
        'f',
        'g',
        'h',
      ]);
    });

    test('Localized falls back: language -> ar -> en -> any', () {
      const l = Localized({'ar': 'س', 'en': 'E'});
      expect(l.of(AppLang.fr), 'س');
      expect(const Localized({'en': 'E'}).of(AppLang.ur), 'E');
      expect(const Localized({'fr': 'F'}).of(AppLang.ur), 'F');
      expect(l.exact(AppLang.fr), '');
    });

    test('fromJson ignores garbage and applies defaults', () {
      final d = CatalogData.fromJson({
        'programs': [
          null,
          5,
          {'title': {}},
          _prog('ok'),
          {'id': 'x', 'kind': 'weird', 'price': 'abc'},
        ],
        'catalogs': [
          'bad',
          {
            'id': 'c',
            'items': [
              1,
              {'programId': 'ok', 'size': 'huge'},
            ],
          },
        ],
        'home': [
          {'type': 'program', 'id': 'ok', 'size': 'nonsense'},
          'junk',
        ],
        'settings': {
          'idleSeconds': 1,
          'quickAmounts': ['a', -5],
        },
      });
      expect(d.programs.map((p) => p.id), ['ok', 'x']);
      expect(d.program('x')!.kind, ProgramKind.open);
      expect(d.catalog('c')!.items.single.size, TileSize.medium);
      expect(d.home.single.size, TileSize.medium);
      expect(d.settings.idleSeconds, 10); // مقيّد بالحد الأدنى
      expect(d.settings.quickAmounts, [10, 50, 100, 200]);
      expect(() => CatalogData.fromJson([]), throwsFormatException);
    });

    test('homeTiles hides inactive, missing and empty catalogs', () {
      final d = _data(
        programs: [
          _prog('a'),
          _prog('b', extra: {'active': false}),
          _prog('c'),
        ],
        catalogs: [
          {
            'id': 'full',
            'title': {'ar': 'ك'},
            'items': [
              {'programId': 'a'},
              {'programId': 'b'},
            ],
          },
          {
            'id': 'empty',
            'title': {'ar': 'ف'},
            'items': [
              {'programId': 'b'},
            ],
          },
          {
            'id': 'off',
            'active': false,
            'title': {'ar': 'م'},
            'items': [
              {'programId': 'a'},
            ],
          },
        ],
        home: [
          {'type': 'program', 'id': 'a'},
          {'type': 'program', 'id': 'b'},
          {'type': 'program', 'id': 'zzz'},
          {'type': 'catalog', 'id': 'full'},
          {'type': 'catalog', 'id': 'empty'},
          {'type': 'catalog', 'id': 'off'},
        ],
      );
      expect(d.homeTiles.map((t) => t.key), ['program_a', 'catalog_full']);
      expect(d.tilesOfCatalog(d.catalog('full')!).map((t) => t.key), [
        'program_a',
      ]);
    });

    test(
      'bundled default catalog and server seed describe the same catalog',
      () {
        final seed = CatalogData.fromJson(
          jsonDecode(File('server/seed/catalog.json').readAsStringSync()),
        );
        final def = CatalogData.defaults();
        expect(def.programs.map((p) => p.id), seed.programs.map((p) => p.id));
        expect(def.homeTiles.length, seed.homeTiles.length);
        expect(def.homeTiles.length, greaterThan(0));
        // الصور المضمّنة تشير لملفات موجودة
        for (final p in def.programs) {
          expect(p.image.startsWith('asset:'), isTrue);
          expect(
            File(p.image.substring(6)).existsSync(),
            isTrue,
            reason: p.image,
          );
        }
        // كل لغة لها عنوان لكل برنامج
        for (final p in def.programs) {
          for (final l in AppLang.values) {
            expect(p.title.exact(l), isNotEmpty, reason: '${p.id} ${l.code}');
          }
        }
      },
    );
  });

  group('CatalogService', () {
    late Directory tmp;
    setUp(() => tmp = Directory.systemTemp.createTempSync('hd_cat_'));
    tearDown(() => tmp.deleteSync(recursive: true));

    String body(String id) => jsonEncode({
      'programs': [_prog(id)],
      'home': [
        {'type': 'program', 'id': id},
      ],
    });

    test('refresh: 200 updates, 304 keeps, invalid keeps old, errors recorded, etag sent', () async {
      final seenEtags = <String?>[];
      var next = FetchResult(200, body: body('one'), etag: '"v1"');
      final svc = CatalogService(
        baseUrl: 'http://host/',
        cacheDir: tmp,
        refreshEvery: Duration.zero,
        fetcher: (url, {etag}) async {
          seenEtags.add(etag);
          expect(
            url.toString(),
            'http://host/api/catalog',
          ); // المائلة الأخيرة تُحذف
          return next;
        },
      );
      var notified = 0;
      svc.addListener(() => notified++);

      await svc.refresh();
      expect(svc.data.programs.single.id, 'one');
      expect(notified, greaterThan(0));

      next = const FetchResult(304);
      await svc.refresh();
      expect(seenEtags, [null, '"v1"']);
      expect(svc.data.programs.single.id, 'one');

      next = const FetchResult(200, body: '{not json', etag: '"bad"');
      await svc.refresh();
      expect(svc.data.programs.single.id, 'one'); // بقيت النسخة الصالحة
      expect(svc.lastError, isNotNull);

      next = const FetchResult(500);
      await svc.refresh();
      expect(svc.lastError, 'HTTP 500');
      expect(svc.data.programs.single.id, 'one');
    });

    test('init: loads cached copy first, works offline, and offline default without baseUrl', () async {
      await File('${tmp.path}/catalog.json').writeAsString(body('cached'));
      final offline = CatalogService(
        baseUrl: 'http://host',
        cacheDir: tmp,
        refreshEvery: Duration.zero,
        fetcher: (u, {etag}) async => throw const SocketException('no network'),
      );
      await offline.init();
      expect(offline.data.programs.single.id, 'cached');
      await offline.refresh();
      expect(offline.lastError, contains('no network'));
      expect(offline.data.programs.single.id, 'cached');

      final noServer = CatalogService(
        baseUrl: '',
        cacheDir: Directory('${tmp.path}/none'),
      );
      await noServer.init();
      expect(
        noServer.data.programs.length,
        CatalogData.defaults().programs.length,
      );
    });

    test('image sources: bundled, absolute, relative to server', () {
      final svc = CatalogService(
        baseUrl: 'http://h:8080',
        cacheDir: tmp,
        refreshEvery: Duration.zero,
      );
      expect(svc.imageFor(''), isNull);
      expect(svc.imageFor('asset:assets/images/logo.png'), isA<AssetImage>());
      expect(svc.remoteUrl('/uploads/a.jpg'), 'http://h:8080/uploads/a.jpg');
      expect(svc.remoteUrl('https://x.y/z.png'), 'https://x.y/z.png');
      expect(svc.remoteUrl('asset:foo'), isNull);
      expect(svc.imageFor('/uploads/a.jpg'), isA<NetworkImage>());
    });
  });

  group('screens follow the catalog', () {
    void size(WidgetTester t) {
      t.view.physicalSize = const Size(1080, 1920);
      t.view.devicePixelRatio = 1.0;
      addTearDown(t.view.reset);
    }

    Future<void> wait(WidgetTester t, [int ms = 700]) async {
      await t.pump();
      await t.pump(Duration(milliseconds: ms));
    }

    Future<void> start(WidgetTester t, CatalogData d) async {
      size(t);
      await t.pumpWidget(KioskApp(catalog: CatalogService.fixed(d)));
      await wait(t);
      await t.tap(find.byKey(const Key('welcome_donate')));
      await wait(t);
    }

    testWidgets(
      'catalog tile opens catalog page; program opens amount; inactive program is hidden',
      (t) async {
        await start(
          t,
          _data(
            programs: [
              _prog('a'),
              _prog('b'),
              _prog('hidden', extra: {'active': false}),
            ],
            catalogs: [
              {
                'id': 'cat1',
                'title': {'ar': 'كتالوج تجريبي'},
                'subtitle': {'ar': 'وصف'},
                'items': [
                  {'programId': 'a', 'size': 'small'},
                  {'programId': 'b', 'size': 'small'},
                  {'programId': 'hidden'},
                ],
              },
            ],
            home: [
              {'type': 'catalog', 'id': 'cat1', 'size': 'large'},
              {'type': 'program', 'id': 'hidden'},
            ],
          ),
        );
        expect(find.byKey(const Key('catalog_cat1')), findsOneWidget);
        expect(find.byKey(const Key('program_hidden')), findsNothing);
        expect(find.byKey(const Key('badge_catalog_cat1')), findsOneWidget);

        await t.tap(find.byKey(const Key('catalog_cat1')));
        await t.pumpAndSettle();
        expect(find.byKey(const Key('catalog_title')), findsOneWidget);
        expect(find.byKey(const Key('program_a')), findsOneWidget);
        expect(find.byKey(const Key('program_hidden')), findsNothing);

        await t.tap(find.byKey(const Key('program_b')));
        await t.pumpAndSettle();
        expect(find.text('برنامج b'), findsOneWidget);
        expect(find.byKey(const Key('continue_pay')), findsOneWidget);
      },
    );

    testWidgets(
      'fixed program: locked price, optional quantity multiplies the total',
      (t) async {
        await start(
          t,
          _data(
            programs: [
              _prog(
                'f',
                extra: {
                  'kind': 'fixed',
                  'price': 15,
                  'allowQuantity': true,
                  'maxQuantity': 3,
                },
              ),
            ],
            home: [
              {'type': 'program', 'id': 'f'},
            ],
          ),
        );
        await t.tap(find.byKey(const Key('program_f')));
        await t.pumpAndSettle();
        expect(find.byKey(const Key('fixed_card')), findsOneWidget);
        expect(find.byKey(const Key('amount_other')), findsNothing);
        expect(find.text('15 ر.س'), findsWidgets);

        await t.tap(find.byKey(const Key('qty_plus')));
        await t.pumpAndSettle();
        await t.tap(find.byKey(const Key('qty_plus')));
        await t.pumpAndSettle();
        await t.tap(find.byKey(const Key('qty_plus'))); // الحد الأعلى 3
        await t.pumpAndSettle();
        expect(find.text('3'), findsOneWidget);
        expect(find.text('45 ر.س'), findsWidgets);

        await t.tap(find.byKey(const Key('continue_pay')));
        await wait(t);
        expect(find.byKey(const Key('pay_amount')), findsOneWidget);
        expect(find.text('45 ر.س'), findsOneWidget);
        await t.pump(const Duration(seconds: 9));
        await t.pump(const Duration(seconds: 7)); // يكتمل ويعود
        await t.pump(const Duration(seconds: 1));
      },
    );

    testWidgets(
      'fixed without quantity shows no stepper; presets-only has no custom amount',
      (t) async {
        await start(
          t,
          _data(
            programs: [
              _prog('f', extra: {'kind': 'fixed', 'price': 20}),
              _prog(
                'p',
                extra: {
                  'kind': 'presets',
                  'presets': [5, 25, 75],
                },
              ),
            ],
            home: [
              {'type': 'program', 'id': 'f'},
              {'type': 'program', 'id': 'p'},
            ],
          ),
        );
        await t.tap(find.byKey(const Key('program_f')));
        await t.pumpAndSettle();
        expect(find.byKey(const Key('qty_plus')), findsNothing);
        expect(find.byKey(const Key('continue_pay')), findsOneWidget);
        await t.tap(find.byKey(const Key('back')));
        await t.pumpAndSettle();

        await t.tap(find.byKey(const Key('program_p')));
        await t.pumpAndSettle();
        expect(find.byKey(const Key('amount_5')), findsOneWidget);
        expect(find.byKey(const Key('amount_75')), findsOneWidget);
        expect(
          find.byKey(const Key('amount_10')),
          findsNothing,
        ); // لا تظهر المبالغ العامة
        expect(find.byKey(const Key('amount_other')), findsNothing);
      },
    );

    testWidgets('free program opens a popup with keypad then goes to payment', (
      t,
    ) async {
      await start(
        t,
        _data(
          programs: [
            _prog(
              'z',
              extra: {
                'kind': 'free',
                'popupTitle': {'ar': 'عنوان النافذة'},
                'popupHint': {'ar': 'نص الحقل'},
              },
            ),
          ],
          home: [
            {'type': 'program', 'id': 'z'},
          ],
        ),
      );
      await t.tap(find.byKey(const Key('program_z')));
      await t.pumpAndSettle();
      expect(find.byKey(const Key('amount_popup')), findsOneWidget);
      expect(find.text('عنوان النافذة'), findsOneWidget);
      expect(find.text('نص الحقل'), findsOneWidget);
      expect(find.byKey(const Key('amount_50')), findsNothing);
      expect(find.byKey(const Key('amount_other')), findsNothing);
      // بلا مبلغ لا يعمل زر التبرع
      await t.tap(find.byKey(const Key('popup_donate')));
      await t.pumpAndSettle();
      expect(find.byKey(const Key('amount_popup')), findsOneWidget);
      await t.tap(find.byKey(const Key('key_7')));
      await t.tap(find.byKey(const Key('key_5')));
      await t.pumpAndSettle();
      expect(find.text('75'), findsWidgets);
      await t.tap(find.byKey(const Key('popup_donate')));
      await t.pumpAndSettle();
      expect(find.byKey(const Key('amount_popup')), findsNothing);
      expect(find.byKey(const Key('pay_amount')), findsOneWidget);
      expect(find.text('75 ر.س'), findsWidgets);
    });

    testWidgets('free popup renders with a background image', (t) async {
      await start(
        t,
        _data(
          programs: [
            _prog(
              'z',
              extra: {
                'kind': 'free',
                'popupImage': 'asset:assets/images/p_water.jpg',
              },
            ),
          ],
          home: [
            {'type': 'program', 'id': 'z'},
          ],
        ),
      );
      await t.tap(find.byKey(const Key('program_z')));
      await t.pumpAndSettle();
      expect(find.byKey(const Key('amount_popup')), findsOneWidget);
      expect(find.byType(AppImage), findsWidgets);
      expect(t.takeException(), isNull);
    });

    testWidgets('free popup accepts amounts beyond the global max', (t) async {
      await start(
        t,
        _data(
          programs: [
            _prog('z', extra: {'kind': 'free'}),
          ],
          home: [
            {'type': 'program', 'id': 'z'},
          ],
        ),
      );
      await t.tap(find.byKey(const Key('program_z')));
      await t.pumpAndSettle();
      for (var i = 0; i < 7; i++) {
        await t.tap(find.byKey(const Key('key_9')));
      }
      await t.pumpAndSettle();
      expect(find.text('9999999'), findsOneWidget);
      await t.tap(find.byKey(const Key('popup_donate')));
      await t.pumpAndSettle();
      expect(find.byKey(const Key('pay_amount')), findsOneWidget);
    });

    test(
      'theme: parsed, applied by the service on refresh, bad values ignored',
      () async {
        addTearDown(HColors.apply);
        final body = jsonEncode({
          'settings': {
            'theme': {
              'primary': '#C0392B',
              'ink': '#222222',
              'radius': 'sharp',
            },
          },
          'programs': [],
          'catalogs': [],
          'home': [],
        });
        final svc = CatalogService(
          baseUrl: 'http://x',
          cacheDir: Directory.systemTemp.createTempSync('hd_theme_'),
          refreshEvery: Duration.zero,
          fetcher: (u, {etag}) async => FetchResult(200, body: body, etag: 'e'),
        );
        await svc.refresh();
        expect(svc.data.settings.themePrimary, const Color(0xFFC0392B));
        expect(HColors.teal, const Color(0xFFC0392B));
        expect(HColors.ink, const Color(0xFF222222));
        expect(HColors.radius, closeTo(.35, .001));
        expect(
          HColors.tealDark.computeLuminance(),
          lessThan(HColors.teal.computeLuminance()),
        );
        final bad = CatalogData.fromJson({
          'settings': {
            'theme': {'primary': 'red', 'radius': 'x'},
          },
        });
        expect(bad.settings.themePrimary, isNull);
        expect(bad.settings.themeRadius, 1.0);
      },
    );

    testWidgets(
      'back button sits in the same place on catalog, amount and payment',
      (t) async {
        await start(
          t,
          _data(
            programs: [_prog('a')],
            catalogs: [
              {
                'id': 'c1',
                'title': {'ar': 'كتالوج'},
                'items': [
                  {'programId': 'a', 'size': 'small'},
                ],
              },
            ],
            home: [
              {'type': 'catalog', 'id': 'c1', 'size': 'large'},
            ],
          ),
        );
        expect(find.byKey(const Key('back')), findsNothing); // صفحة المشاريع
        await t.tap(find.byKey(const Key('catalog_c1')));
        await t.pumpAndSettle();
        final onCatalog = t.getTopRight(find.byKey(const Key('back')));
        await t.tap(find.byKey(const Key('program_a')));
        await t.pumpAndSettle();
        expect(t.getTopRight(find.byKey(const Key('back'))), onCatalog);
        await t.tap(find.byKey(const Key('amount_50')));
        await t.pumpAndSettle();
        await t.tap(find.byKey(const Key('continue_pay')));
        await t.pump();
        await t.pump(const Duration(milliseconds: 600));
        expect(t.getTopRight(find.byKey(const Key('back'))), onCatalog);
        await t.pump(const Duration(seconds: 12));
      },
    );

    testWidgets('free popup can be closed without donating', (t) async {
      await start(
        t,
        _data(
          programs: [
            _prog(
              'z',
              extra: {
                'kind': 'free',
                'popupTitle': {'ar': 'عنوان النافذة'},
                'popupHint': {'ar': 'نص الحقل'},
              },
            ),
          ],
          home: [
            {'type': 'program', 'id': 'z'},
          ],
        ),
      );
      await t.tap(find.byKey(const Key('program_z')));
      await t.pumpAndSettle();
      await t.tapAt(const Offset(5, 5)); // خارج النافذة
      await t.pumpAndSettle();
      expect(find.byKey(const Key('amount_popup')), findsNothing);
      expect(find.byKey(const Key('program_z')), findsOneWidget);
    });

    testWidgets('open program respects min/max in the keypad', (t) async {
      await start(
        t,
        _data(
          programs: [
            _prog('o', extra: {'minAmount': 20, 'maxAmount': 500}),
          ],
          home: [
            {'type': 'program', 'id': 'o'},
          ],
        ),
      );
      await t.tap(find.byKey(const Key('program_o')));
      await t.pumpAndSettle();
      expect(
        find.byKey(const Key('amount_10')),
        findsNothing,
      ); // أقل من الحد الأدنى
      expect(find.byKey(const Key('amount_50')), findsOneWidget);

      await t.tap(find.byKey(const Key('amount_other')));
      await t.pumpAndSettle();
      await t.tap(find.byKey(const Key('key_9')));
      await t.pumpAndSettle();
      // 9 < 20 → غير صالح
      await t.tap(find.byKey(const Key('continue_pay')));
      await t.pumpAndSettle();
      expect(find.byKey(const Key('pay_amount')), findsNothing);

      await t.tap(find.byKey(const Key('key_9')));
      await t.tap(find.byKey(const Key('key_9')));
      await t.pumpAndSettle();
      // 999 > 500 → الرقم الأخير مرفوض، يبقى 99
      expect(find.text('99 ر.س'), findsWidgets);
      expect(find.text('999 ر.س'), findsNothing);
    });

    testWidgets('demo analytics: a full simulated donation emits the funnel', (
      t,
    ) async {
      size(t);
      final events = <Map<String, Object?>>[];
      final svc =
          CatalogService.fixed(
              _data(
                programs: [
                  _prog('z', extra: {'kind': 'free'}),
                ],
                home: [
                  {'type': 'program', 'id': 'z'},
                ],
              ),
            )
            ..analytics = Analytics(
              'http://x',
              sender: (u, b) async => events.add(b),
            );
      await t.pumpWidget(KioskApp(catalog: svc));
      await wait(t);
      await t.tap(find.byKey(const Key('welcome_donate')));
      await wait(t);
      await t.tap(find.byKey(const Key('program_z')));
      await t.pumpAndSettle();
      await t.tap(find.byKey(const Key('key_4')));
      await t.tap(find.byKey(const Key('key_0')));
      await t.pumpAndSettle();
      await t.tap(find.byKey(const Key('popup_donate')));
      await t.pumpAndSettle();
      for (var i = 0; i < 20; i++) {
        await t.pump(const Duration(seconds: 1));
      }
      expect(events.map((e) => e['type']).toList(), [
        'session_start',
        'program_selected',
        'amount_chosen',
        'payment_started',
        'payment_completed',
      ]);
      expect(events[1]['programId'], 'z');
      expect(events[2]['amount'], 40);
      expect(events.every((e) => !e.containsKey('name')), isTrue);
    });

    testWidgets('demo analytics: idle timeout mid-session logs abandonment', (
      t,
    ) async {
      size(t);
      final events = <String>[];
      final svc =
          CatalogService.fixed(
              _data(
                programs: [_prog('a')],
                home: [
                  {'type': 'program', 'id': 'a'},
                ],
              ),
            )
            ..analytics = Analytics(
              'http://x',
              sender: (u, b) async => events.add(b['type'] as String),
            );
      await t.pumpWidget(
        KioskApp(
          catalog: svc,
          idleTimeout: const Duration(seconds: 3),
          warnFor: const Duration(seconds: 1),
        ),
      );
      await wait(t);
      await t.tap(find.byKey(const Key('welcome_donate')));
      await wait(t);
      await t.pump(const Duration(seconds: 8));
      expect(events, ['session_start', 'session_abandoned']);
    });

    testWidgets(
      'hidden diagnostics: 5 quick taps on the corner show server status',
      (t) async {
        size(t);
        final svc = CatalogService(
          baseUrl: 'http://10.0.0.5:8080',
          cacheDir: Directory.systemTemp.createTempSync('hd_diag_'),
          refreshEvery: Duration.zero,
          fetcher: (u, {etag}) async =>
              throw const SocketException('Connection refused'),
        );
        await t.pumpWidget(KioskApp(catalog: svc));
        await wait(t);
        for (var i = 0; i < 4; i++) {
          await t.tap(find.byKey(const Key('secret_corner')));
        }
        await wait(t, 200);
        expect(find.byKey(const Key('diag_title')), findsNothing);
        await t.tap(find.byKey(const Key('secret_corner')));
        await wait(t, 300);
        expect(find.byKey(const Key('diag_title')), findsOneWidget);
        expect(find.textContaining('http://10.0.0.5:8080'), findsOneWidget);
        expect(find.textContaining('Connection refused'), findsOneWidget);
      },
    );

    testWidgets(
      'featured carousel: shows chosen items one at a time, rotates, tap opens',
      (t) async {
        await start(
          t,
          _data(
            programs: [_prog('a'), _prog('b'), _prog('c')],
            home: [
              {'type': 'program', 'id': 'a'},
              {'type': 'program', 'id': 'b'},
              {'type': 'program', 'id': 'c'},
            ],
            featured: {
              'enabled': true,
              'intervalSeconds': 3,
              'items': [
                {'type': 'program', 'id': 'c'},
                {'type': 'program', 'id': 'a'},
              ],
            },
          ),
        );
        expect(find.byKey(const Key('featured_carousel')), findsOneWidget);
        expect(
          find.byKey(const Key('featured_program_c')),
          findsOneWidget,
        ); // الأول بالترتيب
        expect(
          find.byKey(const Key('featured_program_b')),
          findsNothing,
        ); // غير المختار لا يظهر
        expect(find.text('الأكثر رواجاً'), findsOneWidget);
        expect(
          find.descendant(
            of: find.byKey(const Key('featured_dots')),
            matching: find.byType(AnimatedContainer),
          ),
          findsNWidgets(2),
        );

        await t.pump(const Duration(seconds: 3));
        await t.pump(const Duration(milliseconds: 900)); // انتهاء حركة التبديل
        expect(find.byKey(const Key('featured_program_a')), findsOneWidget);
        expect(find.byKey(const Key('featured_program_c')), findsNothing);
        await t.pump(const Duration(seconds: 3));
        await t.pump(const Duration(milliseconds: 900));
        expect(
          find.byKey(const Key('featured_program_c')),
          findsOneWidget,
        ); // يدور من جديد

        await t.tap(find.byKey(const Key('featured_program_c')));
        await t.pumpAndSettle();
        expect(find.byKey(const Key('project_name')), findsOneWidget);
        expect(find.text('برنامج c'), findsWidgets);
        // والتبديل متوقف أثناء ظهور شاشة أخرى (لا أخطاء ولا مؤقتات معلّقة)
        await t.pump(const Duration(seconds: 20));
        await t.tap(find.byKey(const Key('back')));
        await t.pumpAndSettle();
        expect(find.byKey(const Key('featured_carousel')), findsOneWidget);
      },
    );

    testWidgets(
      'featured carousel: hidden when disabled or empty; single item has no dots',
      (t) async {
        final prog = [_prog('a'), _prog('b')];
        final home = [
          {'type': 'program', 'id': 'a'},
          {'type': 'program', 'id': 'b'},
        ];
        await start(
          t,
          _data(
            programs: prog,
            home: home,
            featured: {
              'enabled': false,
              'items': [
                {'type': 'program', 'id': 'a'},
              ],
            },
          ),
        );
        expect(find.byKey(const Key('featured_carousel')), findsNothing);
        await t.pumpWidget(const SizedBox.shrink());

        await start(
          t,
          _data(
            programs: prog,
            home: home,
            featured: {'enabled': true, 'items': []},
          ),
        );
        expect(find.byKey(const Key('featured_carousel')), findsNothing);
        await t.pumpWidget(const SizedBox.shrink());

        await start(
          t,
          _data(
            programs: prog,
            home: home,
            featured: {
              'enabled': true,
              'items': [
                {'type': 'program', 'id': 'b'},
              ],
            },
          ),
        );
        expect(find.byKey(const Key('featured_carousel')), findsOneWidget);
        expect(find.byKey(const Key('featured_dots')), findsNothing);
      },
    );

    testWidgets('featured carousel: custom badge text and language switch', (
      t,
    ) async {
      await start(
        t,
        _data(
          programs: [_prog('a')],
          home: [
            {'type': 'program', 'id': 'a'},
          ],
          featured: {
            'enabled': true,
            'title': {'ar': 'الأكثر طلباً', 'en': 'Top picks'},
            'items': [
              {'type': 'program', 'id': 'a'},
            ],
          },
        ),
      );
      expect(find.text('الأكثر طلباً'), findsOneWidget);
      await t.tap(find.byKey(const Key('lang_en')));
      await wait(t, 500);
      expect(find.text('Top picks'), findsOneWidget);
      await t.tap(find.byKey(const Key('lang_fr')));
      await wait(t, 500);
      expect(
        find.text('Les plus populaires'),
        findsOneWidget,
      ); // لا نص مخصص بالفرنسية ← الافتراضي
    });

    testWidgets(
      'titles from settings override defaults; every language falls back safely',
      (t) async {
        await start(
          t,
          _data(
            settings: {
              'homeTitle': {'ar': 'عنوان مخصص'},
            },
            programs: [
              {
                'id': 'only_ar',
                'title': {'ar': 'عربي فقط'},
                'kind': 'open',
              },
            ],
            home: [
              {'type': 'program', 'id': 'only_ar'},
            ],
          ),
        );
        expect(find.text('عنوان مخصص'), findsOneWidget);
        await t.tap(find.byKey(const Key('lang_fr')));
        await wait(t, 500);
        expect(
          find.text('Votre don crée un impact'),
          findsOneWidget,
        ); // بلا عنوان مخصص بالفرنسية → الافتراضي
        expect(find.text('عربي فقط'), findsOneWidget); // الرجوع للعربية
      },
    );
  });
}
