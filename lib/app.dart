import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';

import 'l10n/strings.dart';
import 'screens/welcome_screen.dart';
import 'state/donation_state.dart';

class KioskApp extends StatefulWidget {
  const KioskApp({
    super.key,
    this.idleTimeout = const Duration(seconds: 60),
    this.warnFor = const Duration(seconds: 15),
  });
  final Duration idleTimeout;
  final Duration warnFor;

  @override
  State<KioskApp> createState() => _KioskAppState();
}

class _KioskAppState extends State<KioskApp> {
  final _state = DonationState();
  final _nav = GlobalKey<NavigatorState>();
  Timer? _idle;
  Timer? _warn;
  bool _warning = false;

  @override
  void initState() {
    super.initState();
    _state.addListener(() => setState(() {}));
    _resetIdle();
  }

  /// أي لمسة تعيد ضبط مؤقت الخمول.
  void _resetIdle() {
    _idle?.cancel();
    if (_warning) return;
    _idle = Timer(widget.idleTimeout, _onIdle);
  }

  void _onIdle() {
    final nav = _nav.currentState;
    if (nav == null || !nav.canPop()) {
      _resetIdle(); // على الشاشة الرئيسية لا حاجة
      return;
    }
    _warning = true;
    _warn = Timer(widget.warnFor, () {
      _closeWarning();
      _endSession();
    });
    final ctx = _nav.currentContext!;
    final s = S(_state.arabic);
    showDialog<void>(
      context: ctx,
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
    _state.reset();
    _nav.currentState?.popUntil((r) => r.isFirst);
  }

  @override
  void dispose() {
    _idle?.cancel();
    _warn?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final ar = _state.arabic;
    return Listener(
      behavior: HitTestBehavior.translucent,
      onPointerDown: (_) => _resetIdle(),
      child: MaterialApp(
        navigatorKey: _nav,
        debugShowCheckedModeBanner: false,
        title: S(ar).appName,
        locale: Locale(ar ? 'ar' : 'en'),
        supportedLocales: const [Locale('ar'), Locale('en')],
        localizationsDelegates: const [
          GlobalMaterialLocalizations.delegate,
          GlobalWidgetsLocalizations.delegate,
          GlobalCupertinoLocalizations.delegate,
        ],
        theme: ThemeData(
          colorSchemeSeed: const Color(0xFF00695C),
          useMaterial3: true,
          visualDensity: VisualDensity.standard,
        ),
        home: WelcomeScreen(state: _state),
      ),
    );
  }
}
