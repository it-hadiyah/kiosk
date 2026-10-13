import 'dart:async';

import 'package:flutter/material.dart';

import '../l10n/strings.dart';
import '../state/donation_state.dart';
import '../widgets/kiosk_widgets.dart';

class ThanksScreen extends StatefulWidget {
  const ThanksScreen({super.key, required this.state});
  final DonationState state;

  @override
  State<ThanksScreen> createState() => _ThanksScreenState();
}

class _ThanksScreenState extends State<ThanksScreen> {
  static const _total = 15;
  int _left = _total;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _timer = Timer.periodic(const Duration(seconds: 1), (t) {
      if (!mounted) return;
      setState(() => _left--);
      if (_left <= 0) _finish();
    });
  }

  void _finish() {
    _timer?.cancel();
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
    final st = widget.state;
    final s = S(st.arabic);
    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            children: [
              const Spacer(),
              const Icon(Icons.check_circle, size: 180, color: Colors.green),
              const SizedBox(height: 24),
              Text(
                s.thanksTitle,
                style: const TextStyle(
                  fontSize: 52,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 12),
              Text(s.thanksSub, style: const TextStyle(fontSize: 28)),
              const SizedBox(height: 32),
              Text(
                '${st.project?.title(st.arabic) ?? ''} — ${st.amount} ${s.currency}',
                style: const TextStyle(fontSize: 30),
              ),
              const SizedBox(height: 8),
              Text(
                '${s.receiptNo}: ${st.reference ?? ''}',
                style: const TextStyle(fontSize: 24),
              ),
              const Spacer(),
              Text(
                '${s.backHomeIn} $_left ${s.seconds}',
                style: const TextStyle(fontSize: 22),
              ),
              const SizedBox(height: 16),
              BigButton(label: s.done, onPressed: _finish),
            ],
          ),
        ),
      ),
    );
  }
}
