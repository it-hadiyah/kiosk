import 'package:flutter/material.dart';

import '../l10n/strings.dart';
import '../state/donation_state.dart';
import '../widgets/kiosk_widgets.dart';
import 'project_screen.dart';

class WelcomeScreen extends StatelessWidget {
  const WelcomeScreen({super.key, required this.state});
  final DonationState state;

  @override
  Widget build(BuildContext context) {
    final s = S(state.arabic);
    final cs = Theme.of(context).colorScheme;
    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            children: [
              Align(
                alignment: AlignmentDirectional.centerEnd,
                child: TextButton(
                  onPressed: state.toggleLanguage,
                  child: Text(
                    s.otherLang,
                    style: const TextStyle(fontSize: 26),
                  ),
                ),
              ),
              const Spacer(),
              Icon(Icons.volunteer_activism, size: 160, color: cs.primary),
              const SizedBox(height: 24),
              Text(
                s.appName,
                style: const TextStyle(
                  fontSize: 56,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 16),
              Text(s.welcomeTitle, style: const TextStyle(fontSize: 40)),
              const SizedBox(height: 12),
              Text(
                s.welcomeSub,
                textAlign: TextAlign.center,
                style: const TextStyle(fontSize: 26),
              ),
              const Spacer(),
              BigButton(
                label: s.start,
                onPressed: () => Navigator.of(context).push(
                  MaterialPageRoute(
                    builder: (_) => ProjectScreen(state: state),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
