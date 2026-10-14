import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:math';

import 'package:flutter/foundation.dart';

/// معلومات هذا الكيوسك (تُرسل مع كل طلب لمراقبة حالة الأجهزة).
class KioskInfo {
  KioskInfo._();
  static const version = '1.0.0';
  static String deviceId = '';
}

typedef EventSender = Future<void> Function(Uri url, Map<String, Object?> body);

Future<void> _httpPost(Uri url, Map<String, Object?> body) async {
  final c = HttpClient()..connectionTimeout = const Duration(seconds: 4);
  try {
    final req = await c.postUrl(url);
    req.headers.contentType = ContentType.json;
    req.add(utf8.encode(jsonEncode(body)));
    final resp = await req.close().timeout(const Duration(seconds: 5));
    await resp.drain<void>();
  } finally {
    c.close();
  }
}

/// أحداث إحصائية تجريبية (جلسات المحاكاة فقط): بلا أي بيانات شخصية أو مالية.
/// «أطلق وانسَ»: لا يرمي أبداً ولا يؤخر الواجهة، ويُهمل عند غياب عنوان الخادم.
class Analytics {
  Analytics(this.baseUrl, {EventSender? sender}) : _send = sender ?? _httpPost;

  final String baseUrl;
  final EventSender _send;

  void log(
    String type, {
    String? programId,
    int? amount,
    int? durationMs,
    String? lang,
  }) {
    if (baseUrl.isEmpty) return;
    unawaited(
      _send(Uri.parse('$baseUrl/api/events'), {
        'type': type,
        'programId': ?programId,
        'amount': ?amount,
        'durationMs': ?durationMs,
        'lang': ?lang,
        'deviceId': KioskInfo.deviceId,
        'appVersion': KioskInfo.version,
      }).catchError((Object e) => debugPrint('analytics skipped: $e')),
    );
  }

  /// معرّف جهاز عشوائي ثابت (ملف في مجلد الكاش). لا يرتبط بأي شخص.
  static Future<String> loadDeviceId(Directory dir) async {
    try {
      final f = File('${dir.path}/device_id');
      if (await f.exists()) {
        final v = (await f.readAsString()).trim();
        if (v.isNotEmpty) return v;
      }
      final r = Random.secure();
      final id =
          'k${List.generate(8, (_) => r.nextInt(36).toRadixString(36)).join()}';
      await dir.create(recursive: true);
      await f.writeAsString(id);
      return id;
    } catch (_) {
      return 'k${Random().nextInt(1 << 31).toRadixString(36)}';
    }
  }
}
