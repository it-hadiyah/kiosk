import 'dart:math';

import 'package:flutter/material.dart';

import '../data/catalog_service.dart';
import '../data/models.dart';
import '../l10n/strings.dart';
import '../state/donation_state.dart';
import '../theme/theme.dart';
import '../widgets/common.dart';
import '../widgets/numpad.dart';
import 'payment_screen.dart';

/// الخطوة 2 — تحديد المبلغ. السلوك حسب نوع البرنامج:
/// open = مبالغ سريعة + «مبلغ آخر» · presets = مبالغ محددة فقط · fixed = قيمة ثابتة (مع كمية اختيارية).
class AmountScreen extends StatefulWidget {
  const AmountScreen({super.key, required this.state});
  final DonationState state;

  @override
  State<AmountScreen> createState() => _AmountScreenState();
}

class _AmountScreenState extends State<AmountScreen> {
  int? _preset;
  late bool _custom = widget.state.program?.freeEntry ?? false;
  String _digits = '';
  int _qty = 1;
  bool _navigating = false;

  Program get _p => widget.state.program!;
  AppSettings get _set => widget.state.data.settings;
  int get _min => _p.minAmount;
  int get _max => min(_p.maxAmount, _set.maxAmount);

  /// المبالغ الجاهزة المعروضة (خاصة بالبرنامج أو العامة)، ضمن الحدود.
  List<int> get _presets {
    final src = _p.presets.isNotEmpty ? _p.presets : _set.quickAmounts;
    final ok = src.where((a) => a >= _min && a <= _max).toList();
    return ok.isNotEmpty ? ok : src;
  }

  int get _amount {
    if (_p.kind == ProgramKind.fixed) return _p.price * _qty;
    return _custom ? (int.tryParse(_digits) ?? 0) : (_preset ?? 0);
  }

  bool get _valid {
    if (_p.kind == ProgramKind.fixed) {
      return _p.price >= 1 && _qty >= 1 && _amount <= _set.maxAmount;
    }
    final a = _amount;
    return a >= _min && a <= _max;
  }

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
    final next = (_digits == '' && d == '0') ? '' : _digits + d;
    if (next.length > '$_max'.length || (int.tryParse(next) ?? 0) > _max) {
      return; // لا يتجاوز الحد الأعلى
    }
    setState(() => _digits = next);
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
  Widget build(BuildContext context) => ListenableBuilder(
    listenable: widget.state,
    builder: (context, _) => _page(context),
  );

  Widget _page(BuildContext context) {
    final st = widget.state;
    final s = S(st.lang);
    if (st.program == null) {
      return const SizedBox.shrink(); // الجلسة انتهت أثناء الإغلاق
    }
    final p = _p;
    final fixed = p.kind == ProgramKind.fixed;
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
                    child: _ProgramHeader(
                      program: p,
                      lang: st.lang,
                      service: st.catalog,
                    ),
                  ),
                  SizedBox(height: context.d(44)),
                  if (fixed)
                    ..._fixedSection(context, s)
                  else
                    ..._chooseSection(context, s),
                ],
              ),
            ),
          ),
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
                      s.amountLabel,
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
                        '$_amount ${s.sar}',
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

  // ---------- قيمة ثابتة ----------
  List<Widget> _fixedSection(BuildContext context, S s) {
    return [
      FadeSlideIn(
        delayMs: 80,
        child: Container(
          key: const Key('fixed_card'),
          width: double.infinity,
          padding: EdgeInsets.symmetric(vertical: context.d(40)),
          decoration: BoxDecoration(
            color: HColors.tealLight,
            borderRadius: BorderRadius.circular(context.d(32)),
            border: Border.all(color: HColors.teal, width: context.d(3)),
          ),
          child: Column(
            children: [
              Text(
                s.fixedAmount,
                style: TextStyle(fontSize: context.d(30), color: HColors.muted),
              ),
              SizedBox(height: context.d(8)),
              Text(
                '${_p.price} ${s.sar}',
                style: TextStyle(
                  fontSize: context.d(84),
                  fontWeight: FontWeight.w700,
                  color: HColors.teal,
                ),
              ),
            ],
          ),
        ),
      ),
      if (_p.allowQuantity) ...[
        SizedBox(height: context.d(36)),
        FadeSlideIn(
          delayMs: 140,
          child: Row(
            children: [
              Text(
                s.quantity,
                style: TextStyle(
                  fontSize: context.d(40),
                  fontWeight: FontWeight.w700,
                  color: HColors.ink,
                ),
              ),
              const Spacer(),
              _StepButton(
                key: const Key('qty_minus'),
                icon: Icons.remove_rounded,
                onTap: _qty > 1 ? () => setState(() => _qty--) : null,
              ),
              SizedBox(
                width: context.d(150),
                child: Center(
                  child: Text(
                    '$_qty',
                    key: const Key('qty_value'),
                    style: TextStyle(
                      fontSize: context.d(64),
                      fontWeight: FontWeight.w700,
                      color: HColors.ink,
                    ),
                  ),
                ),
              ),
              _StepButton(
                key: const Key('qty_plus'),
                icon: Icons.add_rounded,
                onTap:
                    (_qty < _p.maxQuantity &&
                        _p.price * (_qty + 1) <= _set.maxAmount)
                    ? () => setState(() => _qty++)
                    : null,
              ),
            ],
          ),
        ),
      ],
    ];
  }

  // ---------- مبالغ سريعة / محددة ----------
  List<Widget> _chooseSection(BuildContext context, S s) {
    final canCustom = _p.kind == ProgramKind.open;
    return [
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
      if (_p.freeEntry)
        Padding(
          padding: EdgeInsets.only(top: context.d(26)),
          child: NumPad(onDigit: _digit, onBackspace: _backspace),
        )
      else ...[
        SizedBox(height: context.d(26)),
        FadeSlideIn(
          delayMs: 140,
          child: LayoutBuilder(
            builder: (context, c) {
              final gap = context.d(20);
              final w = (c.maxWidth - gap * 3) / 4;
              return Wrap(
                spacing: gap,
                runSpacing: gap,
                children: [
                  for (final a in _presets)
                    SizedBox(
                      width: w,
                      child: _AmountTile(
                        key: Key('amount_$a'),
                        value: a,
                        currency: s.sar,
                        selected: !_custom && _preset == a,
                        onTap: () => _pickPreset(a),
                      ),
                    ),
                ],
              );
            },
          ),
        ),
        if (canCustom) ...[
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
                    child: NumPad(onDigit: _digit, onBackspace: _backspace),
                  )
                : const SizedBox(width: double.infinity),
          ),
        ],
      ],
    ];
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
    required this.currency,
    required this.selected,
    required this.onTap,
  });
  final int value;
  final String currency;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
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
            FittedBox(
              fit: BoxFit.scaleDown,
              child: Text(
                '$value',
                style: TextStyle(
                  fontSize: context.d(52),
                  height: 1.15,
                  fontWeight: FontWeight.w700,
                  color: selected ? HColors.teal : HColors.ink,
                ),
              ),
            ),
            Text(
              currency,
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

class _StepButton extends StatelessWidget {
  const _StepButton({super.key, required this.icon, required this.onTap});
  final IconData icon;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final on = onTap != null;
    return Pressable(
      onTap: onTap,
      child: Container(
        width: context.d(120),
        height: context.d(120),
        decoration: BoxDecoration(
          color: on ? HColors.teal : const Color(0xFFD5DDDC),
          borderRadius: BorderRadius.circular(context.d(32)),
        ),
        child: Icon(icon, size: context.d(60), color: Colors.white),
      ),
    );
  }
}

class _ProgramHeader extends StatelessWidget {
  const _ProgramHeader({
    required this.program,
    required this.lang,
    required this.service,
  });
  final Program program;
  final AppLang lang;
  final CatalogService service;

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
            child: SizedBox(
              width: context.d(220),
              height: context.d(220),
              child: AppImage(
                service: service,
                src: program.image,
                alignment: program.align,
              ),
            ),
          ),
          SizedBox(width: context.d(28)),
          Expanded(
            child: Text(
              program.title.of(lang),
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
