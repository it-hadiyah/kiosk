import 'package:flutter/material.dart';

import '../data/projects.dart';
import '../l10n/strings.dart';
import '../state/donation_state.dart';
import '../theme/theme.dart';
import '../widgets/common.dart';
import '../widgets/numpad.dart';
import 'payment_screen.dart';

/// الخطوة 2 — تحديد مبلغ التبرع (مبالغ سريعة أو مبلغ مخصص بالأرقام).
class AmountScreen extends StatefulWidget {
  const AmountScreen({super.key, required this.state});
  final DonationState state;

  @override
  State<AmountScreen> createState() => _AmountScreenState();
}

class _AmountScreenState extends State<AmountScreen> {
  int? _preset;
  bool _custom = false;
  String _digits = '';
  bool _navigating = false;

  int get _amount => _custom ? (int.tryParse(_digits) ?? 0) : (_preset ?? 0);
  bool get _valid => _amount >= 1 && _amount <= kMaxAmount;

  void _pickPreset(int a) => setState(() {
    _custom = false;
    _digits = '';
    _preset = a;
  });

  void _openCustom() => setState(() {
    _custom = true;
    _preset = null;
    _digits = '';
  });

  void _digit(String d) {
    if (_digits.length >= 5) return;
    setState(() => _digits = _digits == '' && d == '0' ? '' : _digits + d);
  }

  void _backspace() {
    if (_digits.isEmpty) return;
    setState(() => _digits = _digits.substring(0, _digits.length - 1));
  }

  Future<void> _continue() async {
    if (!_valid || _navigating) return;
    _navigating = true;
    widget.state.amount = _amount;
    await Navigator.of(context)
        .push(kioskRoute(PaymentScreen(state: widget.state)));
    _navigating = false;
  }

  @override
  Widget build(BuildContext context) {
    final st = widget.state;
    final s = S(st.arabic);
    final p = st.project!;
    return Scaffold(
      body: Column(
        children: [
          HeaderBar(s: s, onBack: () => Navigator.of(context).pop()),
          Expanded(
            child: SingleChildScrollView(
              padding: EdgeInsets.fromLTRB(
                context.d(53),
                context.d(44),
                context.d(53),
                context.d(24),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  FadeSlideIn(
                    child: _ProjectHeader(project: p, isAr: s.ar),
                  ),
                  SizedBox(height: context.d(44)),
                  FadeSlideIn(
                    delayMs: 80,
                    child: Text(
                      s.chooseAmount,
                      style: TextStyle(
                        fontSize: context.d(48),
                        fontWeight: FontWeight.w700,
                        color: HColors.ink,
                      ),
                    ),
                  ),
                  SizedBox(height: context.d(26)),
                  FadeSlideIn(
                    delayMs: 140,
                    child: Row(
                      children: [
                        for (var i = 0; i < kQuickAmounts.length; i++) ...[
                          if (i > 0) SizedBox(width: context.d(20)),
                          Expanded(
                            child: _AmountTile(
                              key: Key('amount_${kQuickAmounts[i]}'),
                              value: kQuickAmounts[i],
                              selected: !_custom && _preset == kQuickAmounts[i],
                              onTap: () => _pickPreset(kQuickAmounts[i]),
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                  SizedBox(height: context.d(20)),
                  FadeSlideIn(
                    delayMs: 200,
                    child: Pressable(
                      key: const Key('amount_other'),
                      onTap: _openCustom,
                      child: AnimatedContainer(
                        duration: context.ms(220),
                        height: context.d(96),
                        alignment: Alignment.center,
                        decoration: _tileDecoration(context, _custom),
                        child: Text(
                          s.otherAmount,
                          style: TextStyle(
                            fontSize: context.d(34),
                            fontWeight: FontWeight.w500,
                            color: _custom ? HColors.teal : HColors.ink,
                          ),
                        ),
                      ),
                    ),
                  ),
                  AnimatedSize(
                    duration: context.ms(280),
                    curve: Curves.easeOutCubic,
                    alignment: Alignment.topCenter,
                    child: _custom
                        ? Padding(
                            padding: EdgeInsets.only(top: context.d(16)),
                            child: NumPad(
                              onDigit: _digit,
                              onBackspace: _backspace,
                            ),
                          )
                        : const SizedBox(width: double.infinity),
                  ),
                ],
              ),
            ),
          ),
          // ملخص المبلغ + الزر الرئيسي (ثابتان أسفل الشاشة)
          Container(
            color: Colors.white,
            padding: EdgeInsets.fromLTRB(
              context.d(53),
              context.d(26),
              context.d(53),
              context.d(40),
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Row(
                  children: [
                    Text(
                      s.enterAmount,
                      style: TextStyle(
                        fontSize: context.d(30),
                        color: HColors.muted,
                      ),
                    ),
                    const Spacer(),
                    AnimatedSwitcher(
                      duration: context.ms(160),
                      transitionBuilder: (c, a) => FadeTransition(
                        opacity: a,
                        child: ScaleTransition(
                          scale: Tween(begin: .92, end: 1.0).animate(a),
                          child: c,
                        ),
                      ),
                      child: Text(
                        _amount == 0 ? '0 ${s.sar}' : '$_amount ${s.sar}',
                        key: ValueKey(_amount),
                        style: TextStyle(
                          fontSize: context.d(60),
                          fontWeight: FontWeight.w700,
                          color: _amount == 0 ? HColors.muted : HColors.teal,
                        ),
                      ),
                    ),
                  ],
                ),
                SizedBox(height: context.d(20)),
                PrimaryButton(
                  key: const Key('continue_pay'),
                  label: s.continueToPay,
                  onPressed: _valid ? _continue : null,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

BoxDecoration _tileDecoration(BuildContext context, bool selected) =>
    BoxDecoration(
      color: selected ? HColors.tealLight : Colors.white,
      borderRadius: BorderRadius.circular(context.d(26)),
      border: Border.all(
        color: selected ? HColors.teal : HColors.border,
        width: selected ? context.d(3) : context.d(1.5),
      ),
    );

class _AmountTile extends StatelessWidget {
  const _AmountTile({
    super.key,
    required this.value,
    required this.selected,
    required this.onTap,
  });
  final int value;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final isAr = Localizations.localeOf(context).languageCode == 'ar';
    return Pressable(
      onTap: onTap,
      child: AnimatedContainer(
        duration: context.ms(220),
        curve: Curves.easeOutCubic,
        height: context.d(160),
        decoration: _tileDecoration(context, selected),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(
              '$value',
              style: TextStyle(
                fontSize: context.d(52),
                height: 1.15,
                fontWeight: FontWeight.w700,
                color: selected ? HColors.teal : HColors.ink,
              ),
            ),
            Text(
              S(isAr).sar,
              style: TextStyle(
                fontSize: context.d(24),
                color: selected ? HColors.teal : HColors.muted,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ProjectHeader extends StatelessWidget {
  const _ProjectHeader({required this.project, required this.isAr});
  final Project project;
  final bool isAr;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.all(context.d(22)),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(context.d(32)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: .06),
            blurRadius: context.d(22),
            offset: Offset(0, context.d(8)),
          ),
        ],
      ),
      child: Row(
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(context.d(24)),
            child: Image.asset(
              project.image,
              width: context.d(220),
              height: context.d(220),
              fit: BoxFit.cover,
              alignment: project.align,
            ),
          ),
          SizedBox(width: context.d(28)),
          Expanded(
            child: Text(
              project.title(isAr),
              key: const Key('project_name'),
              style: TextStyle(
                fontSize: context.d(54),
                fontWeight: FontWeight.w700,
                color: HColors.ink,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
