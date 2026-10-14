import 'dart:convert';

import 'package:flutter/painting.dart';

import '../l10n/strings.dart';
import 'default_catalog.dart';

/// نص متعدد اللغات مع رجوع تلقائي: اللغة المطلوبة ← العربية ← الإنجليزية ← أي لغة متوفرة.
class Localized {
  const Localized(this._m);
  final Map<String, String> _m;
  static const empty = Localized({});

  factory Localized.from(Object? v) {
    final m = <String, String>{};
    if (v is Map) {
      for (final e in v.entries) {
        if (e.key is String && e.value is String) {
          m[e.key as String] = (e.value as String).trim();
        }
      }
    }
    return Localized(m);
  }

  bool get isEmpty => _m.values.every((s) => s.isEmpty);

  /// نص اللغة بدون رجوع (قد يكون فارغاً).
  String exact(AppLang l) => _m[l.code] ?? '';

  String of(AppLang l) {
    for (final code in [l.code, 'ar', 'en']) {
      final v = _m[code];
      if (v != null && v.isNotEmpty) return v;
    }
    return _m.values.firstWhere((s) => s.isNotEmpty, orElse: () => '');
  }
}

enum ProgramKind {
  /// المتبرع يختار: مبالغ سريعة + «مبلغ آخر».
  open,

  /// مبالغ محددة فقط.
  presets,

  /// قيمة ثابتة (مع كمية اختيارية).
  fixed,

  /// بلا مبالغ جاهزة: يكتب المتبرع المبلغ مباشرةً.
  free;

  static ProgramKind parse(Object? v) => ProgramKind.values.firstWhere(
    (k) => k.name == v,
    orElse: () => ProgramKind.open,
  );
}

enum TileSize {
  small(2),
  medium(3),
  large(6);

  const TileSize(this.units);

  /// الوحدات من 6 في الصف: صغير = ثلث، متوسط = نصف، كبير = كامل.
  final int units;
  static TileSize parse(Object? v) => TileSize.values.firstWhere(
    (s) => s.name == v,
    orElse: () => TileSize.medium,
  );
}

Alignment _align(Object? v) => switch (v) {
  'top' => Alignment.topCenter,
  'bottom' => Alignment.bottomCenter,
  _ => Alignment.center,
};

int _int(Object? v, int def, {int min = 0, int max = 9999999}) {
  final n = v is num ? v.round() : int.tryParse('$v');
  if (n == null) return def;
  return n.clamp(min, max);
}

class Program {
  const Program({
    required this.id,
    required this.title,
    required this.image,
    this.align = Alignment.center,
    this.kind = ProgramKind.open,
    this.price = 0,
    this.presets = const [],
    this.minAmount = 1,
    this.maxAmount = 99999,
    this.allowQuantity = false,
    this.maxQuantity = 99,
    this.popupTitle = Localized.empty,
    this.popupHint = Localized.empty,
    this.active = true,
  });

  final String id;
  final bool active;
  final Localized title;
  final String image;
  final Alignment align;
  final ProgramKind kind;
  final int price;
  final List<int> presets;
  final int minAmount;
  final int maxAmount;
  final bool allowQuantity;
  final int maxQuantity;

  /// نافذة المبلغ (للنوع free): العبارة العلوية ونص الحقل.
  final Localized popupTitle;
  final Localized popupHint;

  bool get freeEntry => kind == ProgramKind.free;

  static Program? fromJson(Object? j) {
    if (j is! Map) return null;
    final id = j['id'];
    if (id is! String || id.isEmpty) return null;
    return Program(
      id: id,
      active: j['active'] != false,
      title: Localized.from(j['title']),
      image: j['image'] is String ? j['image'] as String : '',
      align: _align(j['imageAlign']),
      kind: j['kind'] == 'open' && j['freeEntry'] == true
          ? ProgramKind.free
          : ProgramKind.parse(j['kind']),
      price: _int(j['price'], 0),
      presets: [
        if (j['presets'] is List)
          for (final p in j['presets'] as List)
            if (_int(p, 0) > 0) _int(p, 0),
      ],
      minAmount: _int(j['minAmount'], 1, min: 1),
      maxAmount: _int(j['maxAmount'], 99999, min: 1),
      allowQuantity: j['allowQuantity'] == true,
      maxQuantity: _int(j['maxQuantity'], 99, min: 1, max: 999),
      popupTitle: Localized.from(j['popupTitle']),
      popupHint: Localized.from(j['popupHint']),
    );
  }
}

class CatalogItem {
  const CatalogItem(this.programId, this.size);
  final String programId;
  final TileSize size;
}

class CatalogGroup {
  const CatalogGroup({
    required this.id,
    required this.title,
    required this.subtitle,
    required this.image,
    this.align = Alignment.center,
    this.items = const [],
    this.active = true,
  });
  final String id;
  final bool active;
  final Localized title;
  final Localized subtitle;
  final String image;
  final Alignment align;
  final List<CatalogItem> items;

  static CatalogGroup? fromJson(Object? j) {
    if (j is! Map) return null;
    final id = j['id'];
    if (id is! String || id.isEmpty) return null;
    return CatalogGroup(
      id: id,
      active: j['active'] != false,
      title: Localized.from(j['title']),
      subtitle: Localized.from(j['subtitle']),
      image: j['image'] is String ? j['image'] as String : '',
      align: _align(j['imageAlign']),
      items: [
        if (j['items'] is List)
          for (final it in j['items'] as List)
            if (it is Map && it['programId'] is String)
              CatalogItem(
                it['programId'] as String,
                TileSize.parse(it['size']),
              ),
      ],
    );
  }
}

class AppSettings {
  const AppSettings({
    this.idleSeconds = 60,
    this.warnSeconds = 15,
    this.maxAmount = 99999,
    this.quickAmounts = const [10, 50, 100, 200],
    this.welcomeBackground = '',
    this.homeTitle = Localized.empty,
    this.homeSubtitle = Localized.empty,
  });
  final int idleSeconds;
  final int warnSeconds;
  final int maxAmount;
  final List<int> quickAmounts;
  final String welcomeBackground;
  final Localized homeTitle;
  final Localized homeSubtitle;

  static AppSettings fromJson(Object? j) {
    if (j is! Map) return const AppSettings();
    final quick = [
      if (j['quickAmounts'] is List)
        for (final q in j['quickAmounts'] as List)
          if (_int(q, 0) > 0) _int(q, 0),
    ];
    return AppSettings(
      idleSeconds: _int(j['idleSeconds'], 60, min: 10, max: 600),
      warnSeconds: _int(j['warnSeconds'], 15, min: 5, max: 120),
      maxAmount: _int(j['maxAmount'], 99999, min: 1),
      quickAmounts: quick.isEmpty
          ? const [10, 50, 100, 200]
          : quick.take(8).toList(),
      welcomeBackground: j['welcomeBackground'] is String
          ? j['welcomeBackground'] as String
          : '',
      homeTitle: Localized.from(j['homeTitle']),
      homeSubtitle: Localized.from(j['homeSubtitle']),
    );
  }
}

/// عنصر جاهز للعرض في الشبكة: برنامج أو كتالوج + حجمه.
class Tile {
  const Tile.program(Program this.program, this.size) : catalog = null;
  const Tile.catalog(CatalogGroup this.catalog, this.size) : program = null;
  final Program? program;
  final CatalogGroup? catalog;
  final TileSize size;

  String get key =>
      program != null ? 'program_${program!.id}' : 'catalog_${catalog!.id}';
  String title(AppLang l) => (program?.title ?? catalog!.title).of(l);
  String get image => program?.image ?? catalog!.image;
  Alignment get align => program?.align ?? catalog!.align;
}

class CatalogData {
  const CatalogData({
    this.settings = const AppSettings(),
    this.programs = const [],
    this.catalogs = const [],
    this.home = const [],
    this.updatedAt = '',
    this.featured = const FeaturedConfig(),
  });

  /// وقت آخر نشر من لوحة التحكم (للتشخيص).
  final String updatedAt;
  final FeaturedConfig featured;
  final AppSettings settings;
  final List<Program> programs;
  final List<CatalogGroup> catalogs;
  final List<HomeEntry> home;

  /// الكتالوج المضمّن (يعمل بدون خادم).
  factory CatalogData.defaults() =>
      CatalogData.fromJson(jsonDecode(kDefaultCatalogJson));

  factory CatalogData.fromJson(Object? json) {
    if (json is! Map) {
      throw const FormatException('catalog root must be an object');
    }
    final programs = [
      if (json['programs'] is List)
        for (final p in json['programs'] as List) ?Program.fromJson(p),
    ];
    final catalogs = [
      if (json['catalogs'] is List)
        for (final c in json['catalogs'] as List) ?CatalogGroup.fromJson(c),
    ];
    final home = [
      if (json['home'] is List)
        for (final h in json['home'] as List)
          if (h is Map && h['id'] is String)
            HomeEntry(
              h['type'] == 'catalog',
              h['id'] as String,
              TileSize.parse(h['size']),
            ),
    ];
    return CatalogData(
      settings: AppSettings.fromJson(json['settings']),
      programs: programs,
      catalogs: catalogs,
      home: home,
      updatedAt: json['updatedAt'] is String ? json['updatedAt'] as String : '',
      featured: FeaturedConfig.fromJson(json['featured']),
    );
  }

  Program? program(String id) {
    for (final p in programs) {
      if (p.id == id) return p;
    }
    return null;
  }

  CatalogGroup? catalog(String id) {
    for (final c in catalogs) {
      if (c.id == id) return c;
    }
    return null;
  }

  /// برامج الكتالوج الظاهرة فعلاً.
  List<Tile> tilesOfCatalog(CatalogGroup c) => [
    for (final it in c.items)
      if (program(it.programId) case final p? when p.active)
        Tile.program(p, it.size),
  ];

  /// عناصر الصفحة الرئيسية الظاهرة فعلاً (النشطة والموجودة، والكتالوج غير الفارغ).
  List<Tile> get homeTiles => [for (final h in home) ?_homeTile(h)];

  /// عناصر «الأكثر رواجاً» الظاهرة فعلاً (فارغة إن كان الشريط معطّلاً).
  List<Tile> get featuredTiles => !featured.enabled
      ? const []
      : [for (final h in featured.items) ?_homeTile(h)];

  Tile? _homeTile(HomeEntry h) {
    if (h.isCatalog) {
      final c = catalog(h.id);
      if (c == null || !c.active || tilesOfCatalog(c).isEmpty) return null;
      return Tile.catalog(c, h.size);
    }
    final p = program(h.id);
    return (p == null || !p.active) ? null : Tile.program(p, h.size);
  }
}

/// شريط «الأكثر رواجاً» أعلى صفحة المتبرع: عناصر محددة تُعرض واحداً واحداً بالتناوب.
class FeaturedConfig {
  const FeaturedConfig({
    this.enabled = false,
    this.intervalSeconds = 5,
    this.title = Localized.empty,
    this.items = const [],
  });
  final bool enabled;
  final int intervalSeconds;
  final Localized title;
  final List<HomeEntry> items;

  static FeaturedConfig fromJson(Object? j) {
    if (j is! Map) return const FeaturedConfig();
    return FeaturedConfig(
      enabled: j['enabled'] == true,
      intervalSeconds: _int(j['intervalSeconds'], 5, min: 2, max: 60),
      title: Localized.from(j['title']),
      items: [
        if (j['items'] is List)
          for (final h in j['items'] as List)
            if (h is Map && h['id'] is String)
              HomeEntry(
                h['type'] == 'catalog',
                h['id'] as String,
                TileSize.large,
              ),
      ],
    );
  }
}

class HomeEntry {
  const HomeEntry(this.isCatalog, this.id, this.size);
  final bool isCatalog;
  final String id;
  final TileSize size;
}

/// يرصّ العناصر في صفوف سعتها 6 وحدات (صغير 2، متوسط 3، كبير 6) بالترتيب.
List<List<Tile>> packRows(List<Tile> tiles) {
  final rows = <List<Tile>>[];
  var row = <Tile>[];
  var used = 0;
  for (final t in tiles) {
    if (used + t.size.units > 6 && row.isNotEmpty) {
      rows.add(row);
      row = [];
      used = 0;
    }
    row.add(t);
    used += t.size.units;
  }
  if (row.isNotEmpty) rows.add(row);
  return rows;
}
