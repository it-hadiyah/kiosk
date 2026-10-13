import 'package:flutter/material.dart';

import '../l10n/strings.dart';
import '../state/donation_state.dart';

class BigButton extends StatelessWidget {
  const BigButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.secondary = false,
  });
  final String label;
  final VoidCallback? onPressed;
  final bool secondary;

  @override
  Widget build(BuildContext context) {
    final style = secondary
        ? OutlinedButton.styleFrom(
            minimumSize: const Size.fromHeight(80),
            textStyle: const TextStyle(
              fontSize: 26,
              fontWeight: FontWeight.bold,
            ),
          )
        : FilledButton.styleFrom(
            minimumSize: const Size.fromHeight(80),
            textStyle: const TextStyle(
              fontSize: 26,
              fontWeight: FontWeight.bold,
            ),
          );
    return secondary
        ? OutlinedButton(style: style, onPressed: onPressed, child: Text(label))
        : FilledButton(style: style, onPressed: onPressed, child: Text(label));
  }
}

class StepScaffold extends StatelessWidget {
  const StepScaffold({
    super.key,
    required this.title,
    required this.child,
    required this.state,
    this.footer,
  });
  final String title;
  final Widget child;
  final Widget? footer;
  final DonationState state;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        automaticallyImplyLeading: false,
        toolbarHeight: 90,
        title: Text(
          title,
          style: const TextStyle(fontSize: 30, fontWeight: FontWeight.bold),
        ),
        centerTitle: true,
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            children: [
              Expanded(child: child),
              if (footer != null) ...[const SizedBox(height: 16), footer!],
            ],
          ),
        ),
      ),
    );
  }
}

/// أزرار رجوع/متابعة في أسفل كل خطوة.
class NavRow extends StatelessWidget {
  const NavRow({
    super.key,
    required this.s,
    required this.onNext,
    this.nextLabel,
    this.onBack,
  });
  final S s;
  final VoidCallback? onNext;
  final VoidCallback? onBack;
  final String? nextLabel;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: BigButton(
            label: s.back,
            secondary: true,
            onPressed: onBack ?? () => Navigator.of(context).pop(),
          ),
        ),
        const SizedBox(width: 16),
        Expanded(
          flex: 2,
          child: BigButton(label: nextLabel ?? s.next, onPressed: onNext),
        ),
      ],
    );
  }
}
