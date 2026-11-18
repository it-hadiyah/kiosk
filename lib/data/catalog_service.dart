import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';

import 'analytics.dart';
import 'device_session.dart';
import '../theme/theme.dart';
import 'models.dart';

/// نتيجة طلب الكتالوج من الخادم.
class FetchResult {
  const FetchResult(this.status, {this.body, this.etag});
  final int status; // 200 / 304 / غيرها = فشل
  final String? body;
  final String? etag;
}

typedef CatalogFetcher = Future<FetchResult> Function(Uri url, {String? etag});

/// يحمّل الكتالوج من الخادم ويحفظ نسخة محلية، ويعود للنسخة المحفوظة ثم المضمّنة عند تعذّر الاتصال.
/// عنوان الخادم يُضبط وقت البناء: `--dart-define=CATALOG_URL=https://example.com`
class CatalogService extends ChangeNotifier {
  CatalogService({
    String? baseUrl,
    CatalogFetcher? fetcher,
    Directory? cacheDir,
    CatalogData? initial,
    this.refreshEvery = const Duration(minutes: 1),
    this.requireActivation = false,
    JsonPoster? poster,
    Directory? sessionDir,
  }) : baseUrl = _clean(baseUrl ?? const String.fromEnvironment('CATALOG_URL')),
       _fetcher = fetcher ?? _httpFetch,
       _cacheDir =
           cacheDir ?? Directory('${Directory.systemTemp.path}/hadiyah_cache'),
       data = initial ?? CatalogData.defaults() {
    if (poster != null) _poster = poster;
    _sessionDirOverride =
        sessionDir ?? (cacheDir == null ? _persistentDir() : null);
  }

  /// نسخة للاختبارات: لا شبكة ولا مؤقتات.
  CatalogService.fixed(CatalogData d)
    : baseUrl = '',
      _fetcher = _httpFetch,
      _cacheDir = Directory('${Directory.systemTemp.path}/hadiyah_cache_test'),
      refreshEvery = Duration.zero,
      requireActivation = false,
      data = d;

  static String _clean(String s) => s.trim().replaceAll(RegExp(r'/+$'), '');

  final String baseUrl;
  final CatalogFetcher _fetcher;
  final Directory _cacheDir;
  final Duration refreshEvery;

  /// عند التفعيل يطلب التطبيق معرف جلسة واسم كيوسك قبل أول استخدام.
  final bool requireActivation;
  JsonPoster _poster = httpPostJson;
  Directory? _sessionDirOverride;

  /// مجلد بيانات التطبيق على أندرويد (لا يُمسح بـ «مسح الكاش»)، وإلا null.
  static Directory? _persistentDir() {
    try {
      if (Platform.isAndroid) {
        return Directory('${Directory.systemTemp.parent.path}/hadiyah_session');
      }
    } catch (_) {}
    return null;
  }

  Directory get _sessionDir => _sessionDirOverride ?? _cacheDir;
  File get _sessionFile => File('${_sessionDir.path}/session.json');

  /// جلسة هذا الكيوسك (null = غير مفعّل).
  DeviceSession? session;

  /// هل يجب عرض شاشة التفعيل بدل الترحيب؟
  bool get needsSetup =>
      requireActivation && baseUrl.isNotEmpty && session == null;

  /// إحصائيات المحاكاة التجريبية (تُهمل عند غياب الخادم).
  late Analytics analytics = Analytics(baseUrl);

  CatalogData data;
  String? etag;
  String? lastError;
  DateTime? lastSync;
  DateTime? lastAttempt;
  String? lastStatus;

  /// نص تشخيصي يعرض حالة الاتصال بالخادم.
  String diagnostics() => [
    'Catalog server: ${baseUrl.isEmpty ? '(not set — bundled catalog)' : baseUrl}',
    'Last attempt: ${lastAttempt?.toIso8601String() ?? 'never'}',
    'Last result: ${lastStatus ?? '-'}',
    'Last error: ${lastError ?? 'none'}',
    'Kiosk: ${session == null ? '(not activated)' : '${session!.name} · ${session!.sessionId}'}',
    'Published at: ${data.updatedAt.isEmpty ? '(bundled)' : data.updatedAt}',
    'Programs: ${data.programs.length} · Home tiles: ${data.homeTiles.length}',
  ].join('\n');
  Timer? _timer;
  bool _busy = false;

  File get _catalogFile => File('${_cacheDir.path}/catalog.json');

  /// يطبّق الهوية البصرية من إعدادات الكتالوج (ألوان + استدارة).
  void _applyTheme() {
    final st = data.settings;
    HColors.apply(
      primary: st.themePrimary ?? HColors.defaultPrimary,
      inkColor: st.themeInk ?? HColors.defaultInk,
      radiusK: st.themeRadius,
    );
  }

  /// يحمّل النسخة المحفوظة ثم يزامن مع الخادم ويبدأ التحديث الدوري.
  Future<void> init() async {
    await _loadCached();
    if (baseUrl.isEmpty) return;
    KioskInfo.deviceId = await Analytics.loadDeviceId(_sessionDir);
    await _loadSession();
    unawaited(refresh());
    if (refreshEvery > Duration.zero) {
      _timer = Timer.periodic(refreshEvery, (_) => refresh());
    }
  }

  Future<void> _loadSession() async {
    try {
      if (await _sessionFile.exists()) {
        session = DeviceSession.fromJson(
          jsonDecode(await _sessionFile.readAsString()),
        );
        KioskInfo.token = session?.token ?? '';
        notifyListeners();
      }
    } catch (e) {
      debugPrint('session file ignored: $e');
    }
  }

  /// تفعيل هذا الكيوسك بمعرف الجلسة (8 أرقام من لوحة التحكم) واسم الكيوسك.
  /// يرمي [ActivationException] برسالة عربية عند الفشل.
  Future<void> activate({required String code, required String name}) async {
    final digits = code.replaceAll(RegExp(r'\D'), '');
    final nm = name.trim();
    if (digits.length != 8) {
      throw const ActivationException('bad_code', 'معرف الجلسة 8 أرقام');
    }
    if (nm.isEmpty) {
      throw const ActivationException('bad_name', 'اكتب اسم الكيوسك');
    }
    HttpReply r;
    try {
      r = await _poster(Uri.parse('$baseUrl/api/device/activate'), {
        'code': digits,
        'name': nm,
        'deviceId': KioskInfo.deviceId,
        'appVersion': KioskInfo.version,
      });
    } catch (e) {
      throw const ActivationException(
        'network',
        'تعذّر الاتصال بالخادم — تأكد من الشبكة ومن أن الخادم يعمل',
      );
    }
    if (r.status != 200 || r.json['token'] is! String) {
      throw ActivationException(
        '${r.json['code'] ?? 'error'}',
        '${r.json['error'] ?? 'تعذّر التفعيل (${r.status})'}',
      );
    }
    session = DeviceSession(
      sessionId: '${r.json['sessionId'] ?? ''}',
      token: r.json['token'] as String,
      name: '${r.json['name'] ?? nm}',
    );
    KioskInfo.token = session!.token;
    try {
      await _sessionDir.create(recursive: true);
      await _sessionFile.writeAsString(jsonEncode(session!.toJson()));
    } catch (e) {
      debugPrint('session persist failed: $e');
    }
    etag = null;
    notifyListeners();
    unawaited(refresh());
  }

  /// ينهي جلسة هذا الكيوسك (نقل الكيوسك): يبلّغ الخادم ثم يعود لشاشة التفعيل.
  Future<void> endSession() async {
    final tk = session?.token;
    if (tk != null && baseUrl.isNotEmpty) {
      try {
        await _poster(
          Uri.parse('$baseUrl/api/device/deactivate'),
          const {},
          token: tk,
        ).timeout(const Duration(seconds: 5));
      } catch (_) {}
    }
    await _clearSession();
  }

  Future<void> _clearSession() async {
    session = null;
    KioskInfo.token = '';
    etag = null;
    notifyListeners(); // الواجهة تعود لشاشة التفعيل فوراً
    try {
      if (await _sessionFile.exists()) await _sessionFile.delete();
    } catch (_) {}
  }

  Future<void> _loadCached() async {
    try {
      if (await _catalogFile.exists()) {
        data = CatalogData.fromJson(
          jsonDecode(await _catalogFile.readAsString()),
        );
        _applyTheme();
        notifyListeners();
      }
    } catch (e) {
      debugPrint('catalog cache ignored: $e');
    }
  }

  /// يجلب أحدث نسخة منشورة. آمن للاستدعاء المتكرر، ولا يرمي أبداً.
  Future<void> refresh() async {
    if (baseUrl.isEmpty || _busy) return;
    _busy = true;
    lastAttempt = DateTime.now();
    try {
      final r = await _fetcher(Uri.parse('$baseUrl/api/catalog'), etag: etag);
      lastStatus = 'HTTP ${r.status}';
      if (r.status == 401 && session != null) {
        // أنهى مدير اللوحة هذه الجلسة: نعود لشاشة التفعيل
        lastError = 'session ended';
        await _clearSession();
        return;
      }
      if (r.status == 304) {
        lastError = null;
      } else if (r.status == 200 && r.body != null) {
        final parsed = CatalogData.fromJson(
          jsonDecode(r.body!),
        ); // يرمي إن كان غير صالح فنُبقي القديم
        data = parsed;
        _applyTheme();
        etag = r.etag;
        lastError = null;
        unawaited(_persist(r.body!));
        unawaited(_prefetchImages(parsed));
        notifyListeners();
      } else {
        lastError = 'HTTP ${r.status}';
      }
      lastSync = DateTime.now();
    } catch (e) {
      lastError = '$e';
      lastStatus = 'failed';
      debugPrint('catalog refresh failed: $e');
    } finally {
      _busy = false;
    }
  }

  Future<void> _persist(String body) async {
    try {
      await _cacheDir.create(recursive: true);
      await _catalogFile.writeAsString(body);
    } catch (e) {
      debugPrint('catalog persist failed: $e');
    }
  }

  // ---------------- الصور ----------------

  /// الرابط الكامل للصورة (null للصور المضمّنة أو الفارغة).
  String? remoteUrl(String src) {
    if (src.startsWith('http://') || src.startsWith('https://')) return src;
    if (src.startsWith('/') && baseUrl.isNotEmpty) return '$baseUrl$src';
    return null;
  }

  File _fileFor(String url) {
    final name = base64Url.encode(utf8.encode(url)).replaceAll('=', '');
    final tail = name.length > 120 ? name.substring(name.length - 120) : name;
    return File('${_cacheDir.path}/img_$tail');
  }

  /// أفضل مصدر للصورة: مضمّنة ← ملف محفوظ ← الشبكة. null = لا صورة.
  ImageProvider? imageFor(String src) {
    if (src.isEmpty) return null;
    if (src.startsWith('asset:')) return AssetImage(src.substring(6));
    final url = remoteUrl(src);
    if (url == null) return null;
    final f = _fileFor(url);
    if (f.existsSync()) return FileImage(f);
    return NetworkImage(url);
  }

  Future<void> _prefetchImages(CatalogData d) async {
    final urls = <String>{
      for (final p in d.programs) ?remoteUrl(p.image),
      for (final p in d.programs) ?remoteUrl(p.popupImage),
      for (final c in d.catalogs) ?remoteUrl(c.image),
      ?remoteUrl(d.settings.welcomeBackground),
    };
    var fetched = false;
    for (final u in urls) {
      final f = _fileFor(u);
      if (f.existsSync()) continue;
      try {
        await _cacheDir.create(recursive: true);
        final c = HttpClient()..connectionTimeout = const Duration(seconds: 8);
        try {
          final req = await c.getUrl(Uri.parse(u));
          final resp = await req.close().timeout(const Duration(seconds: 20));
          if (resp.statusCode == 200) {
            final bytes = await resp.fold<List<int>>(
              [],
              (a, b) => a..addAll(b),
            );
            final tmp = File('${f.path}.tmp');
            await tmp.writeAsBytes(bytes);
            await tmp.rename(f.path);
            fetched = true;
          }
        } finally {
          c.close();
        }
      } catch (e) {
        debugPrint('image prefetch failed ($u): $e');
      }
    }
    if (fetched) {
      notifyListeners(); // لتستبدل الشاشات مصدر الشبكة بالملف المحفوظ
    }
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }
}

Future<FetchResult> _httpFetch(Uri url, {String? etag}) async {
  final c = HttpClient()..connectionTimeout = const Duration(seconds: 8);
  try {
    final req = await c.getUrl(url);
    if (etag != null) req.headers.set(HttpHeaders.ifNoneMatchHeader, etag);
    if (KioskInfo.token.isNotEmpty) {
      req.headers.set('X-Kiosk-Token', KioskInfo.token);
    }
    if (KioskInfo.deviceId.isNotEmpty) {
      req.headers.set('X-Kiosk-Device', KioskInfo.deviceId);
      req.headers.set('X-Kiosk-Version', KioskInfo.version);
    }
    final resp = await req.close().timeout(const Duration(seconds: 12));
    final tag = resp.headers.value(HttpHeaders.etagHeader);
    if (resp.statusCode == 304) {
      await resp.drain<void>();
      return FetchResult(304, etag: tag);
    }
    final body = await resp.transform(utf8.decoder).join();
    return FetchResult(resp.statusCode, body: body, etag: tag);
  } finally {
    c.close();
  }
}

/// صورة من الكتالوج: مضمّنة أو من الخادم، مع بديل أنيق عند الغياب/الفشل.
class AppImage extends StatelessWidget {
  const AppImage({
    super.key,
    required this.service,
    required this.src,
    this.fit = BoxFit.cover,
    this.alignment = Alignment.center,
    this.fallback,
  });
  final CatalogService service;
  final String src;
  final BoxFit fit;
  final Alignment alignment;

  /// صورة بديلة (مضمّنة) تظهر أثناء التحميل أو عند الفشل.
  final String? fallback;

  @override
  Widget build(BuildContext context) {
    final provider = service.imageFor(src);
    Widget placeholder() => const ColoredBox(
      color: Color(0xFFE6F4F2),
      child: Center(
        child: Icon(Icons.image_outlined, color: Color(0xFF00A092), size: 48),
      ),
    );
    Widget fb() {
      final f = fallback == null ? null : service.imageFor(fallback!);
      return f == null
          ? placeholder()
          : Image(image: f, fit: fit, alignment: alignment);
    }

    if (provider == null) return fb();
    return Image(
      image: provider,
      fit: fit,
      alignment: alignment,
      gaplessPlayback: true,
      frameBuilder: (_, child, frame, sync) =>
          (frame == null && !sync && fallback != null) ? fb() : child,
      errorBuilder: (_, _, _) => fb(),
    );
  }
}
