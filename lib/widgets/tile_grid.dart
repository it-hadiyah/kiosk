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
    final small = size == TileSize.small;
    final r = BorderRadius.circular(context.d(small ? 28 : 34));
    final height = context.d(size == TileSize.large ? 330 : 360);
    final title = tile.title(lang);
    final titleSize = switch (size) {
      TileSize.small => 30.0,
      TileSize.medium => 40.0,
      TileSize.large => 52.0,
    };
    final pad = context.d(small ? 20 : 28);

    final badge = tile.catalog == null
        ? null
        : PositionedDirectional(
            top: context.d(16),
            start: context.d(16),
            child: Container(
              key: Key('badge_${tile.key}'),
              padding: EdgeInsets.symmetric(
                horizontal: context.d(14),
                vertical: context.d(8),
              ),
              decoration: BoxDecoration(
                color: Colors.black.withValues(alpha: .5),
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

    // الصورة تملأ البطاقة كلها، والاسم فوقها على تدرّج داكن خفيف (بدون شريط أبيض)
    final content = Stack(
      fit: StackFit.expand,
      children: [
        AppImage(service: service, src: tile.image, alignment: tile.align),
        const DecoratedBox(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              stops: [0, .42, 1],
              colors: [Color(0x00000000), Color(0x00000000), Color(0xD9062B27)],
            ),
          ),
        ),
        ?badge,
        Positioned.fill(
          child: Padding(
            padding: EdgeInsets.all(pad),
            child: Align(
              alignment: AlignmentDirectional.bottomStart,
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Expanded(
                    child: Text(
                      title,
                      maxLines: small ? 3 : 2,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontSize: context.d(titleSize),
                        height: 1.2,
                        fontWeight: FontWeight.w700,
                        color: Colors.white,
                        shadows: const [
                          Shadow(
                            color: Color(0x99000000),
                            blurRadius: 8,
                            offset: Offset(0, 1),
                          ),
                        ],
                      ),
                    ),
                  ),
                  if (!small) ...[
                    SizedBox(width: context.d(12)),
                    Container(
                      width: context.d(52),
                      height: context.d(52),
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: .22),
                        shape: BoxShape.circle,
                      ),
                      child: Icon(
                        Icons.arrow_forward_rounded,
                        size: context.d(30),
                        color: Colors.white,
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),
        ),
      ],
    );

    return FadeSlideIn(
      delayMs: 100 + order * 70,
      child: Pressable(
        key: Key(tile.key),
        onTap: () => onOpen(tile),
        child: Container(
          height: height,
          decoration: BoxDecoration(
            color: HColors.tealLight,
            borderRadius: r,
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: .12),
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
