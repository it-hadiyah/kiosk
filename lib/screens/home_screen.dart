import 'package:flutter/material.dart';

import '../data/catalog.dart';
import '../l10n/strings.dart';
import '../state/donation_state.dart';
import '../theme/theme.dart';
import '../widgets/amount_dialog.dart';
import '../widgets/common.dart';
import 'category_screen.dart';

class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key, required this.state});
  final DonationState state;

  @override
  Widget build(BuildContext context) {
    final s = S(state.arabic);
    final gap = context.d(54);
    return Scaffold(
      body: Column(
        children: [
          HeaderBar(s: s, onToggleLang: state.toggleLanguage),
          Expanded(
            child: SingleChildScrollView(
              padding: EdgeInsets.fromLTRB(
                context.d(53),
                context.d(70),
                context.d(53),
                context.d(40),
              ),
              child: Column(
                children: [
                  _Hero(
                    s: s,
                    onDonate: () =>
                        showAmountDialog(context, state, zakat: false),
                  ),
                  SizedBox(height: gap),
                  Row(
                    children: [
                      for (var i = 0; i < kCategories.length; i++) ...[
                        if (i > 0) SizedBox(width: context.d(45)),
                        Expanded(
                          child: _CategoryCard(
                            cat: kCategories[i],
                            s: s,
                            state: state,
                          ),
                        ),
                      ],
                    ],
                  ),
                  SizedBox(height: gap),
                  PhotoBanner(
                    key: const Key('zakat'),
                    image: 'assets/images/banner_zakat.jpg',
                    title: s.zakatTitle,
                    subtitle: s.zakatSub,
                    height: context.d(295),
                    titleSize: 60,
                    onTap: () => showAmountDialog(context, state, zakat: true),
                  ),
                  SizedBox(height: gap),
                  PhotoBanner(
                    key: const Key('sadaqah'),
                    image: 'assets/images/banner_sadaqah.jpg',
                    title: s.sadaqahTitle,
                    subtitle: s.sadaqahSub,
                    height: context.d(295),
                    color: HColors.gold,
                    titleSize: 60,
                    onTap: () => showAmountDialog(context, state, zakat: false),
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

class _Hero extends StatelessWidget {
  const _Hero({required this.s, required this.onDonate});
  final S s;
  final VoidCallback onDonate;

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(context.d(36)),
      child: SizedBox(
        height: context.d(428),
        width: double.infinity,
        child: Stack(
          fit: StackFit.expand,
          children: [
            Image.asset('assets/images/hero.jpg', fit: BoxFit.cover),
            const DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [Color(0x00000000), Color(0xCC000000)],
                ),
              ),
            ),
            Padding(
              padding: EdgeInsets.all(context.d(40)),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Expanded(
                    child: Text(
                      s.heroTitle,
                      style: TextStyle(
                        fontSize: context.d(58),
                        height: 1.3,
                        fontWeight: FontWeight.w500,
                        color: Colors.white,
                      ),
                    ),
                  ),
                  SizedBox(width: context.d(24)),
                  FilledButton(
                    key: const Key('hero_donate'),
                    style: FilledButton.styleFrom(
                      backgroundColor: HColors.teal,
                      minimumSize: Size(context.d(240), context.d(86)),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(context.d(24)),
                      ),
                      textStyle: TextStyle(
                        fontFamily: kFont,
                        fontSize: context.d(34),
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                    onPressed: onDonate,
                    child: Text(s.donateNow),
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

class _CategoryCard extends StatelessWidget {
  const _CategoryCard({
    required this.cat,
    required this.s,
    required this.state,
  });
  final Category cat;
  final S s;
  final DonationState state;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(context.d(30)),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        key: Key('cat_${cat.id}'),
        onTap: () => Navigator.of(context).push(
          MaterialPageRoute(
            builder: (_) => ListenableBuilder(
              listenable: state,
              builder: (_, _) => CategoryScreen(cat: cat, state: state),
            ),
          ),
        ),
        child: Column(
          children: [
            AspectRatio(
              aspectRatio: 590 / 481,
              child: Image.asset(
                cat.cardImage,
                fit: BoxFit.cover,
                width: double.infinity,
              ),
            ),
            SizedBox(
              height: context.d(100),
              child: Center(
                child: Text(
                  cat.title(s.ar),
                  style: TextStyle(
                    fontSize: context.d(32),
                    fontWeight: FontWeight.w500,
                    color: HColors.ink,
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
