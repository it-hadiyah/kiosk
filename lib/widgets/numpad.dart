import 'package:flutter/material.dart';

import '../theme/theme.dart';

/// لوحة أرقام داخلية (الكيوسك لا يعتمد على لوحة مفاتيح النظام).
class NumPad extends StatelessWidget {
  const NumPad({super.key, required this.onDigit, required this.onBackspace});
  final void Function(String) onDigit;
  final VoidCallback onBackspace;

  @override
  Widget build(BuildContext context) {
    Widget key(Widget child, VoidCallback f, Key k) => Padding(
      padding: EdgeInsets.all(context.d(6)),
      child: Material(
        color: HColors.bg,
        borderRadius: BorderRadius.circular(context.d(18)),
        child: InkWell(
          key: k,
          borderRadius: BorderRadius.circular(context.d(18)),
          onTap: f,
          child: Center(child: child),
        ),
      ),
    );
    Widget digit(String d) => key(
      Text(
        d,
        style: TextStyle(fontSize: context.d(44), color: HColors.ink),
      ),
      () => onDigit(d),
      Key('key_$d'),
    );
    return GridView.count(
      crossAxisCount: 3,
      childAspectRatio: 1.9,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      children: [
        for (final d in ['1', '2', '3', '4', '5', '6', '7', '8', '9']) digit(d),
        const SizedBox.shrink(),
        digit('0'),
        key(
          Icon(
            Icons.backspace_outlined,
            size: context.d(44),
            color: HColors.ink,
          ),
          onBackspace,
          const Key('key_back'),
        ),
      ],
    );
  }
}
