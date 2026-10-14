import 'package:flutter/material.dart';

import '../data/models.dart';
import '../l10n/strings.dart';
import '../screens/amount_screen.dart';
import '../screens/payment_screen.dart';
import '../state/donation_state.dart';
import '../theme/theme.dart';
import 'common.dart';
import 'numpad.dart';

/// يفتح البرنامج: النوع free تظهر له نافذة منبثقة لكتابة المبلغ ثم الدفع مباشرة،
/// وغيره يذهب إلى صفحة تحديد المبلغ.
Future<void> openProgram(
  BuildContext context,
  DonationState state,
  Program program,
) async {
  state.program = program;
  if (program.kind != ProgramKind.free) {
    await Navigator.of(context).push(kioskRoute(AmountScreen(state: state)));
    return;
  }
  final amount = await showDialog<int>(
    context: context,
    barrierColor: Colors.black54,
    builder: (_) => AmountPopup(state: state, program: program),
  );
  if (amount == null || !context.mounted) return;
  state.amount = amount;
  await Navigator.of(context).push(kioskRoute(PaymentScreen(state: state)));
}

/// نافذة «اكتب مبلغ تبرعك» — لوحة أرقام + زر تبرع.
class AmountPopup extends StatefulWidget {
  const AmountPopup({super.key, required this.state, required this.program});
  final DonationState state;
  final Program program;

  @override
  State<AmountPopup> createState() => _AmountPopupState();
}

class _AmountPopupState extends State<AmountPopup> {
  String _digits = '';

  int get _max => widget.state.data.settings.maxAmount;
  int get _amount => int.tryParse(_digits) ?? 0;

  void _digit(String d) {
    final next = (_digits.isEmpty && d == '0') ? '' : _digits + d;
    if (next.length > '$_max'.length || (int.tryParse(next) ?? 0) > _max) {
      return;
    }
    setState(() => _digits = next);
  }

  void _backspace() {
    if (_digits.isEmpty) return;
    setState(() => _digits = _digits.substring(0, _digits.length - 1));
  }

  @override
  Widget build(BuildContext context) {
    final lang = widget.state.lang;
    final s = S(lang);
    final title = widget.program.popupTitle.of(lang);
    final hint = widget.program.popupHint.of(lang);
    return Dialog(
      key: const Key('amount_popup'),
      backgroundColor: Colors.white,
      insetPadding: EdgeInsets.symmetric(
        horizontal: context.d(70),
        vertical: context.d(40),
      ),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(context.d(48)),
      ),
      child: ConstrainedBox(
        constraints: BoxConstraints(maxWidth: context.d(900)),
        child: SingleChildScrollView(
          padding: EdgeInsets.all(context.d(44)),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title.isNotEmpty ? title : widget.program.title.of(lang),
                key: const Key('popup_title'),
                style: TextStyle(
                  fontSize: context.d(52),
                  fontWeight: FontWeight.w700,
                  color: HColors.tealDark,
                ),
              ),
              SizedBox(height: context.d(36)),
              Container(
                width: double.infinity,
                height: context.d(120),
                padding: EdgeInsets.symmetric(horizontal: context.d(32)),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(context.d(28)),
                  border: Border.all(
                    color: _amount == 0 ? HColors.border : HColors.teal,
                    width: context.d(_amount == 0 ? 2 : 3),
                  ),
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: Text(
                        _amount == 0
                            ? (hint.isNotEmpty ? hint : s.amountLabel)
                            : '$_amount',
                        key: const Key('popup_amount'),
                        style: TextStyle(
                          fontSize: context.d(_amount == 0 ? 40 : 60),
                          fontWeight: _amount == 0
                              ? FontWeight.w400
                              : FontWeight.w700,
                          color: _amount == 0
                              ? const Color(0xFFB8C4C2)
                              : HColors.teal,
                        ),
                      ),
                    ),
                    Text(
                      s.sar,
                      style: TextStyle(
                        fontSize: context.d(34),
                        color: HColors.muted,
                      ),
                    ),
                  ],
                ),
              ),
              SizedBox(height: context.d(20)),
              NumPad(onDigit: _digit, onBackspace: _backspace),
              SizedBox(height: context.d(20)),
              PrimaryButton(
                key: const Key('popup_donate'),
                label: s.continueToPay,
                onPressed: _amount >= 1
                    ? () => Navigator.of(context).pop(_amount)
                    : null,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
