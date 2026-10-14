import 'dart:async';

import 'package:flutter/material.dart';

import '../data/catalog_service.dart';
import '../data/models.dart';
import '../l10n/strings.dart';
import '../theme/theme.dart';
import 'common.dart';

/// شريط «الأكثر رواجاً»: كل عنصر بمفرده كشريحة كاملة، ويتبدّل تلقائياً كل [interval].
/// اللمس/السحب يوقف التبديل مؤقتاً، والضغط على الشريحة يفتح البرنامج أو الكتالوج.
class FeaturedCarousel extends StatefulWidget {
  const FeaturedCarousel({
    super.key,
    required this.tiles,
    required this.lang,
    required this.service,
    required this.interval,
    required this.label,
    required this.onOpen,
  });

  final List<Tile> tiles;
  final AppLang lang;
  final CatalogService service;
  final Duration interval;
  final String label;
  final void Function(Tile) onOpen;

  @override
  State<FeaturedCarousel> createState() => _FeaturedCarouselState();
}

class _FeaturedCarouselState extends State<FeaturedCarousel> {
  late final PageController _controller;
  Timer? _timer;
  int _index = 0; // الشريحة الحالية ضمن القائمة

  int get _n => widget.tiles.length;

  @override
  void initState() {
    super.initState();
    // صفحة بداية في المنتصف ليمكن السحب للخلف والدوران بلا نهاية
    _controller = PageController(initialPage: _n < 2 ? 0 : _n * 500);
    _start();
  }

  @override
  void didUpdateWidget(FeaturedCarousel old) {
    super.didUpdateWidget(old);
    if (old.interval != widget.interval ||
        old.tiles.length != widget.tiles.length) {
      _index = 0;
      _start();
    }
  }

  void _start() {
    _timer?.cancel();
    if (_n < 2) return;
    _timer = Timer.periodic(widget.interval, (_) => _next());
  }

  void _next() {
    if (!mounted || !_controller.hasClients) return;
    // لا نبدّل والصفحة مغطّاة بشاشة أخرى
    if (ModalRoute.of(context)?.isCurrent == false) return;
    final target =
        (_controller.page ?? _controller.initialPage.toDouble()).round() + 1;
    if (context.reduceMotion) {
      _controller.jumpToPage(target);
    } else {
      _controller.animateToPage(
        target,
        duration: const Duration(milliseconds: 650),
        curve: Curves.easeInOutCubic,
      );
    }
  }

  @override
  void dispose() {
    _timer?.cancel();
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (_n == 0) return const SizedBox.shrink();
    final r = BorderRadius.circular(context.r(36));
    return Container(
      key: const Key('featured_carousel'),
      height: context.d(420),
      decoration: BoxDecoration(
        color: HColors.tealLight,
        borderRadius: r,
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: .14),
            blurRadius: context.d(28),
            offset: Offset(0, context.d(10)),
          ),
        ],
      ),
      child: ClipRRect(
        borderRadius: r,
        child: Stack(
          fit: StackFit.expand,
          children: [
            NotificationListener<ScrollNotification>(
              onNotification: (n) {
                if (n is ScrollStartNotification && n.dragDetails != null) {
                  _timer?.cancel(); // المستخدم يسحب
                }
                if (n is ScrollEndNotification) _start();
                return false;
              },
              child: PageView.builder(
                controller: _controller,
                physics: _n < 2 ? const NeverScrollableScrollPhysics() : null,
                itemCount: _n < 2 ? 1 : null,
                onPageChanged: (i) => setState(() => _index = i % _n),
                itemBuilder: (_, i) => _Slide(
                  tile: widget.tiles[i % _n],
                  lang: widget.lang,
                  service: widget.service,
                  label: widget.label,
                  onOpen: widget.onOpen,
                ),
              ),
            ),
            if (_n > 1)
              PositionedDirectional(
                end: context.d(32),
                bottom: context.d(26),
                child: Row(
                  key: const Key('featured_dots'),
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    for (var i = 0; i < _n; i++)
                      AnimatedContainer(
                        duration: context.ms(250),
                        margin: EdgeInsetsDirectional.only(
                          start: context.d(10),
                        ),
                        width: context.d(i == _index ? 40 : 14),
                        height: context.d(14),
                        decoration: BoxDecoration(
                          color: Colors.white.withValues(
                            alpha: i == _index ? 1 : .55,
                          ),
                          borderRadius: BorderRadius.circular(context.r(10)),
                        ),
                      ),
                  ],
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _Slide extends StatelessWidget {
  const _Slide({
    required this.tile,
    required this.lang,
    required this.service,
    required this.label,
    required this.onOpen,
  });
  final Tile tile;
  final AppLang lang;
  final CatalogService service;
  final String label;
  final void Function(Tile) onOpen;

  @override
  Widget build(BuildContext context) {
    final s = S(lang);
    return Pressable(
      key: Key('featured_${tile.key}'),
      onTap: () => onOpen(tile),
      scale: .985,
      child: Stack(
        fit: StackFit.expand,
        children: [
          AppImage(service: service, src: tile.image, alignment: tile.align),
          const DecoratedBox(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                stops: [0, .35, 1],
                colors: [
                  Color(0x33000000),
                  Color(0x00000000),
                  Color(0xE6062B27),
                ],
              ),
            ),
          ),
          // شارة «الأكثر رواجاً»
          PositionedDirectional(
            top: context.d(26),
            start: context.d(26),
            child: Container(
              padding: EdgeInsets.symmetric(
                horizontal: context.d(20),
                vertical: context.d(10),
              ),
              decoration: BoxDecoration(
                color: const Color(0xFFFFB020),
                borderRadius: BorderRadius.circular(context.r(30)),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(
                    Icons.local_fire_department_rounded,
                    size: context.d(32),
                    color: const Color(0xFF4A2A00),
                  ),
                  SizedBox(width: context.d(8)),
                  Text(
                    label,
                    style: TextStyle(
                      fontSize: context.d(28),
                      fontWeight: FontWeight.w700,
                      color: const Color(0xFF4A2A00),
                    ),
                  ),
                ],
              ),
            ),
          ),
          Padding(
            padding: EdgeInsets.all(context.d(34)),
            child: Align(
              alignment: AlignmentDirectional.bottomStart,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    tile.title(lang),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontSize: context.d(60),
                      height: 1.15,
                      fontWeight: FontWeight.w700,
                      color: Colors.white,
                      shadows: const [
                        Shadow(
                          color: Color(0x99000000),
                          blurRadius: 10,
                          offset: Offset(0, 2),
                        ),
                      ],
                    ),
                  ),
                  SizedBox(height: context.d(18)),
                  Container(
                    padding: EdgeInsets.symmetric(
                      horizontal: context.d(34),
                      vertical: context.d(14),
                    ),
                    decoration: BoxDecoration(
                      color: HColors.teal,
                      borderRadius: BorderRadius.circular(context.r(26)),
                    ),
                    child: Text(
                      s.donateNow,
                      style: TextStyle(
                        fontSize: context.d(32),
                        fontWeight: FontWeight.w700,
                        color: Colors.white,
                      ),
                    ),
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
