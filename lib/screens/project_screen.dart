import 'package:flutter/material.dart';

import '../data/projects.dart';
import '../l10n/strings.dart';
import '../state/donation_state.dart';
import '../widgets/kiosk_widgets.dart';
import 'amount_screen.dart';

class ProjectScreen extends StatelessWidget {
  const ProjectScreen({super.key, required this.state});
  final DonationState state;

  @override
  Widget build(BuildContext context) {
    final s = S(state.arabic);
    return StepScaffold(
      state: state,
      title: s.chooseProject,
      footer: BigButton(
        label: s.back,
        secondary: true,
        onPressed: () => Navigator.of(context).pop(),
      ),
      child: ListView.separated(
        itemCount: kProjects.length,
        separatorBuilder: (_, _) => const SizedBox(height: 16),
        itemBuilder: (_, i) {
          final p = kProjects[i];
          return Card(
            clipBehavior: Clip.antiAlias,
            child: InkWell(
              key: Key('project_${p.id}'),
              onTap: () {
                state.selectProject(p);
                Navigator.of(context).push(
                  MaterialPageRoute(builder: (_) => AmountScreen(state: state)),
                );
              },
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Row(
                  children: [
                    CircleAvatar(
                      radius: 40,
                      backgroundColor: p.color,
                      child: Icon(p.icon, size: 44, color: Colors.white),
                    ),
                    const SizedBox(width: 24),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            p.title(state.arabic),
                            style: const TextStyle(
                              fontSize: 30,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                          const SizedBox(height: 6),
                          Text(
                            p.desc(state.arabic),
                            style: const TextStyle(fontSize: 22),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}
