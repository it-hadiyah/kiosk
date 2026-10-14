import 'package:flutter/material.dart';

import '../l10n/strings.dart';
import '../theme/theme.dart';
import 'common.dart';

/// اختيار اللغة (العربية - Français - English - اردو). الترتيب ثابت ولا ينقلب مع اتجاه اللغة.
class LanguageSelector extends StatelessWidget {
  const LanguageSelector({
    super.key,
    required this.current,
    required this.onChanged,
    this.onDark = false,
    this.compact = false,
  });

  final AppLang current;
  final ValueChanged<AppLang> onChanged;

  /// فوق صورة داكنة (شاشة الترحيب) بدل خلفية فاتحة.
  final bool onDark;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final gap = context.d(compact ? 10 : 16);
    return Directionality(
      textDirection: TextDirection.rtl,
      child: Row(
        mainAxisSize: compact ? MainAxisSize.min : MainAxisSize.max,
        children: [
          for (var i = 0; i < AppLang.values.length; i++) ...[
            if (i > 0) SizedBox(width: gap),
            _chip(context, AppLang.values[i]),
          ],
        ],
      ),
    );
  }

  Widget _chip(BuildContext context, AppLang l) {
    final selected = l == current;
    final fg = selected ? HColors.teal : (onDark ? Colors.white : HColors.ink);
    final bg = selected
        ? Colors.white
        : (onDark ? Colors.white.withValues(alpha: .18) : HColors.tealLight);
    final chip = Pressable(
      key: Key('lang_${l.code}'),
      onTap: () => onChanged(l),
      child: AnimatedContainer(
        duration: context.ms(200),
        height: context.d(compact ? 64 : 100),
        padding: EdgeInsets.symmetric(horizontal: context.d(compact ? 18 : 12)),
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: bg,
          borderRadius: BorderRadius.circular(context.d(compact ? 20 : 30)),
          border: Border.all(
            color: selected
                ? Colors.white
                : (onDark
                      ? Colors.white.withValues(alpha: .55)
                      : Colors.transparent),
            width: context.d(2),
          ),
          boxShadow: selected && onDark
              ? [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: .25),
                    blurRadius: context.d(18),
                    offset: Offset(0, context.d(6)),
                  ),
                ]
              : null,
        ),
        child: Text(
          l.nativeName,
          // اسم اللغة بلغتها هي، فنثبّت اتجاهه
          textDirection: l.rtl ? TextDirection.rtl : TextDirection.ltr,
          maxLines: 1,
          style: TextStyle(
            fontSize: context.d(compact ? 26 : 36),
            fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
            color: fg,
          ),
        ),
      ),
    );
    return compact ? chip : Expanded(child: chip);
  }
}
