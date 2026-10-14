import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';

import 'data/catalog_service.dart';
import 'l10n/strings.dart';
import 'screens/welcome_screen.dart';
import 'state/donation_state.dart';
import 'theme/theme.dart';

class KioskApp extends StatefulWidget {
  const KioskApp({super.key, this.catalog, this.idleTimeout, this.warnFor});

  /// مصدر الكتالوج (للاختبارات). الافتراضي: يُنشأ ويتصل بـ CATALOG_URL إن ضُبط.
  final CatalogService? catalog;

  /// تجاوز مهلات الخمول (للاختبارات). الافتراضي: من إعدادات لوحة التحكم.
  final Duration? idleTimeout;
  final Duration? warnFor;

  @override
  State<KioskApp> createState() => _KioskAppState();
}

class _KioskAppState extends State<KioskApp> {
  late final CatalogService _catalog = widget.catalog ?? CatalogService();
  late final DonationState _state = DonationState(_catalog);
  final _nav = GlobalKey<NavigatorState>();
  Timer? _idle;
  Timer? _warn;
  bool _warning = false;

  @override
  void initState() {
    super.initState();
    _state.addListener(() => setState(() {}));
    _catalog.addListener(_state.touch); // وصل كتالوج جديد ← أعد بناء الشاشات
    if (widget.catalog == null) _catalog.init();
    _resetIdle();
  }

  /// أي لمسة تعيد ضبط مؤقت الخمول.
  void _resetIdle() {
    _idle?.cancel();
    if (_warning) return;
    _idle = Timer(
      widget.idleTimeout ?? Duration(seconds: _state.data.settings.idleSeconds),
      _onIdle,
    );
  }

  void _onIdle() {
    final nav = _nav.currentState;
    if (nav == null || !nav.canPop()) {
      // على صفحة البداية: لا تنبيه، لكن نعيد اللغة للعربية للزائر التالي
      if (_state.lang != AppLang.ar) _state.reset();
      _resetIdle();
      return;
    }
    _warning = true;
    _warn = Timer(
      widget.warnFor ?? Duration(seconds: _state.data.settings.warnSeconds),
      () {
        _closeWarning();
        _endSession();
      },
    );
    final s = S(_state.lang);
    showDialog<void>(
      context: _nav.currentContext!,
      barrierDismissible: false,
      builder: (_) => AlertDialog(
        title: Text(s.idleTitle, style: const TextStyle(fontSize: 32)),
        content: Text(s.idleSub, style: const TextStyle(fontSize: 24)),
        actions: [
          TextButton(
            onPressed: () {
              _warn?.cancel();
              _closeWarning();
            },
            child: Text(s.stay, style: const TextStyle(fontSize: 28)),
          ),
        ],
      ),
    );
  }

  void _closeWarning() {
    if (_warning) {
      _warning = false;
      _nav.currentState?.pop();
      _resetIdle();
    }
  }

  void _endSession() {
    _state.trackAbandoned();
    _state.reset();
    _catalog.refresh(); // الزائر التالي يرى أحدث نسخة
    _nav.currentState?.popUntil((r) => r.isFirst);
  }

  @override
  void dispose() {
    _idle?.cancel();
    _warn?.cancel();
    _catalog.removeListener(_state.touch);
    if (widget.catalog == null) _catalog.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final lang = _state.lang;
    return Listener(
      behavior: HitTestBehavior.translucent,
      onPointerDown: (_) => _resetIdle(),
      child: MaterialApp(
        navigatorKey: _nav,
        debugShowCheckedModeBanner: false,
        title: S(lang).appName,
        locale: Locale(lang.code),
        supportedLocales: [for (final l in AppLang.values) Locale(l.code)],
        localizationsDelegates: const [
          GlobalMaterialLocalizations.delegate,
          GlobalWidgetsLocalizations.delegate,
          GlobalCupertinoLocalizations.delegate,
        ],
        theme: buildTheme(),
        builder: kioskFrame,
        home: WelcomeScreen(state: _state),
      ),
    );
  }
}
