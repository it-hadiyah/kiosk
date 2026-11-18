import 'dart:convert';
import 'dart:io';

/// جلسة هذا الكيوسك بعد تفعيله بمعرف جلسة من لوحة التحكم.
class DeviceSession {
  const DeviceSession({
    required this.sessionId,
    required this.token,
    required this.name,
  });
  final String sessionId;
  final String token;
  final String name;

  Map<String, Object?> toJson() => {
    'sessionId': sessionId,
    'token': token,
    'name': name,
  };

  static DeviceSession? fromJson(Object? j) {
    if (j is! Map) return null;
    final id = j['sessionId'];
    final tk = j['token'];
    final nm = j['name'];
    if (id is! String || tk is! String || tk.isEmpty) return null;
    return DeviceSession(
      sessionId: id,
      token: tk,
      name: nm is String ? nm : '',
    );
  }
}

/// فشل التفعيل: [code] رمز قصير للتمييز، و[message] نص عربي يظهر للمشغّل.
class ActivationException implements Exception {
  const ActivationException(this.code, this.message);
  final String code;
  final String message;
  @override
  String toString() => message;
}

class HttpReply {
  const HttpReply(this.status, this.json);
  final int status;
  final Map<String, dynamic> json;
}

typedef JsonPoster = Future<HttpReply> Function(
  Uri url,
  Map<String, Object?> body, {
  String? token,
});

Future<HttpReply> httpPostJson(
  Uri url,
  Map<String, Object?> body, {
  String? token,
}) async {
  final c = HttpClient()..connectionTimeout = const Duration(seconds: 6);
  try {
    final req = await c.postUrl(url);
    req.headers.contentType = ContentType.json;
    if (token != null && token.isNotEmpty) {
      req.headers.set('X-Kiosk-Token', token);
    }
    req.add(utf8.encode(jsonEncode(body)));
    final resp = await req.close().timeout(const Duration(seconds: 10));
    final text = await resp.transform(utf8.decoder).join();
    Map<String, dynamic> j = const {};
    try {
      final d = jsonDecode(text);
      if (d is Map<String, dynamic>) j = d;
    } catch (_) {}
    return HttpReply(resp.statusCode, j);
  } finally {
    c.close();
  }
}
