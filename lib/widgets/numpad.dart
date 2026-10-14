import 'package:flutter/material.dart';

import '../theme/theme.dart';
import 'common.dart';

/// لوحة أرقام داخلية (الكيوسك لا يعتمد على لوحة مفاتيح النظام).
class NumPad extends StatelessWidget {
  const NumPad({
    super.key,
    required this.onDigit,
    required this.onBackspace,
    this.glass = false,
  });

  /// أزرار شفافة (للعرض فوق صورة).
  final bool glass;
  final void Function(String) onDigit;
  final VoidCallback onBackspace;

  @override
  Widget build(BuildContext context) {
    Widget key(Widget child, VoidCallback f, Key k) => Padding(
      padding: EdgeInsets.all(context.d(7)),
      child: Pressable(
        key: k,
        onTap: f,
        scale: .94,
        child: Container(
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: glass ? const Color(0x33FFFFFF) : Colors.white,
            border: Border.all(
              color: glass ? const Color(0x99FFFFFF) : HColors.border,
            ),
            borderRadius: BorderRadius.circular(context.r(24)),
          ),
          child: child,
        ),
      ),
    );
    Widget digit(String d) => key(
      Text(
        d,
        style: TextStyle(
          fontSize: context.d(46),
          color: glass ? Colors.white : HColors.ink,
        ),
      ),
      () => onDigit(d),
      Key('key_$d'),
    );
    return Directionality(
      textDirection: TextDirection.ltr,
      child: GridView.count(
        crossAxisCount: 3,
        childAspectRatio: 2.55,
        shrinkWrap: true,
        physics: const NeverScrollableScrollPhysics(),
        children: [
          for (final d in ['1', '2', '3', '4', '5', '6', '7', '8', '9'])
            digit(d),
          const SizedBox.shrink(),
          digit('0'),
          key(
            Icon(
              Icons.backspace_outlined,
              size: context.d(44),
              color: glass ? Colors.white : HColors.ink,
            ),
            onBackspace,
            const Key('key_back'),
          ),
        ],
      ),
    );
  }
}
