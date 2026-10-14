import 'dart:async';
import 'dart:math';

import 'package:flutter/material.dart';

import '../l10n/strings.dart';
import '../state/donation_state.dart';
import '../theme/theme.dart';

/// نافذة تمرير البطاقة. **وضع تجريبي**: تحاكي التقدم ثم النجاح بدون أي ربط بالدفع.
/// عند ربط بوابة الدفع تُستبدل محاكاة [_PaymentDialogState._startDemo] بنتيجة الجهاز/البوابة.
Future<void> showPaymentDialog(
  BuildContext context,
  DonationState state,
  int amount,
) {
  return showDialog<void>(
    context: context,
    barrierDismissible: false,
    barrierColor: Colors.black54,
    builder: (_) => _PaymentDialog(state: state, amount: amount),
  );
}

class _PaymentDialog extends StatefulWidget {
  const _PaymentDialog({required this.state, required this.amount});
  final DonationState state;
  final int amount;

  @override
  State<_PaymentDialog> createState() => _PaymentDialogState();
}

class _PaymentDialogState extends State<_PaymentDialog> {
  int _step = 0; // 0..3 نقاط التقدم، 4 = نجاح
  Timer? _timer;
  late final String _ref;

  @override
  void initState() {
    super.initState();
    _ref =
        'HD-${DateTime.now().millisecondsSinceEpoch % 1000000}${Random().nextInt(90) + 10}';
    _startDemo();
  }

  void _startDemo() {
    _timer = Timer.periodic(const Duration(milliseconds: 1500), (t) {
      if (!mounted) return;
      setState(() => _step++);
      if (_step >= 4) {
        t.cancel();
        _timer = Timer(const Duration(seconds: 7), _finish);
      }
    });
  }

  void _finish() {
    if (!mounted) return;
    widget.state.reset();
    Navigator.of(context).popUntil((r) => r.isFirst);
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final s = S(widget.state.arabic);
    final done = _step >= 4;
    return Dialog(
      backgroundColor: const Color(0xFFFAFAFA),
      insetPadding: EdgeInsets.symmetric(horizontal: context.d(190)),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(context.d(64)),
      ),
      child: Padding(
        padding: EdgeInsets.fromLTRB(
          context.d(26),
          context.d(34),
          context.d(26),
          context.d(34),
        ),
        child: Directionality(
          textDirection: TextDirection.ltr,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Row(
                children: [
                  Container(
                    padding: EdgeInsets.symmetric(
                      horizontal: context.d(22),
                      vertical: context.d(8),
                    ),
                    decoration: BoxDecoration(
                      color: Colors.black,
                      borderRadius: BorderRadius.circular(context.d(30)),
                    ),
                    child: Text(
                      s.purchase,
                      style: TextStyle(
                        fontSize: context.d(26),
                        fontWeight: FontWeight.w700,
                        color: Colors.white,
                      ),
                    ),
                  ),
                  const Spacer(),
                  Text(
                    '${widget.amount} ${s.sar}',
                    key: const Key('pay_amount'),
                    style: TextStyle(
                      fontSize: context.d(42),
                      fontWeight: FontWeight.w700,
                      color: Colors.black,
                    ),
                  ),
                ],
              ),
              SizedBox(height: context.d(26)),
              if (!done) ...[
                Image.asset('assets/images/nfc.png', width: context.d(270)),
                SizedBox(height: context.d(26)),
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    for (var i = 0; i < 4; i++)
                      Container(
                        margin: EdgeInsets.symmetric(horizontal: context.d(18)),
                        width: context.d(38),
                        height: context.d(38),
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: i == _step
                              ? const Color(0xFF6DB31F)
                              : const Color(0xFFE6E6E6),
                        ),
                      ),
                  ],
                ),
                SizedBox(height: context.d(24)),
                Text(
                  s.tapCardAr,
                  style: TextStyle(
                    fontSize: context.d(30),
                    fontWeight: FontWeight.w700,
                    color: Colors.black,
                  ),
                ),
                Text(
                  s.tapCardEn,
                  style: TextStyle(
                    fontSize: context.d(28),
                    fontWeight: FontWeight.w700,
                    color: Colors.black,
                  ),
                ),
                SizedBox(height: context.d(26)),
                Image.asset('assets/images/cards.png', width: context.d(270)),
                SizedBox(height: context.d(10)),
                Text(
                  s.demoNote,
                  style: TextStyle(
                    fontSize: context.d(22),
                    color: Colors.black38,
                  ),
                ),
                TextButton(
                  key: const Key('pay_cancel'),
                  onPressed: () => Navigator.of(context).pop(),
                  child: Text(
                    s.cancel,
                    style: TextStyle(
                      fontSize: context.d(28),
                      color: Colors.black54,
                    ),
                  ),
                ),
              ] else ...[
                SizedBox(height: context.d(20)),
                Icon(
                  Icons.check_circle,
                  size: context.d(160),
                  color: const Color(0xFF6DB31F),
                ),
                SizedBox(height: context.d(20)),
                Text(
                  s.successTitle,
                  key: const Key('success'),
                  style: TextStyle(
                    fontSize: context.d(44),
                    fontWeight: FontWeight.w700,
                    color: HColors.ink,
                  ),
                ),
                SizedBox(height: context.d(8)),
                Text(
                  s.successSub,
                  style: TextStyle(fontSize: context.d(28), color: HColors.ink),
                ),
                SizedBox(height: context.d(14)),
                Text(
                  '${s.reference}: $_ref',
                  style: TextStyle(
                    fontSize: context.d(24),
                    color: Colors.black45,
                  ),
                ),
                SizedBox(height: context.d(10)),
                TextButton(
                  key: const Key('done'),
                  onPressed: _finish,
                  child: Text(
                    s.back,
                    style: TextStyle(
                      fontSize: context.d(30),
                      color: HColors.teal,
                    ),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
