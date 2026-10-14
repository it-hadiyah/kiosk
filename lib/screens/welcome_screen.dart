import 'package:flutter/material.dart';

import '../data/catalog_service.dart';
import '../l10n/strings.dart';
import '../state/donation_state.dart';
import '../theme/theme.dart';
import '../widgets/common.dart';
import '../widgets/language_selector.dart';
import 'projects_screen.dart';

/// صفحة البداية: صورة بملء الشاشة + اختيار اللغة + زر «تبرع الآن».
class WelcomeScreen extends StatefulWidget {
  const WelcomeScreen({super.key, required this.state});
  final DonationState state;

  @override
  State<WelcomeScreen> createState() => _WelcomeScreenState();
}

class _WelcomeScreenState extends State<WelcomeScreen>
    with SingleTickerProviderStateMixin {
  late final AnimationController _pulse = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1800),
  );
  bool _navigating = false;
  int _taps = 0;
  DateTime _tapStart = DateTime.fromMillisecondsSinceEpoch(0);
  bool _started = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_started) return;
    _started = true;
    if (!context.reduceMotion) _pulse.repeat(reverse: true);
    widget.state.catalog.refresh(); // أحدث نسخة عند ظهور صفحة البداية
  }

  /// 5 لمسات سريعة على الزاوية العلوية تعرض حالة الاتصال بالخادم (للفنيين).
  void _secretTap() {
    final now = DateTime.now();
    if (now.difference(_tapStart) > const Duration(seconds: 4)) {
      _taps = 0;
      _tapStart = now;
    }
    if (++_taps < 5) return;
    _taps = 0;
    widget.state.catalog.refresh();
    showDialog<void>(
      context: context,
      builder: (_) => ListenableBuilder(
        listenable: widget.state.catalog,
        builder: (context, _) => AlertDialog(
          title: const Text('Status', key: Key('diag_title')),
          content: SelectableText(
            widget.state.catalog.diagnostics(),
            textDirection: TextDirection.ltr,
            style: const TextStyle(fontSize: 18, height: 1.6),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(),
              child: const Text('OK'),
            ),
          ],
        ),
      ),
    );
  }

  @override
  void dispose() {
    _pulse.dispose();
    super.dispose();
  }

  Future<void> _donate() async {
    if (_navigating) return; // يمنع الضغط المزدوج
    _navigating = true;
    widget.state.trackStart();
    await Navigator.of(context)
        .push(kioskRoute(ProjectsScreen(state: widget.state)));
    _navigating = false;
  }

  @override
  Widget build(BuildContext context) => ListenableBuilder(
    listenable: widget.state,
    builder: (context, _) => _page(context),
  );

  Widget _page(BuildContext context) {
    final st = widget.state;
    final s = S(st.lang);
    return Scaffold(
      body: Stack(
        fit: StackFit.expand,
        children: [
          AppImage(
            service: st.catalog,
            src: st.data.settings.welcomeBackground.isEmpty
                ? 'asset:assets/images/welcome_bg.jpg'
                : st.data.settings.welcomeBackground,
            fallback: 'asset:assets/images/welcome_bg.jpg',
            alignment: Alignment.topCenter,
          ),
          // تعتيم خفيف أسفل الصورة لوضوح الأزرار
          const DecoratedBox(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                stops: [0, .55, 1],
                colors: [
                  Color(0x00000000),
                  Color(0x00000000),
                  Color(0xB3062B27),
                ],
              ),
            ),
          ),
          SafeArea(
            child: Padding(
              padding: EdgeInsets.fromLTRB(
                context.d(53),
                0,
                context.d(53),
                context.d(90),
              ),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  FadeSlideIn(
                    delayMs: 100,
                    child: LanguageSelector(
                      current: st.lang,
                      onChanged: st.setLang,
                      onDark: true,
                    ),
                  ),
                  SizedBox(height: context.d(34)),
                  FadeSlideIn(
                    delayMs: 200,
                    child: AnimatedBuilder(
                      animation: _pulse,
                      builder: (_, child) => Transform.scale(
                        scale: 1 + .025 * _pulse.value,
                        child: child,
                      ),
                      child: Pressable(
                        key: const Key('welcome_donate'),
                        onTap: _donate,
                        scale: .97,
                        child: Container(
                          height: context.d(140),
                          width: double.infinity,
                          alignment: Alignment.center,
                          decoration: BoxDecoration(
                            color: HColors.teal,
                            borderRadius: BorderRadius.circular(context.r(44)),
                            boxShadow: [
                              BoxShadow(
                                color: HColors.teal.withValues(alpha: .45),
                                blurRadius: context.d(34),
                                offset: Offset(0, context.d(12)),
                              ),
                            ],
                          ),
                          child: AnimatedSwitcher(
                            duration: context.ms(220),
                            child: Row(
                              key: ValueKey(st.lang),
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Text(
                                  s.donateNow,
                                  style: TextStyle(
                                    fontSize: context.d(54),
                                    fontWeight: FontWeight.w700,
                                    color: Colors.white,
                                  ),
                                ),
                                SizedBox(width: context.d(18)),
                                Icon(
                                  Icons.arrow_forward_rounded,
                                  size: context.d(56),
                                  color: Colors.white,
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
          // منطقة مخفية للتشخيص (5 لمسات سريعة)
          Positioned(
            left: 0,
            top: 0,
            width: context.d(260),
            height: context.d(220),
            child: GestureDetector(
              key: const Key('secret_corner'),
              behavior: HitTestBehavior.translucent,
              onTap: _secretTap,
            ),
          ),
        ],
      ),
    );
  }
}
