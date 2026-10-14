import 'package:flutter/material.dart';

import '../data/models.dart';
import '../l10n/strings.dart';
import '../state/donation_state.dart';
import '../theme/theme.dart';
import '../widgets/amount_popup.dart';
import '../widgets/common.dart';
import '../widgets/featured_carousel.dart';
import '../widgets/tile_grid.dart';
import 'catalog_screen.dart';

/// الخطوة 1 — اختيار البرنامج (أو الكتالوج). المحتوى والأحجام من لوحة التحكم.
class ProjectsScreen extends StatefulWidget {
  const ProjectsScreen({super.key, required this.state});
  final DonationState state;

  @override
  State<ProjectsScreen> createState() => _ProjectsScreenState();
}

class _ProjectsScreenState extends State<ProjectsScreen> {
  bool _navigating = false;

  Future<void> _open(Tile t) async {
    if (_navigating) return; // يمنع الضغط المزدوج
    _navigating = true;
    final st = widget.state;
    if (t.catalog != null) {
      await Navigator.of(context)
          .push(kioskRoute(CatalogScreen(state: st, catalogId: t.catalog!.id)));
    } else {
      await openProgram(context, st, t.program!);
    }
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
    final data = st.data;
    final title = data.settings.homeTitle.exact(st.lang);
    final sub = data.settings.homeSubtitle.exact(st.lang);
    final tiles = data.homeTiles;
    final featured = data.featuredTiles;
    return Scaffold(
      body: Column(
        children: [
          HeaderBar(
            s: s,
            iconBack: true,
            onBack: () => Navigator.of(context).pop(),
            lang: st.lang,
            onLang: st.setLang,
          ),
          Expanded(
            child: SingleChildScrollView(
              padding: EdgeInsets.fromLTRB(
                context.d(53),
                context.d(40),
                context.d(53),
                context.d(40),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (featured.isNotEmpty) ...[
                    FeaturedCarousel(
                      // يُعاد بناؤه عند تغيّر العناصر أو المدة من لوحة التحكم
                      key: ValueKey(
                        '${featured.map((t) => t.key).join(',')}|${data.featured.intervalSeconds}',
                      ),
                      tiles: featured,
                      lang: st.lang,
                      service: st.catalog,
                      interval: Duration(
                        seconds: data.featured.intervalSeconds,
                      ),
                      label: data.featured.title.exact(st.lang).isEmpty
                          ? s.popular
                          : data.featured.title.exact(st.lang),
                      onOpen: _open,
                    ),
                    SizedBox(height: context.d(44)),
                  ],
                  FadeSlideIn(
                    child: Text(
                      title.isEmpty ? s.headline : title,
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
                      sub.isEmpty ? s.headlineSub : sub,
                      style: TextStyle(
                        fontSize: context.d(34),
                        color: HColors.muted,
                      ),
                    ),
                  ),
                  SizedBox(height: context.d(40)),
                  if (tiles.isEmpty)
                    Padding(
                      padding: EdgeInsets.only(top: context.d(120)),
                      child: Center(
                        child: Text(
                          '—',
                          style: TextStyle(
                            fontSize: context.d(80),
                            color: HColors.muted,
                          ),
                        ),
                      ),
                    )
                  else
                    TileGrid(
                      tiles: tiles,
                      lang: st.lang,
                      service: st.catalog,
                      onOpen: _open,
                    ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
