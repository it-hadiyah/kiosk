import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../data/analytics.dart';
import '../data/catalog_service.dart';
import '../data/device_session.dart';
import '../theme/theme.dart';
import '../widgets/common.dart';

/// شاشة تفعيل الكيوسك (للمشغّل فقط): معرف الجلسة من لوحة التحكم + اسم الكيوسك.
/// تظهر عند أول تشغيل، وبعد إنهاء الجلسة من اللوحة أو من الكيوسك نفسه (عند نقله).
class SetupScreen extends StatefulWidget {
  const SetupScreen({super.key, required this.catalog});
  final CatalogService catalog;

  @override
  State<SetupScreen> createState() => _SetupScreenState();
}

class _SetupScreenState extends State<SetupScreen> {
  final _code = TextEditingController();
  final _name = TextEditingController();
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _code.dispose();
    _name.dispose();
    super.dispose();
  }

  Future<void> _activate() async {
    if (_busy) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await widget.catalog.activate(code: _code.text, name: _name.text);
    } on ActivationException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } catch (e) {
      if (mounted) setState(() => _error = 'تعذّر التفعيل: $e');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  InputDecoration _dec(BuildContext context, String label, String hint) =>
      InputDecoration(
        labelText: label,
        hintText: hint,
        filled: true,
        fillColor: Colors.white,
        labelStyle: TextStyle(fontSize: context.d(30), color: HColors.muted),
        hintStyle: TextStyle(
          fontSize: context.d(34),
          color: const Color(0xFFB8C4C2),
        ),
        contentPadding: EdgeInsets.symmetric(
          horizontal: context.d(32),
          vertical: context.d(30),
        ),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(context.r(24)),
          borderSide: BorderSide(color: HColors.border),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(context.r(24)),
          borderSide: BorderSide(color: HColors.border, width: 1.5),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(context.r(24)),
          borderSide: BorderSide(color: HColors.teal, width: 3),
        ),
      );

  @override
  Widget build(BuildContext context) {
    final style = TextStyle(
      fontSize: context.d(44),
      color: HColors.ink,
      fontWeight: FontWeight.w600,
    );
    return Scaffold(
      body: Column(
        children: [
          Container(
            color: Colors.white,
            height: context.d(188),
            padding: EdgeInsets.symmetric(horizontal: context.d(53)),
            alignment: AlignmentDirectional.centerStart,
            child: Image.asset('assets/images/logo.png', height: context.d(88)),
          ),
          Expanded(
            child: SingleChildScrollView(
              padding: EdgeInsets.fromLTRB(
                context.d(80),
                context.d(60),
                context.d(80),
                context.d(40),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'تفعيل الكيوسك',
                    key: const Key('setup_title'),
                    style: TextStyle(
                      fontSize: context.d(64),
                      fontWeight: FontWeight.w700,
                      color: HColors.ink,
                    ),
                  ),
                  SizedBox(height: context.d(16)),
                  Text(
                    'أنشئ جلسة جديدة من لوحة التحكم (قسم «الأجهزة») ثم أدخل معرفها هنا مع اسم لهذا الكيوسك. '
                    'إذا نقلت الكيوسك إلى مكان آخر فافتح له جلسة جديدة.',
                    style: TextStyle(
                      fontSize: context.d(32),
                      height: 1.6,
                      color: HColors.muted,
                    ),
                  ),
                  SizedBox(height: context.d(48)),
                  TextField(
                    key: const Key('setup_code'),
                    controller: _code,
                    keyboardType: TextInputType.number,
                    textDirection: TextDirection.ltr,
                    inputFormatters: [
                      FilteringTextInputFormatter.digitsOnly,
                      LengthLimitingTextInputFormatter(8),
                    ],
                    style: style.copyWith(letterSpacing: context.d(6)),
                    decoration: _dec(
                      context,
                      'معرف الجلسة (8 أرقام)',
                      '00000000',
                    ),
                  ),
                  SizedBox(height: context.d(28)),
                  TextField(
                    key: const Key('setup_name'),
                    controller: _name,
                    textInputAction: TextInputAction.done,
                    maxLength: 40,
                    onSubmitted: (_) => _activate(),
                    style: style,
                    decoration: _dec(
                      context,
                      'اسم الكيوسك',
                      'مثال: كيوسك المدخل الرئيسي',
                    ).copyWith(counterText: ''),
                  ),
                  if (_error != null) ...[
                    SizedBox(height: context.d(24)),
                    Container(
                      key: const Key('setup_error'),
                      width: double.infinity,
                      padding: EdgeInsets.all(context.d(24)),
                      decoration: BoxDecoration(
                        color: const Color(0xFFFDECEA),
                        borderRadius: BorderRadius.circular(context.r(20)),
                      ),
                      child: Text(
                        _error!,
                        style: TextStyle(
                          fontSize: context.d(30),
                          color: const Color(0xFFC0392B),
                        ),
                      ),
                    ),
                  ],
                  SizedBox(height: context.d(40)),
                  PrimaryButton(
                    key: const Key('setup_activate'),
                    label: _busy ? '...' : 'تفعيل',
                    onPressed: _busy ? null : _activate,
                  ),
                  SizedBox(height: context.d(36)),
                  Text(
                    'الخادم: ${widget.catalog.baseUrl} · الإصدار ${KioskInfo.version}',
                    textDirection: TextDirection.ltr,
                    style: TextStyle(
                      fontSize: context.d(24),
                      color: HColors.muted,
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
