import 'package:flutter/material.dart';

import '../data/catalog.dart';
import '../l10n/strings.dart';
import '../state/donation_state.dart';
import '../theme/theme.dart';
import '../widgets/common.dart';
import '../widgets/payment_dialog.dart';

class CategoryScreen extends StatelessWidget {
  const CategoryScreen({super.key, required this.cat, required this.state});
  final Category cat;
  final DonationState state;

  @override
  Widget build(BuildContext context) {
    final s = S(state.arabic);
    return Scaffold(
      body: Column(
        children: [
          HeaderBar(s: s, onBack: () => Navigator.of(context).pop()),
          Expanded(
            child: ListView(
              padding: EdgeInsets.fromLTRB(
                context.d(53),
                context.d(50),
                context.d(53),
                context.d(40),
              ),
              children: [
                PhotoBanner(
                  image: cat.bannerImage,
                  title: cat.banner(s.ar),
                  subtitle: cat.bannerSub(s.ar),
                  height: context.d(295),
                  titleSize: 50,
                ),
                for (final p in cat.projects) ...[
                  SizedBox(height: context.d(40)),
                  _ProjectCard(project: p, state: state),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _ProjectCard extends StatefulWidget {
  const _ProjectCard({required this.project, required this.state});
  final Project project;
  final DonationState state;

  @override
  State<_ProjectCard> createState() => _ProjectCardState();
}

class _ProjectCardState extends State<_ProjectCard> {
  int _unit = 0; // مبلغ الوحدة المختار
  int _qty = 0;

  int get _total => _unit * _qty;

  void _pick(int a) => setState(() {
    _unit = a;
    if (_qty == 0) _qty = 1;
  });

  void _plus() => setState(() {
    if (_unit == 0) _unit = kQuickAmounts.first;
    if (_qty < 999) _qty++;
  });

  void _minus() => setState(() {
    if (_qty > 0) _qty--;
    if (_qty == 0) _unit = 0;
  });

  @override
  Widget build(BuildContext context) {
    final s = S(widget.state.arabic);
    final p = widget.project;
    final h = context.d(70);
    BoxDecoration box({Color? fill, Color? line}) => BoxDecoration(
      color: fill,
      border: line == null ? null : Border.all(color: line),
      borderRadius: BorderRadius.circular(context.d(16)),
    );

    Widget square(
      Widget child, {
      Color? fill,
      Color? line,
      VoidCallback? onTap,
      Key? key,
    }) => InkWell(
      key: key,
      onTap: onTap,
      borderRadius: BorderRadius.circular(context.d(16)),
      child: Container(
        width: context.d(62),
        height: h,
        alignment: Alignment.center,
        decoration: box(fill: fill, line: line),
        child: child,
      ),
    );

    return Container(
      padding: EdgeInsets.all(context.d(26)),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(context.d(30)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(context.d(26)),
            child: Image.asset(
              p.image,
              width: context.d(246),
              height: context.d(246),
              fit: BoxFit.cover,
            ),
          ),
          SizedBox(width: context.d(26)),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  p.title(s.ar),
                  style: TextStyle(
                    fontSize: context.d(50),
                    fontWeight: FontWeight.w500,
                    color: HColors.ink,
                  ),
                ),
                SizedBox(height: context.d(18)),
                Wrap(
                  spacing: context.d(14),
                  runSpacing: context.d(10),
                  children: [
                    for (final a in kQuickAmounts)
                      InkWell(
                        key: Key('chip_${p.id}_$a'),
                        onTap: () => _pick(a),
                        borderRadius: BorderRadius.circular(context.d(14)),
                        child: Container(
                          width: context.d(138),
                          height: context.d(50),
                          alignment: Alignment.center,
                          decoration: box(
                            fill: _unit == a ? HColors.tealLight : null,
                            line: _unit == a ? HColors.teal : HColors.border,
                          ),
                          child: Text(
                            '$a ${s.sar}',
                            style: TextStyle(
                              fontSize: context.d(26),
                              color: _unit == a ? HColors.teal : HColors.ink,
                            ),
                          ),
                        ),
                      ),
                  ],
                ),
                SizedBox(height: context.d(16)),
                Row(
                  children: [
                    square(
                      Icon(Icons.add, size: context.d(34), color: HColors.teal),
                      fill: HColors.tealLight,
                      onTap: _plus,
                      key: Key('plus_${p.id}'),
                    ),
                    SizedBox(width: context.d(8)),
                    Container(
                      width: context.d(74),
                      height: h,
                      alignment: Alignment.center,
                      decoration: box(line: HColors.border),
                      child: Text(
                        '$_qty',
                        key: Key('qty_${p.id}'),
                        style: TextStyle(
                          fontSize: context.d(30),
                          color: HColors.ink,
                        ),
                      ),
                    ),
                    SizedBox(width: context.d(8)),
                    square(
                      Icon(
                        Icons.remove,
                        size: context.d(34),
                        color: Colors.black38,
                      ),
                      line: HColors.border,
                      onTap: _minus,
                      key: Key('minus_${p.id}'),
                    ),
                    SizedBox(width: context.d(14)),
                    Expanded(
                      child: Container(
                        height: h,
                        padding: EdgeInsets.symmetric(
                          horizontal: context.d(16),
                        ),
                        decoration: box(line: HColors.border),
                        child: Row(
                          children: [
                            Text(
                              s.total,
                              style: TextStyle(
                                fontSize: context.d(20),
                                color: HColors.ink,
                              ),
                            ),
                            const Spacer(),
                            Text(
                              '$_total',
                              key: Key('total_${p.id}'),
                              style: TextStyle(
                                fontSize: context.d(30),
                                fontWeight: FontWeight.w700,
                                color: _total > 0
                                    ? HColors.teal
                                    : Colors.black38,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                    SizedBox(width: context.d(14)),
                    SizedBox(
                      width: context.d(150),
                      height: h,
                      child: FilledButton(
                        key: Key('donate_${p.id}'),
                        style: FilledButton.styleFrom(
                          padding: EdgeInsets.zero,
                          backgroundColor: HColors.teal,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(context.d(16)),
                          ),
                          textStyle: TextStyle(
                            fontFamily: kFont,
                            fontSize: context.d(32),
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        onPressed: _total > 0
                            ? () => showPaymentDialog(
                                context,
                                widget.state,
                                _total,
                              )
                            : null,
                        child: Text(s.donate),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
