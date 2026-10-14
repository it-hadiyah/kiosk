import 'dart:async';

import 'package:flutter/material.dart';

import '../l10n/strings.dart';
import '../state/donation_state.dart';
import '../theme/theme.dart';
import '../widgets/common.dart';
import '../widgets/nfc_animation.dart';

enum _Phase { tap, read, process, done }

/// الخطوة 3 — محاكاة الدفع (جزء من الشاشة نفسها، لا نافذة منبثقة).
/// وضع تجريبي بالكامل: لا اتصال ببوابة دفع ولا SDK ولا بيانات بطاقات.
/// عند الربط الحقيقي لاحقاً تُستبدل [_startSimulation] بنتيجة بوابة الدفع.
class PaymentScreen extends StatefulWidget {
  const PaymentScreen({super.key, required this.state});
  final DonationState state;

  @override
  State<PaymentScreen> createState() => _PaymentScreenState();
}

class _PaymentScreenState extends State<PaymentScreen>
    with TickerProviderStateMixin {
  static const _tapMs = 3000,
      _readMs = 1300,
      _processMs = 1700,
      _homeSeconds = 6;

  late final AnimationController _loop = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 2200),
  );
  late final AnimationController _check = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 900),
  );
  final _timers = <Timer>[];
  _Phase _phase = _Phase.tap;
  int _left = _homeSeconds;
  bool _started = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_started) return;
    _started = true;
    if (context.reduceMotion) {
      _loop.value = .5; // إطار ثابت بدل حركة متكررة
    } else {
      _loop.repeat();
    }
    _startSimulation();
  }

  void _startSimulation() {
    void at(int ms, VoidCallback f) => _timers.add(
      Timer(Duration(milliseconds: ms), () {
        if (mounted) f();
      }),
    );
    at(_tapMs, () => setState(() => _phase = _Phase.read));
    at(_tapMs + _readMs, () => setState(() => _phase = _Phase.process));
    at(_tapMs + _readMs + _processMs, _complete);
  }

  void _complete() {
    setState(() => _phase = _Phase.done);
    _loop.stop();
    context.reduceMotion ? _check.value = 1 : _check.forward();
    _timers.add(
      Timer.periodic(const Duration(seconds: 1), (t) {
        if (!mounted) return;
        setState(() => _left--);
        if (_left <= 0) {
          t.cancel();
          _finish();
        }
      }),
    );
  }

  void _finish() {
    for (final t in _timers) {
      t.cancel();
    }
    widget.state.reset();
    widget.state.catalog.refresh(); // الزائر التالي يرى أحدث نسخة
    Navigator.of(context).popUntil((r) => r.isFirst);
  }

  @override
  void dispose() {
    for (final t in _timers) {
      t.cancel();
    }
    _loop.dispose();
    _check.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => ListenableBuilder(
    listenable: widget.state,
    builder: (context, _) => _page(context),
  );

  Widget _page(BuildContext context) {
    final st = widget.state;
    final s = S(st.lang);
    final project = st.program;
    if (project == null) {
      return const SizedBox.shrink(); // الجلسة انتهت أثناء الإغلاق
    }
    final done = _phase == _Phase.done;
    return PopScope(
      canPop: !done,
      child: Scaffold(
        body: Column(
          children: [
            HeaderBar(
              s: s,
              onBack: done ? null : () => Navigator.of(context).pop(),
              backLabel: s.cancel,
            ),
            Expanded(
              child: Padding(
                padding: EdgeInsets.symmetric(horizontal: context.d(53)),
                child: Column(
                  children: [
                    SizedBox(height: context.d(40)),
                    DemoBadge(text: s.demoBadge),
                    SizedBox(height: context.d(36)),
                    Text(
                      project.title.of(s.lang),
                      style: TextStyle(
                        fontSize: context.d(40),
                        color: HColors.muted,
                      ),
                    ),
                    SizedBox(height: context.d(6)),
                    Text(
                      '${st.amount} ${s.sar}',
                      key: const Key('pay_amount'),
                      style: TextStyle(
                        fontSize: context.d(120),
                        fontWeight: FontWeight.w700,
                        color: HColors.ink,
                      ),
                    ),
                    const Spacer(),
                    SizedBox(
                      height: context.d(700),
                      child: AnimatedSwitcher(
                        duration: context.ms(450),
                        reverseDuration: context.ms(120),
                        switchInCurve: Curves.easeOutCubic,
                        child: done
                            ? _success(context, s)
                            : _terminal(context, s),
                      ),
                    ),
                    const Spacer(),
                    _Steps(phase: _phase, s: s),
                    SizedBox(height: context.d(60)),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _terminal(BuildContext context, S s) {
    final msg = switch (_phase) {
      _Phase.tap => s.tapCard,
      _Phase.read => s.reading,
      _ => s.processing,
    };
    return Column(
      key: const ValueKey('terminal'),
      children: [
        SizedBox(
          height: context.d(470),
          width: context.d(640),
          child: AnimatedBuilder(
            animation: _loop,
            builder: (_, _) => CustomPaint(
              painter: NfcPainter(
                t: _loop.value,
                reading: _phase != _Phase.tap,
              ),
            ),
          ),
        ),
        SizedBox(height: context.d(24)),
        AnimatedSwitcher(
          duration: context.ms(250),
          child: Text(
            msg,
            key: ValueKey(msg),
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: context.d(52),
              fontWeight: FontWeight.w700,
              color: HColors.teal,
            ),
          ),
        ),
        SizedBox(height: context.d(26)),
        SizedBox(
          width: context.d(380),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(context.d(10)),
            child: LinearProgressIndicator(
              minHeight: context.d(10),
              backgroundColor: HColors.tealLight,
              color: HColors.teal,
              value: _phase == _Phase.tap
                  ? null
                  : (_phase == _Phase.read ? .55 : .9),
            ),
          ),
        ),
      ],
    );
  }

  Widget _success(BuildContext context, S s) {
    return Column(
      key: const ValueKey('success_view'),
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        AnimatedBuilder(
          animation: _check,
          builder: (_, _) => SizedBox(
            width: context.d(260),
            height: context.d(260),
            child: CustomPaint(painter: CheckPainter(_check.value)),
          ),
        ),
        SizedBox(height: context.d(24)),
        Text(
          s.successTitle,
          key: const Key('success'),
          textAlign: TextAlign.center,
          style: TextStyle(
            fontSize: context.d(58),
            fontWeight: FontWeight.w700,
            color: HColors.success,
          ),
        ),
        SizedBox(height: context.d(12)),
        Text(
          s.successSub,
          textAlign: TextAlign.center,
          style: TextStyle(fontSize: context.d(32), color: HColors.muted),
        ),
        SizedBox(height: context.d(22)),
        Text(
          s.backHomeIn(_left),
          style: TextStyle(fontSize: context.d(28), color: HColors.muted),
        ),
        SizedBox(height: context.d(10)),
        Pressable(
          key: const Key('done'),
          onTap: _finish,
          child: Container(
            padding: EdgeInsets.symmetric(
              horizontal: context.d(60),
              vertical: context.d(20),
            ),
            decoration: BoxDecoration(
              color: HColors.tealLight,
              borderRadius: BorderRadius.circular(context.d(24)),
            ),
            child: Text(
              s.done,
              style: TextStyle(
                fontSize: context.d(34),
                fontWeight: FontWeight.w700,
                color: HColors.teal,
              ),
            ),
          ),
        ),
      ],
    );
  }
}

/// مؤشر مراحل العملية: تقريب ← قراءة ← معالجة.
class _Steps extends StatelessWidget {
  const _Steps({required this.phase, required this.s});
  final _Phase phase;
  final S s;

  @override
  Widget build(BuildContext context) {
    final labels = [s.stepTap, s.stepRead, s.stepProcess];
    final idx = phase.index; // tap=0, read=1, process=2, done=3
    return Row(
      children: [
        for (var i = 0; i < 3; i++) ...[
          if (i > 0)
            Expanded(
              child: AnimatedContainer(
                duration: context.ms(300),
                height: context.d(5),
                margin: EdgeInsets.only(bottom: context.d(40)),
                color: idx >= i ? HColors.teal : HColors.border,
              ),
            ),
          Column(
            children: [
              AnimatedContainer(
                duration: context.ms(300),
                width: context.d(54),
                height: context.d(54),
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: idx > i
                      ? HColors.teal
                      : (idx == i ? Colors.white : HColors.bg),
                  border: Border.all(
                    color: idx >= i ? HColors.teal : HColors.border,
                    width: context.d(4),
                  ),
                ),
                child: idx > i
                    ? Icon(
                        Icons.check,
                        size: context.d(32),
                        color: Colors.white,
                      )
                    : null,
              ),
              SizedBox(height: context.d(10)),
              Text(
                labels[i],
                style: TextStyle(
                  fontSize: context.d(26),
                  fontWeight: idx == i ? FontWeight.w700 : FontWeight.w400,
                  color: idx >= i ? HColors.ink : HColors.muted,
                ),
              ),
            ],
          ),
        ],
      ],
    );
  }
}
