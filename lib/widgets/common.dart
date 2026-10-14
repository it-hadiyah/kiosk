import 'package:flutter/material.dart';

import '../l10n/strings.dart';
import '../theme/theme.dart';

/// الشريط العلوي الأبيض: الشعار + (تبديل اللغة | رجوع).
class HeaderBar extends StatelessWidget {
  const HeaderBar({super.key, required this.s, this.onBack, this.onToggleLang});
  final S s;
  final VoidCallback? onBack;
  final VoidCallback? onToggleLang;

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
          if (onBack != null)
            Material(
              color: HColors.tealLight,
              borderRadius: BorderRadius.circular(context.d(20)),
              child: InkWell(
                key: const Key('back'),
                borderRadius: BorderRadius.circular(context.d(20)),
                onTap: onBack,
                child: Padding(
                  padding: EdgeInsets.symmetric(
                    horizontal: context.d(40),
                    vertical: context.d(22),
                  ),
                  child: Text(
                    s.back,
                    style: TextStyle(
                      fontSize: context.d(32),
                      color: HColors.teal,
                    ),
                  ),
                ),
              ),
            ),
          if (onToggleLang != null)
            InkWell(
              key: const Key('lang'),
              onTap: onToggleLang,
              child: Padding(
                padding: EdgeInsets.all(context.d(12)),
                child: Row(
                  children: [
                    Text(
                      s.langName,
                      style: TextStyle(
                        fontSize: context.d(34),
                        fontWeight: FontWeight.w700,
                        color: HColors.teal,
                      ),
                    ),
                    SizedBox(width: context.d(14)),
                    Icon(
                      Icons.translate,
                      size: context.d(46),
                      color: HColors.teal,
                    ),
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }
}

/// بانر: صورة على اليسار (تتلاشى إلى لون الخلفية) + نص على اليمين، كما في التصميم.
class PhotoBanner extends StatelessWidget {
  const PhotoBanner({
    super.key,
    required this.image,
    required this.title,
    this.subtitle,
    required this.height,
    this.color = HColors.teal,
    this.onTap,
    this.titleSize = 54,
  });
  final String image;
  final String title;
  final String? subtitle;
  final double height;
  final Color color;
  final VoidCallback? onTap;
  final double titleSize;

  @override
  Widget build(BuildContext context) {
    // النص الإنجليزي أطول، فنصغّره قليلاً ليبقى داخل البانر.
    final k = Directionality.of(context) == TextDirection.ltr ? 0.78 : 1.0;
    return Material(
      color: color,
      borderRadius: BorderRadius.circular(context.d(36)),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: SizedBox(
          height: height,
          child: Stack(
            fit: StackFit.expand,
            children: [
              Positioned(
                left: 0,
                top: 0,
                bottom: 0,
                width: context.d(560),
                child: ShaderMask(
                  shaderCallback: (rect) => const LinearGradient(
                    begin: Alignment.centerLeft,
                    end: Alignment.centerRight,
                    colors: [Colors.white, Colors.white, Colors.transparent],
                    stops: [0, .55, 1],
                  ).createShader(rect),
                  blendMode: BlendMode.dstIn,
                  child: Image.asset(
                    image,
                    fit: BoxFit.cover,
                    alignment: Alignment.centerLeft,
                  ),
                ),
              ),
              Padding(
                padding: EdgeInsets.only(
                  left: context.d(300),
                  right: context.d(48),
                ),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: TextStyle(
                        fontSize: context.d(titleSize * k),
                        height: 1.3,
                        fontWeight: FontWeight.w700,
                        color: Colors.white,
                      ),
                    ),
                    if (subtitle != null) ...[
                      SizedBox(height: context.d(18)),
                      Text(
                        subtitle!,
                        style: TextStyle(
                          fontSize: context.d(32),
                          height: 1.5,
                          color: Colors.white,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
