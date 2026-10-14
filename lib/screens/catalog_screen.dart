import 'package:flutter/material.dart';

import '../data/catalog_service.dart';
import '../data/models.dart';
import '../l10n/strings.dart';
import '../state/donation_state.dart';
import '../theme/theme.dart';
import '../widgets/common.dart';
import '../widgets/tile_grid.dart';
import 'amount_screen.dart';

/// صفحة كتالوج: لافتة بعنوانه ثم برامجه بأحجامها.
class CatalogScreen extends StatefulWidget {
  const CatalogScreen({
    super.key,
    required this.state,
    required this.catalogId,
  });
  final DonationState state;
  final String catalogId;

  @override
  State<CatalogScreen> createState() => _CatalogScreenState();
}

class _CatalogScreenState extends State<CatalogScreen> {
  bool _navigating = false;

  Future<void> _open(Tile t) async {
    if (_navigating || t.program == null) return;
    _navigating = true;
    widget.state.program = t.program;
    await Navigator.of(context)
        .push(kioskRoute(AmountScreen(state: widget.state)));
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
    final c = st.data.catalog(widget.catalogId);
    final tiles = c == null ? const <Tile>[] : st.data.tilesOfCatalog(c);
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
            child: c == null
                ? const SizedBox.shrink()
                : SingleChildScrollView(
                    padding: EdgeInsets.fromLTRB(
                      context.d(53),
                      context.d(40),
                      context.d(53),
                      context.d(40),
                    ),
                    child: Column(
                      children: [
                        FadeSlideIn(
                          child: _Banner(
                            catalog: c,
                            lang: st.lang,
                            service: st.catalog,
                          ),
                        ),
                        SizedBox(height: context.d(40)),
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

class _Banner extends StatelessWidget {
  const _Banner({
    required this.catalog,
    required this.lang,
    required this.service,
  });
  final CatalogGroup catalog;
  final AppLang lang;
  final CatalogService service;

  @override
  Widget build(BuildContext context) {
    final sub = catalog.subtitle.of(lang);
    return ClipRRect(
      borderRadius: BorderRadius.circular(context.d(36)),
      child: SizedBox(
        height: context.d(300),
        width: double.infinity,
        child: Stack(
          fit: StackFit.expand,
          children: [
            AppImage(
              service: service,
              src: catalog.image,
              alignment: catalog.align,
            ),
            const DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [Color(0x33000000), Color(0xCC062B27)],
                ),
              ),
            ),
            Padding(
              padding: EdgeInsets.all(context.d(40)),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.end,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    catalog.title.of(lang),
                    key: const Key('catalog_title'),
                    style: TextStyle(
                      fontSize: context.d(58),
                      height: 1.2,
                      fontWeight: FontWeight.w700,
                      color: Colors.white,
                    ),
                  ),
                  if (sub.isNotEmpty) ...[
                    SizedBox(height: context.d(8)),
                    Text(
                      sub,
                      style: TextStyle(
                        fontSize: context.d(30),
                        height: 1.4,
                        color: Colors.white70,
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
