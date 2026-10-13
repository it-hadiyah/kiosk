import 'package:flutter/material.dart';

import '../l10n/strings.dart';
import '../state/donation_state.dart';
import '../widgets/kiosk_widgets.dart';
import 'thanks_screen.dart';

class ReviewScreen extends StatefulWidget {
  const ReviewScreen({super.key, required this.state});
  final DonationState state;

  @override
  State<ReviewScreen> createState() => _ReviewScreenState();
}

class _ReviewScreenState extends State<ReviewScreen> {
  bool _busy = false;

  Future<void> _confirm() async {
    if (_busy) return; // يمنع الضغط المزدوج
    setState(() => _busy = true);
    await widget.state.confirm();
    if (!mounted) return;
    Navigator.of(context).pushReplacement(
      MaterialPageRoute(builder: (_) => ThanksScreen(state: widget.state)),
    );
  }

  @override
  Widget build(BuildContext context) {
    final st = widget.state;
    final s = S(st.arabic);
    final p = st.project!;
    return StepScaffold(
      state: st,
      title: s.review,
      footer: _busy
          ? const SizedBox(
              height: 80,
              child: Center(child: CircularProgressIndicator()),
            )
          : NavRow(s: s, nextLabel: s.confirm, onNext: _confirm),
      child: Column(
        children: [
          Card(
            child: Padding(
              padding: const EdgeInsets.all(28),
              child: Column(
                children: [
                  _row(s.project, p.title(st.arabic)),
                  const Divider(height: 40),
                  _row(s.amount, '${st.amount} ${s.currency}'),
                ],
              ),
            ),
          ),
          const SizedBox(height: 24),
          if (_busy) Text(s.processing, style: const TextStyle(fontSize: 26)),
          const Spacer(),
          Text(
            s.paymentNote,
            textAlign: TextAlign.center,
            style: const TextStyle(fontSize: 20, color: Colors.grey),
          ),
        ],
      ),
    );
  }

  Widget _row(String k, String v) => Row(
    mainAxisAlignment: MainAxisAlignment.spaceBetween,
    children: [
      Text(k, style: const TextStyle(fontSize: 26)),
      Flexible(
        child: Text(
          v,
          style: const TextStyle(fontSize: 30, fontWeight: FontWeight.bold),
        ),
      ),
    ],
  );
}
