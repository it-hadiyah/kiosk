import 'package:flutter/material.dart';

import '../l10n/strings.dart';
import '../state/donation_state.dart';
import '../theme/theme.dart';
import 'numpad.dart';
import 'payment_dialog.dart';

/// نافذة إدخال مبلغ الصدقة/الزكاة، ثم الانتقال لنافذة الدفع.
Future<void> showAmountDialog(
  BuildContext context,
  DonationState state, {
  required bool zakat,
}) {
  return showDialog<void>(
    context: context,
    barrierColor: Colors.black54,
    builder: (_) => _AmountDialog(state: state, zakat: zakat),
  );
}

class _AmountDialog extends StatefulWidget {
  const _AmountDialog({required this.state, required this.zakat});
  final DonationState state;
  final bool zakat;

  @override
  State<_AmountDialog> createState() => _AmountDialogState();
}

class _AmountDialogState extends State<_AmountDialog> {
  String _digits = '';
  int get _amount => int.tryParse(_digits) ?? 0;

  @override
  Widget build(BuildContext context) {
    final s = S(widget.state.arabic);
    final title = widget.zakat ? s.zakatDialogTitle : s.sadaqahDialogTitle;
    final hint = widget.zakat ? s.zakatHint : s.sadaqahHint;
    return Dialog(
      backgroundColor: Colors.white,
      insetPadding: EdgeInsets.symmetric(horizontal: context.d(100)),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(context.d(56)),
      ),
      child: Padding(
        padding: EdgeInsets.all(context.d(54)),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              title,
              style: TextStyle(
                fontSize: context.d(44),
                fontWeight: FontWeight.w700,
                color: HColors.teal,
              ),
            ),
            SizedBox(height: context.d(40)),
            Container(
              height: context.d(110),
              padding: EdgeInsets.symmetric(horizontal: context.d(32)),
              alignment: AlignmentDirectional.centerStart,
              decoration: BoxDecoration(
                border: Border.all(color: HColors.border),
                borderRadius: BorderRadius.circular(context.d(28)),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      _digits.isEmpty ? hint : _digits,
                      key: const Key('amount_text'),
                      style: TextStyle(
                        fontSize: context.d(40),
                        color: _digits.isEmpty ? Colors.black26 : HColors.ink,
                        fontWeight: _digits.isEmpty
                            ? FontWeight.w400
                            : FontWeight.w700,
                      ),
                    ),
                  ),
                  Text(
                    s.sar,
                    style: TextStyle(
                      fontSize: context.d(30),
                      color: HColors.teal,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],
              ),
            ),
            SizedBox(height: context.d(24)),
            NumPad(
              onDigit: (d) {
                if (_digits.length >= 7) {
                  return;
                }
                setState(() => _digits = _digits == '0' ? d : _digits + d);
              },
              onBackspace: () {
                if (_digits.isEmpty) {
                  return;
                }
                setState(
                  () => _digits = _digits.substring(0, _digits.length - 1),
                );
              },
            ),
            SizedBox(height: context.d(24)),
            FilledButton(
              key: const Key('continue_pay'),
              style: FilledButton.styleFrom(
                backgroundColor: HColors.teal,
                minimumSize: Size.fromHeight(context.d(106)),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(context.d(28)),
                ),
                textStyle: TextStyle(
                  fontFamily: kFont,
                  fontSize: context.d(36),
                  fontWeight: FontWeight.w700,
                ),
              ),
              onPressed: _amount >= 1
                  ? () {
                      Navigator.of(context).pop();
                      showPaymentDialog(context, widget.state, _amount);
                    }
                  : null,
              child: Text(s.continueToPay),
            ),
            Center(
              child: TextButton(
                onPressed: () => Navigator.of(context).pop(),
                child: Text(
                  s.cancel,
                  style: TextStyle(
                    fontSize: context.d(30),
                    color: Colors.black45,
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
