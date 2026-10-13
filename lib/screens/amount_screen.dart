import 'package:flutter/material.dart';

import '../data/projects.dart';
import '../l10n/strings.dart';
import '../state/donation_state.dart';
import '../widgets/kiosk_widgets.dart';
import 'review_screen.dart';

class AmountScreen extends StatefulWidget {
  const AmountScreen({super.key, required this.state});
  final DonationState state;

  @override
  State<AmountScreen> createState() => _AmountScreenState();
}

class _AmountScreenState extends State<AmountScreen> {
  int _amount = 0;
  bool _custom = false;
  String _digits = '';

  void _press(String d) {
    if (_digits.length >= 6) return;
    setState(() {
      _digits += d;
      _amount = int.tryParse(_digits) ?? 0;
    });
  }

  void _clear() => setState(() {
    _digits = '';
    _amount = 0;
  });

  @override
  Widget build(BuildContext context) {
    final s = S(widget.state.arabic);
    return StepScaffold(
      state: widget.state,
      title: s.chooseAmount,
      footer: NavRow(
        s: s,
        onNext: _amount >= 1
            ? () {
                widget.state.setAmount(_amount);
                Navigator.of(context).push(
                  MaterialPageRoute(
                    builder: (_) => ReviewScreen(state: widget.state),
                  ),
                );
              }
            : null,
      ),
      child: Column(
        children: [
          Text(
            '$_amount ${s.currency}',
            key: const Key('amount_text'),
            style: const TextStyle(fontSize: 64, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 24),
          if (!_custom) ...[
            Wrap(
              spacing: 16,
              runSpacing: 16,
              alignment: WrapAlignment.center,
              children: [
                for (final a in kQuickAmounts)
                  ChoiceChip(
                    key: Key('amount_$a'),
                    label: Padding(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 20,
                        vertical: 18,
                      ),
                      child: Text('$a', style: const TextStyle(fontSize: 32)),
                    ),
                    selected: _amount == a,
                    onSelected: (_) => setState(() => _amount = a),
                  ),
                ActionChip(
                  key: const Key('amount_other'),
                  label: Padding(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 20,
                      vertical: 18,
                    ),
                    child: Text(
                      s.otherAmount,
                      style: const TextStyle(fontSize: 28),
                    ),
                  ),
                  onPressed: () => setState(() {
                    _custom = true;
                    _clear();
                  }),
                ),
              ],
            ),
          ] else
            Expanded(
              child: _Keypad(s: s, onDigit: _press, onClear: _clear),
            ),
          if (!_custom) const Spacer(),
        ],
      ),
    );
  }
}

class _Keypad extends StatelessWidget {
  const _Keypad({
    required this.s,
    required this.onDigit,
    required this.onClear,
  });
  final S s;
  final void Function(String) onDigit;
  final VoidCallback onClear;

  @override
  Widget build(BuildContext context) {
    Widget key(String label, VoidCallback f, {Key? k}) => Padding(
      padding: const EdgeInsets.all(6),
      child: FilledButton.tonal(
        key: k,
        onPressed: f,
        child: Text(label, style: const TextStyle(fontSize: 34)),
      ),
    );
    return GridView.count(
      crossAxisCount: 3,
      childAspectRatio: 1.6,
      physics: const NeverScrollableScrollPhysics(),
      children: [
        for (final d in ['1', '2', '3', '4', '5', '6', '7', '8', '9'])
          key(d, () => onDigit(d), k: Key('key_$d')),
        key(s.clear, onClear, k: const Key('key_clear')),
        key('0', () => onDigit('0'), k: const Key('key_0')),
        const SizedBox.shrink(),
      ],
    );
  }
}
