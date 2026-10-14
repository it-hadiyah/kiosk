import 'package:flutter/material.dart';

import '../data/catalog_service.dart';
import '../data/models.dart';
import '../l10n/strings.dart';
import '../theme/theme.dart';
import 'common.dart';

/// شبكة البطاقات (الرئيسية وصفحة الكتالوج): ترصّ العناصر في صفوف سعتها 6 وحدات حسب حجم كل عنصر.
class TileGrid extends StatelessWidget {
  const TileGrid({
    super.key,
    required this.tiles,
    required this.lang,
    required this.service,
    required this.onOpen,
  });
  final List<Tile> tiles;
  final AppLang lang;
  final CatalogService service;
  final void Function(Tile) onOpen;

  @override
  Widget build(BuildContext context) {
    final gap = context.d(34);
    final rows = packRows(tiles);
    var index = 0;
    return Column(
      children: [
        for (final row in rows) ...[
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              for (var i = 0; i < row.length; i++) ...[
                if (i > 0) SizedBox(width: gap),
                Expanded(
                  flex: row[i].size.units,
                  child: _TileCard(
                    tile: row[i],
                    lang: lang,
                    service: service,
                    onOpen: onOpen,
                    order: index++,
                  ),
                ),
              ],
              // صف غير ممتلئ: نُبقي العناصر بعرضها الحقيقي
              if (row.fold<int>(0, (a, t) => a + t.size.units) < 6) ...[
                SizedBox(width: gap),
                Spacer(flex: 6 - row.fold<int>(0, (a, t) => a + t.size.units)),
              ],
            ],
          ),
          SizedBox(height: gap),
        ],
      ],
    );
  }
}

class _TileCard extends StatelessWidget {
  const _TileCard({
    required this.tile,
    required this.lang,
    required this.service,
    required this.onOpen,
    required this.order,
  });
  final Tile tile;
  final AppLang lang;
  final CatalogService service;
  final void Function(Tile) onOpen;
  final int order;

  @override
  Widget build(BuildContext context) {
    final size = tile.size;
    final r = BorderRadius.circular(
      context.d(size == TileSize.small ? 26 : 32),
    );
    final img = AppImage(
      service: service,
      src: tile.image,
      alignment: tile.align,
    );
    final title = tile.title(lang);

    Widget label(double font, {int lines = 1}) => Row(
      children: [
        Expanded(
          child: Text(
            title,
            maxLines: lines,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              fontSize: context.d(font),
              height: 1.25,
              fontWeight: FontWeight.w500,
              color: HColors.ink,
            ),
          ),
        ),
        if (size != TileSize.small)
          Icon(
            Icons.arrow_forward_ios_rounded,
            size: context.d(28),
            color: HColors.teal,
          ),
      ],
    );

    final badge = tile.catalog == null
        ? null
        : PositionedDirectional(
            top: context.d(14),
            start: context.d(14),
            child: Container(
              key: Key('badge_${tile.key}'),
              padding: EdgeInsets.symmetric(
                horizontal: context.d(14),
                vertical: context.d(8),
              ),
              decoration: BoxDecoration(
                color: Colors.black.withValues(alpha: .55),
                borderRadius: BorderRadius.circular(context.d(20)),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(
                    Icons.layers_rounded,
                    size: context.d(26),
                    color: Colors.white,
                  ),
                  SizedBox(width: context.d(8)),
                  Text(
                    '${tile.catalog!.items.length}',
                    style: TextStyle(
                      fontSize: context.d(24),
                      fontWeight: FontWeight.w700,
                      color: Colors.white,
                    ),
                  ),
                ],
              ),
            ),
          );

    final Widget content = switch (size) {
      TileSize.large => SizedBox(
        height: context.d(230),
        child: Row(
          children: [
            SizedBox(
              width: context.d(400),
              height: double.infinity,
              child: Stack(fit: StackFit.expand, children: [img, ?badge]),
            ),
            Expanded(
              child: Padding(
                padding: EdgeInsets.symmetric(horizontal: context.d(34)),
                child: label(44, lines: 2),
              ),
            ),
          ],
        ),
      ),
      TileSize.small => Column(
        children: [
          SizedBox(
            height: context.d(190),
            width: double.infinity,
            child: Stack(fit: StackFit.expand, children: [img, ?badge]),
          ),
          SizedBox(
            height: context.d(96),
            child: Padding(
              padding: EdgeInsets.symmetric(horizontal: context.d(16)),
              child: Center(child: label(28, lines: 2)),
            ),
          ),
        ],
      ),
      TileSize.medium => Column(
        children: [
          SizedBox(
            height: context.d(220),
            width: double.infinity,
            child: Stack(fit: StackFit.expand, children: [img, ?badge]),
          ),
          SizedBox(
            height: context.d(96),
            child: Padding(
              padding: EdgeInsets.symmetric(horizontal: context.d(28)),
              child: label(36),
            ),
          ),
        ],
      ),
    };

    return FadeSlideIn(
      delayMs: 100 + order * 70,
      child: Pressable(
        key: Key(tile.key),
        onTap: () => onOpen(tile),
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
          child: ClipRRect(borderRadius: r, child: content),
        ),
      ),
    );
  }
}
