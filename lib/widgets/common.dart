import 'package:flutter/material.dart';

import '../l10n/strings.dart';
import '../theme/theme.dart';
import 'language_selector.dart';

/// انتقال سلس بين الخطوات: تلاشي + انزلاق خفيف (يُلغى مع تقليل الحركة).
Route<T> kioskRoute<T>(Widget page) {
  return PageRouteBuilder<T>(
    opaque: true,
    transitionDuration: const Duration(milliseconds: 380),
    reverseTransitionDuration: const Duration(milliseconds: 300),
    pageBuilder: (_, _, _) => page,
    transitionsBuilder: (context, anim, _, child) {
      if (context.reduceMotion) return child;
      final curved = CurvedAnimation(parent: anim, curve: Curves.easeOutCubic);
      return FadeTransition(
        opacity: curved,
        child: SlideTransition(
          position: Tween(
            begin: const Offset(0.06, 0),
            end: Offset.zero,
          ).animate(curved),
          child: child,
        ),
      );
    },
  );
}

/// ضغط تفاعلي فوري: تصغير خفيف عند اللمس.
class Pressable extends StatefulWidget {
  const Pressable({
    super.key,
    required this.child,
    required this.onTap,
    this.scale = 0.97,
  });
  final Widget child;
  final VoidCallback? onTap;
  final double scale;

  @override
  State<Pressable> createState() => _PressableState();
}

class _PressableState extends State<Pressable> {
  bool _down = false;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTapDown: widget.onTap == null
          ? null
          : (_) => setState(() => _down = true),
      onTapCancel: () => setState(() => _down = false),
      onTapUp: (_) => setState(() => _down = false),
      onTap: widget.onTap,
      child: AnimatedScale(
        scale: _down && !context.reduceMotion ? widget.scale : 1,
        duration: const Duration(milliseconds: 110),
        curve: Curves.easeOut,
        child: widget.child,
      ),
    );
  }
}

/// ظهور هادئ متدرّج للعناصر.
class FadeSlideIn extends StatelessWidget {
  const FadeSlideIn({super.key, required this.child, this.delayMs = 0});
  final Widget child;
  final int delayMs;

  @override
  Widget build(BuildContext context) {
    if (context.reduceMotion) return child;
    final total = 420 + delayMs;
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0, end: 1),
      duration: Duration(milliseconds: total),
      curve: Interval(delayMs / total, 1, curve: Curves.easeOutCubic),
      builder: (_, v, c) => Opacity(
        opacity: v,
        child: Transform.translate(
          offset: Offset(0, (1 - v) * context.d(28)),
          child: c,
        ),
      ),
      child: child,
    );
  }
}

/// الشريط العلوي: الشعار + (اختيار اللغة | رجوع/إلغاء).
class HeaderBar extends StatelessWidget {
  const HeaderBar({super.key, required this.s, this.lang, this.onLang});
  final S s;
  final AppLang? lang;
  final ValueChanged<AppLang>? onLang;

  @override
  Widget build(BuildContext context) {
    return Container(
      color: Colors.white,
      height: context.d(188),
      padding: EdgeInsets.symmetric(horizontal: context.d(53)),
      child: Row(
        children: [
          Image.asset('assets/images/logo.png', height: context.d(88)),
          const Spacer(),
          if (lang != null && onLang != null)
            LanguageSelector(current: lang!, onChanged: onLang!, compact: true),
        ],
      ),
    );
  }
}

/// زر الرجوع الموحّد: صف تحت الشريط العلوي في بداية السطر، بنفس المكان في كل الصفحات.
class BackRow extends StatelessWidget {
  const BackRow({super.key, required this.label, required this.onTap});
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.fromLTRB(
        context.d(53),
        context.d(28),
        context.d(53),
        0,
      ),
      child: Align(
        alignment: AlignmentDirectional.centerStart,
        child: Pressable(
          key: const Key('back'),
          onTap: onTap,
          child: Container(
            padding: EdgeInsets.symmetric(
              horizontal: context.d(40),
              vertical: context.d(22),
            ),
            decoration: BoxDecoration(
              color: HColors.tealLight,
              borderRadius: BorderRadius.circular(context.r(20)),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  Icons.arrow_back_rounded,
                  size: context.d(36),
                  color: HColors.teal,
                ),
                SizedBox(width: context.d(14)),
                Text(
                  label,
                  style: TextStyle(
                    fontSize: context.d(32),
                    color: HColors.teal,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// الزر الرئيسي الكبير.
class PrimaryButton extends StatelessWidget {
  const PrimaryButton({
    super.key,
    required this.label,
    required this.onPressed,
  });
  final String label;
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) {
    final on = onPressed != null;
    return Pressable(
      onTap: onPressed,
      scale: 0.98,
      child: AnimatedContainer(
        duration: context.ms(200),
        height: context.d(120),
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: on ? HColors.teal : const Color(0xFFD5DDDC),
          borderRadius: BorderRadius.circular(context.r(32)),
          boxShadow: on
              ? [
                  BoxShadow(
                    color: HColors.teal.withValues(alpha: .30),
                    blurRadius: context.d(28),
                    offset: Offset(0, context.d(10)),
                  ),
                ]
              : null,
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: context.d(40),
            fontWeight: FontWeight.w700,
            color: Colors.white,
          ),
        ),
      ),
    );
  }
}

/// شارة "وضع تجريبي".
class DemoBadge extends StatelessWidget {
  const DemoBadge({super.key, required this.text});
  final String text;

  @override
  Widget build(BuildContext context) {
    return Container(
      key: const Key('demo_badge'),
      padding: EdgeInsets.symmetric(
        horizontal: context.d(28),
        vertical: context.d(14),
      ),
      decoration: BoxDecoration(
        color: const Color(0xFFFFF4D6),
        borderRadius: BorderRadius.circular(context.r(40)),
        border: Border.all(color: const Color(0xFFF1D88A)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            Icons.science_outlined,
            size: context.d(34),
            color: const Color(0xFF8A6A00),
          ),
          SizedBox(width: context.d(12)),
          Flexible(
            child: Text(
              text,
              style: TextStyle(
                fontSize: context.d(28),
                fontWeight: FontWeight.w500,
                color: const Color(0xFF6B5200),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
