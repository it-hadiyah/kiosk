import 'package:flutter/material.dart';

import '../data/projects.dart';
import '../l10n/strings.dart';
import '../state/donation_state.dart';
import '../theme/theme.dart';
import '../widgets/common.dart';
import 'amount_screen.dart';

/// الخطوة 1 — اختيار المشروع.
class ProjectsScreen extends StatefulWidget {
  const ProjectsScreen({super.key, required this.state});
  final DonationState state;

  @override
  State<ProjectsScreen> createState() => _ProjectsScreenState();
}

class _ProjectsScreenState extends State<ProjectsScreen> {
  bool _navigating = false;

  Future<void> _open(Project p) async {
    if (_navigating) return; // يمنع الضغط المزدوج
    _navigating = true;
    widget.state.project = p;
    await Navigator.of(context)
        .push(kioskRoute(AmountScreen(state: widget.state)));
    _navigating = false;
  }

  @override
  Widget build(BuildContext context) {
    final s = S(widget.state.arabic);
    final gap = context.d(34);
    final pairs = <Widget>[];
    var i = 0;
    for (; i + 1 < kProjects.length; i += 2) {
      pairs.add(
        Row(
          children: [
            Expanded(child: _card(context, kProjects[i], i)),
            SizedBox(width: gap),
            Expanded(child: _card(context, kProjects[i + 1], i + 1)),
          ],
        ),
      );
    }
    return Scaffold(
      body: Column(
        children: [
          HeaderBar(s: s, onToggleLang: widget.state.toggleLanguage),
          Expanded(
            child: SingleChildScrollView(
              padding: EdgeInsets.fromLTRB(
                context.d(53),
                context.d(48),
                context.d(53),
                context.d(40),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  FadeSlideIn(
                    child: Text(
                      s.headline,
                      style: TextStyle(
                        fontSize: context.d(62),
                        fontWeight: FontWeight.w700,
                        color: HColors.ink,
                      ),
                    ),
                  ),
                  SizedBox(height: context.d(8)),
                  FadeSlideIn(
                    delayMs: 60,
                    child: Text(
                      s.headlineSub,
                      style: TextStyle(
                        fontSize: context.d(34),
                        color: HColors.muted,
                      ),
                    ),
                  ),
                  SizedBox(height: context.d(40)),
                  for (final r in pairs) ...[r, SizedBox(height: gap)],
                  if (i < kProjects.length)
                    _card(context, kProjects[i], i, wide: true),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _card(
    BuildContext context,
    Project p,
    int index, {
    bool wide = false,
  }) {
    final s = S(widget.state.arabic);
    final r = BorderRadius.circular(context.d(32));
    final label = Row(
      children: [
        Expanded(
          child: Text(
            p.title(s.ar),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              fontSize: context.d(wide ? 44 : 36),
              fontWeight: FontWeight.w500,
              color: HColors.ink,
            ),
          ),
        ),
        Icon(
          s.ar
              ? Icons.arrow_back_ios_new_rounded
              : Icons.arrow_forward_ios_rounded,
          size: context.d(28),
          color: HColors.teal,
        ),
      ],
    );
    final image = Image.asset(p.image, fit: BoxFit.cover, alignment: p.align);
    return FadeSlideIn(
      delayMs: 100 + index * 70,
      child: Pressable(
        key: Key('project_${p.id}'),
        onTap: () => _open(p),
        child: Container(
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: r,
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: .07),
                blurRadius: context.d(24),
                offset: Offset(0, context.d(8)),
              ),
            ],
          ),
          child: ClipRRect(
            borderRadius: r,
            child: wide
                // البطاقة العريضة الأخيرة: صورة بجانب العنوان
                ? SizedBox(
                    height: context.d(230),
                    child: Row(
                      children: [
                        SizedBox(
                          width: context.d(400),
                          height: double.infinity,
                          child: image,
                        ),
                        Expanded(
                          child: Padding(
                            padding: EdgeInsets.symmetric(
                              horizontal: context.d(34),
                            ),
                            child: label,
                          ),
                        ),
                      ],
                    ),
                  )
                : Column(
                    children: [
                      SizedBox(
                        height: context.d(220),
                        width: double.infinity,
                        child: image,
                      ),
                      SizedBox(
                        height: context.d(96),
                        child: Padding(
                          padding: EdgeInsets.symmetric(
                            horizontal: context.d(28),
                          ),
                          child: label,
                        ),
                      ),
                    ],
                  ),
          ),
        ),
      ),
    );
  }
}
