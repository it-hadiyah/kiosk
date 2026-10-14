'use strict';
// خادم كتالوج كيوسك هدية + لوحة التحكم. بدون أي اعتماديات خارجية (Node >= 18).
//   ADMIN_PASSWORD=...  PORT=8080  DATA_DIR=./data  node server.js

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { normalize } = require('./validate');

const PORT = Number(process.env.PORT || 8080);
const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(__dirname, 'data'));
const SEED_DIR = path.join(__dirname, 'seed');
const PUBLIC_DIR = path.join(__dirname, 'public');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
const HISTORY_DIR = path.join(DATA_DIR, 'history');
const LIVE = path.join(DATA_DIR, 'catalog.json');
const DRAFT = path.join(DATA_DIR, 'draft.json');
const AUDIT = path.join(DATA_DIR, 'audit.jsonl');
const STATS = path.join(DATA_DIR, 'analytics.json');

let ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
let generatedPassword = false;
if (!ADMIN_PASSWORD) {
  ADMIN_PASSWORD = crypto.randomBytes(6).toString('base64url');
  generatedPassword = true;
}
// الأدوار: كلمة مرور لكل دور (الأعلى أولاً). غير المضبوط منها يُعطَّل.
//   ADMIN_PASSWORD → super (كل شيء) · MANAGER_PASSWORD → manager (نشر + إعدادات + وسائط)
//   EDITOR_PASSWORD → editor (تعديل المسودة ورفع الصور) · VIEWER_PASSWORD → viewer (قراءة فقط)
const ROLE_PASSWORDS = [
  ['super', () => ADMIN_PASSWORD],
  ['manager', () => process.env.MANAGER_PASSWORD || ''],
  ['editor', () => process.env.EDITOR_PASSWORD || ''],
  ['viewer', () => process.env.VIEWER_PASSWORD || ''],
];
const ROLE_CAN = {
  viewer: new Set(['read']),
  editor: new Set(['read', 'edit', 'upload']),
  manager: new Set(['read', 'edit', 'upload', 'publish', 'settings', 'media_delete', 'audit', 'stats']),
  super: new Set(['read', 'edit', 'upload', 'publish', 'settings', 'media_delete', 'audit', 'stats']),
};
const SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
const TOKEN_TTL_MS = 12 * 60 * 60 * 1000;

// ---------- تجهيز البيانات ----------
function ensureData() {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  fs.mkdirSync(HISTORY_DIR, { recursive: true });
  if (!fs.existsSync(LIVE)) {
    fs.copyFileSync(path.join(SEED_DIR, 'catalog.json'), LIVE);
    const seedUploads = path.join(SEED_DIR, 'uploads');
    for (const f of fs.existsSync(seedUploads) ? fs.readdirSync(seedUploads) : []) {
      const dest = path.join(UPLOADS_DIR, f);
      if (!fs.existsSync(dest)) fs.copyFileSync(path.join(seedUploads, f), dest);
    }
  }
  if (!fs.existsSync(DRAFT)) fs.copyFileSync(LIVE, DRAFT);
}
const readJson = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
function writeJsonAtomic(f, obj) {
  const tmp = f + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2));
  fs.renameSync(tmp, f);
}
const sameContent = (a, b) => {
  const strip = (o) => JSON.stringify({ ...o, updatedAt: 0 });
  return strip(a) === strip(b);
};

// ---------- مصادقة ----------
function sign(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const mac = crypto.createHmac('sha256', SECRET).update(body).digest('base64url');
  return `${body}.${mac}`;
}
function verifyToken(token) {
  const [body, mac] = String(token || '').split('.');
  if (!body || !mac) return false;
  const expect = crypto.createHmac('sha256', SECRET).update(body).digest('base64url');
  const a = Buffer.from(mac), b = Buffer.from(expect);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;
  try {
    const t = JSON.parse(Buffer.from(body, 'base64url').toString());
    return t.exp > Date.now() ? t : false;
  } catch { return false; }
}
const failures = new Map(); // ip -> {n, until}
function rateLimited(ip) {
  const f = failures.get(ip);
  return f && f.n >= 5 && f.until > Date.now();
}
function noteFailure(ip) {
  const f = failures.get(ip);
  if (!f || f.until < Date.now()) failures.set(ip, { n: 1, until: Date.now() + 60_000 });
  else f.n++;
}
function safeEqual(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

// ---------- أدوات HTTP ----------
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
  '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
};
function send(res, code, body, headers = {}) {
  const isBuf = Buffer.isBuffer(body);
  const data = isBuf ? body : typeof body === 'string' ? body : JSON.stringify(body);
  res.writeHead(code, {
    'Content-Type': isBuf || typeof body === 'string' ? 'text/plain; charset=utf-8' : 'application/json; charset=utf-8',
    'X-Content-Type-Options': 'nosniff',
    ...headers,
  });
  res.end(data);
}
function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) { reject(Object.assign(new Error('الملف كبير جداً'), { status: 413 })); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}
async function readJsonBody(req, limit = 1024 * 1024) {
  const buf = await readBody(req, limit);
  try { return JSON.parse(buf.toString('utf8') || '{}'); } catch { throw Object.assign(new Error('JSON غير صالح'), { status: 400 }); }
}
function serveFile(req, res, file, extra = {}) {
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) return send(res, 404, { error: 'غير موجود' });
    const type = MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type, 'Content-Length': st.size, 'X-Content-Type-Options': 'nosniff', ...extra });
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(file).pipe(res);
  });
}
function within(base, rel) {
  const p = path.resolve(base, '.' + path.sep + decodeURIComponent(rel));
  return p.startsWith(base + path.sep) ? p : null;
}

// ---------- الصور ----------
function sniffImage(buf) {
  if (buf.length > 12 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg';
  if (buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (buf.length > 12 && buf.subarray(0, 4).toString() === 'RIFF' && buf.subarray(8, 12).toString() === 'WEBP') return 'webp';
  return null;
}

// ---------- سجل التدقيق ----------
function audit(who, action, summary, extra = {}) {
  try {
    const line = JSON.stringify({ at: new Date().toISOString(), role: who && who.role || '-', ip: extra.ip || '', action, summary: String(summary || '').slice(0, 400) });
    fs.appendFileSync(AUDIT, line + '\n');
  } catch (e) { console.error('audit failed', e.message); }
}
function readAudit(limit = 200) {
  if (!fs.existsSync(AUDIT)) return [];
  const lines = fs.readFileSync(AUDIT, 'utf8').split('\n').filter(Boolean).slice(-limit).reverse();
  return lines.map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
}
const nameOf = (o) => (o && o.title && (o.title.ar || o.title.en)) || (o && o.id) || '?';
/** ملخص عربي للفروق بين نسختين من الكتالوج (للتدقيق والنشر). */
function diffSummary(a, b) {
  const out = [];
  const cmp = (label, la, lb) => {
    const A = new Map((la || []).map((x) => [x.id, x])), B = new Map((lb || []).map((x) => [x.id, x]));
    for (const [id, x] of B) {
      if (!A.has(id)) out.push(`إضافة ${label} «${nameOf(x)}»`);
      else if (JSON.stringify(A.get(id)) !== JSON.stringify(x)) out.push(`تعديل ${label} «${nameOf(x)}»`);
    }
    for (const [id, x] of A) if (!B.has(id)) out.push(`حذف ${label} «${nameOf(x)}»`);
  };
  cmp('برنامج', a.programs, b.programs);
  cmp('كتالوج', a.catalogs, b.catalogs);
  if (JSON.stringify(a.home) !== JSON.stringify(b.home)) out.push('تغيير الصفحة الرئيسية');
  if (JSON.stringify(a.featured) !== JSON.stringify(b.featured)) out.push('تغيير «الأكثر رواجاً»');
  if (JSON.stringify(a.settings) !== JSON.stringify(b.settings)) out.push('تغيير الإعدادات');
  return out;
}

// ---------- مكتبة الوسائط ----------
function mediaUsage() {
  const use = new Map(); // /uploads/x → [وصف]
  const add = (u, d) => { if (u && u.startsWith('/uploads/')) { if (!use.has(u)) use.set(u, new Set()); use.get(u).add(d); } };
  for (const [file, tag] of [[DRAFT, 'مسودة'], [LIVE, 'منشور']]) {
    let c; try { c = readJson(file); } catch { continue; }
    for (const p of c.programs || []) { add(p.image, `${tag}: برنامج «${nameOf(p)}»`); add(p.popupImage, `${tag}: نافذة «${nameOf(p)}»`); }
    for (const k of c.catalogs || []) add(k.image, `${tag}: كتالوج «${nameOf(k)}»`);
    if (c.settings) add(c.settings.welcomeBackground, `${tag}: خلفية الترحيب`);
  }
  return use;
}
function listMedia() {
  const use = mediaUsage();
  return fs.readdirSync(UPLOADS_DIR).filter((f) => /\.(jpe?g|png|webp)$/i.test(f)).map((f) => {
    const st = fs.statSync(path.join(UPLOADS_DIR, f));
    return { name: f, url: `/uploads/${f}`, size: st.size, at: st.mtime.toISOString(), usedBy: [...(use.get(`/uploads/${f}`) || [])] };
  }).sort((x, y) => y.at.localeCompare(x.at));
}

// ---------- إحصائيات المحاكاة (تجريبية — بلا بيانات شخصية) ----------
let stats = null;
function freshStats() { return { since: new Date().toISOString(), sessions: 0, started: 0, completed: 0, abandoned: 0, durationSum: 0, programs: {}, amounts: {}, devices: {}, daily: {} }; }
function loadStats() { if (stats) return stats; try { stats = readJson(STATS); } catch { stats = freshStats(); } return stats; }
let statsTimer = null;
function saveStatsSoon() { if (statsTimer) return; statsTimer = setTimeout(() => { statsTimer = null; try { writeJsonAtomic(STATS, stats); } catch (e) { console.error(e.message); } }, 5000); statsTimer.unref && statsTimer.unref(); }
function touchDevice(id, version, lang) {
  if (!id) return;
  const S = loadStats(); const key = String(id).replace(/[^\w-]/g, '').slice(0, 24); if (!key) return;
  if (!S.devices[key] && Object.keys(S.devices).length >= 50) return;
  S.devices[key] = { lastSeen: new Date().toISOString(), version: String(version || '').slice(0, 16), lang: String(lang || '').slice(0, 4) };
  saveStatsSoon();
}
const EVENT_TYPES = new Set(['session_start', 'program_selected', 'amount_chosen', 'payment_started', 'payment_completed', 'session_abandoned', 'heartbeat']);
function recordEvent(e) {
  if (!e || !EVENT_TYPES.has(e.type)) return false;
  const S = loadStats(); const day = new Date().toISOString().slice(0, 10);
  const D = S.daily[day] || (S.daily[day] = { sessions: 0, completed: 0 });
  const pid = typeof e.programId === 'string' ? e.programId.replace(/[^\w-]/g, '').slice(0, 40) : '';
  const P = pid && (S.programs[pid] || (Object.keys(S.programs).length < 200 ? (S.programs[pid] = { selected: 0, completed: 0 }) : null));
  switch (e.type) {
    case 'session_start': S.sessions++; D.sessions++; break;
    case 'program_selected': if (P) P.selected++; break;
    case 'amount_chosen': { const a = Math.round(Number(e.amount)); if (a >= 1 && a <= 1e12) { const k = String(a); if (S.amounts[k] || Object.keys(S.amounts).length < 300) S.amounts[k] = (S.amounts[k] || 0) + 1; } break; }
    case 'payment_started': S.started++; break;
    case 'payment_completed': S.completed++; D.completed++; if (P) P.completed++; { const d = Number(e.durationMs); if (d > 0 && d < 3_600_000) S.durationSum += d; } break;
    case 'session_abandoned': S.abandoned++; break;
    default: break;
  }
  const days = Object.keys(S.daily).sort(); for (const d of days.slice(0, Math.max(0, days.length - 60))) delete S.daily[d];
  touchDevice(e.deviceId, e.appVersion, e.lang);
  saveStatsSoon();
  return true;
}
const evBucket = new Map(); // ip -> {n, reset}
function eventAllowed(who) {
  const now = Date.now(); const b = evBucket.get(who);
  if (!b || b.reset < now) { evBucket.set(who, { n: 1, reset: now + 60_000 }); return true; }
  return ++b.n <= 300;
}

// ---------- المسارات ----------
function auth(req) {
  const h = req.headers.authorization || '';
  const t = h.startsWith('Bearer ') && verifyToken(h.slice(7));
  if (!t) return null;
  return { role: ROLE_CAN[t.role] ? t.role : 'viewer', exp: t.exp };
}
const can = (who, perm) => !!who && ROLE_CAN[who.role].has(perm);
const forbid = (res) => send(res, 403, { error: 'ليست لديك صلاحية لهذا الإجراء' });
const ip = (req) => req.socket.remoteAddress || '?';

async function handle(req, res) {
  const url = new URL(req.url, 'http://x');
  const p = url.pathname;
  const m = req.method;

  if (m === 'OPTIONS') return send(res, 204, '', { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'If-None-Match, Content-Type, X-Kiosk-Device, X-Kiosk-Version' });

  // --- عام (يقرؤه التطبيق) ---
  if (p === '/api/health') return send(res, 200, { ok: true });
  if (p === '/api/catalog' && (m === 'GET' || m === 'HEAD')) {
    if (req.headers['x-kiosk-device']) touchDevice(req.headers['x-kiosk-device'], req.headers['x-kiosk-version'], '');
    const body = fs.readFileSync(LIVE);
    const etag = '"' + crypto.createHash('sha1').update(body).digest('hex') + '"';
    const cors = { 'Access-Control-Allow-Origin': '*', ETag: etag, 'Cache-Control': 'no-cache', 'Content-Type': 'application/json; charset=utf-8' };
    if (req.headers['if-none-match'] === etag) { res.writeHead(304, cors); return res.end(); }
    res.writeHead(200, cors);
    return res.end(m === 'HEAD' ? undefined : body);
  }
  if (p === '/api/events' && m === 'POST') {
    if (!eventAllowed(ip(req))) return send(res, 429, { error: 'كثير' }, { 'Access-Control-Allow-Origin': '*' });
    const body = await readJsonBody(req, 2048);
    return send(res, recordEvent(body) ? 200 : 400, { ok: true }, { 'Access-Control-Allow-Origin': '*' });
  }
  if (p.startsWith('/uploads/')) {
    const f = within(UPLOADS_DIR, p.slice('/uploads/'.length));
    if (!f) return send(res, 400, { error: 'مسار غير صالح' });
    return serveFile(req, res, f, { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'public, max-age=86400' });
  }

  // --- الدخول ---
  if (p === '/api/login' && m === 'POST') {
    const who = ip(req);
    if (rateLimited(who)) return send(res, 429, { error: 'محاولات كثيرة، انتظر دقيقة' });
    const body = await readJsonBody(req, 4096);
    let role = null;
    for (const [rname, getPw] of ROLE_PASSWORDS) {
      const pw = getPw();
      if (pw && safeEqual(body.password ?? '', pw)) { role = rname; break; }
    }
    if (!role) { noteFailure(who); audit(null, 'login_failed', 'محاولة دخول فاشلة', { ip: who }); return send(res, 401, { error: 'كلمة المرور غير صحيحة' }); }
    failures.delete(who);
    const exp = Date.now() + TOKEN_TTL_MS;
    audit({ role }, 'login', 'تسجيل دخول', { ip: who });
    return send(res, 200, { token: sign({ exp, role }), expiresAt: exp, role });
  }

  // --- الإدارة ---
  if (p.startsWith('/api/admin/')) {
    const who = auth(req);
    if (!who) return send(res, 401, { error: 'يلزم تسجيل الدخول' });
    if (p === '/api/admin/me') return send(res, 200, { role: who.role, can: [...ROLE_CAN[who.role]] });

    if (p === '/api/admin/catalog' && m === 'GET') {
      const draft = readJson(DRAFT), live = readJson(LIVE);
      return send(res, 200, { catalog: draft, hasUnpublished: !sameContent(draft, live), liveUpdatedAt: live.updatedAt });
    }
    if (p === '/api/admin/catalog' && m === 'PUT') {
      if (!can(who, 'edit')) return forbid(res);
      const body = await readJsonBody(req);
      const { catalog, errors, warnings } = normalize(body.catalog ?? body);
      if (errors.length) return send(res, 422, { error: 'بيانات غير صالحة', errors, warnings });
      const prevDraft = readJson(DRAFT);
      if (!can(who, 'settings') && JSON.stringify(prevDraft.settings) !== JSON.stringify(catalog.settings)) return send(res, 403, { error: 'تعديل الإعدادات العامة يتطلب صلاحية «مدير المحتوى»' });
      const changes = diffSummary(prevDraft, catalog);
      if (changes.length) audit(who, 'draft_save', changes.slice(0, 6).join('، ') + (changes.length > 6 ? ` (+${changes.length - 6})` : ''), { ip: ip(req) });
      writeJsonAtomic(DRAFT, catalog);
      return send(res, 200, { catalog, warnings, hasUnpublished: !sameContent(catalog, readJson(LIVE)) });
    }
    if (p === '/api/admin/publish' && m === 'POST') {
      if (!can(who, 'publish')) return forbid(res);
      const draft = readJson(DRAFT);
      const { catalog, errors, warnings } = normalize(draft);
      if (errors.length) return send(res, 422, { error: 'لا يمكن النشر', errors, warnings });
      const prev = fs.readFileSync(LIVE);
      const pubChanges = diffSummary(JSON.parse(prev.toString('utf8')), catalog);
      audit(who, 'publish', pubChanges.length ? pubChanges.slice(0, 8).join('، ') : 'نشر بلا تغييرات في المحتوى', { ip: ip(req) });
      fs.writeFileSync(path.join(HISTORY_DIR, new Date().toISOString().replace(/[:.]/g, '-') + '.json'), prev);
      writeJsonAtomic(LIVE, catalog);
      writeJsonAtomic(DRAFT, catalog);
      const files = fs.readdirSync(HISTORY_DIR).sort();
      for (const f of files.slice(0, Math.max(0, files.length - 30))) fs.unlinkSync(path.join(HISTORY_DIR, f));
      return send(res, 200, { ok: true, publishedAt: catalog.updatedAt, warnings });
    }
    if (p === '/api/admin/history' && m === 'GET') {
      const list = fs.readdirSync(HISTORY_DIR).filter((f) => f.endsWith('.json')).sort().reverse()
        .map((f) => ({ id: f.replace(/\.json$/, ''), at: f.replace(/\.json$/, '').replace(/^(\d{4}-\d\d-\d\dT\d\d)-(\d\d)-(\d\d)-(\d+)Z$/, '$1:$2:$3.$4Z') }));
      return send(res, 200, { history: list });
    }
    if (p === '/api/admin/restore' && m === 'POST') {
      if (!can(who, 'publish')) return forbid(res);
      const { id } = await readJsonBody(req, 4096);
      const f = within(HISTORY_DIR, `${id}.json`);
      if (!f || !fs.existsSync(f)) return send(res, 404, { error: 'النسخة غير موجودة' });
      const { catalog } = normalize(readJson(f));
      writeJsonAtomic(DRAFT, catalog);
      audit(who, 'restore', `استعادة نسخة ${id} إلى المسودة`, { ip: ip(req) });
      return send(res, 200, { catalog });
    }
    if (p === '/api/admin/upload' && m === 'POST') {
      if (!can(who, 'upload')) return forbid(res);
      const buf = await readBody(req, 6 * 1024 * 1024);
      const ext = sniffImage(buf);
      if (!ext) return send(res, 415, { error: 'الملف ليس صورة مدعومة (jpg / png / webp)' });
      const base = path.basename(String(url.searchParams.get('name') || 'image')).replace(/\.[^.]*$/, '').replace(/[^\w\-]+/g, '_').slice(0, 30) || 'image';
      const name = `${base}-${crypto.randomBytes(4).toString('hex')}.${ext}`;
      fs.writeFileSync(path.join(UPLOADS_DIR, name), buf);
      audit(who, 'upload', `رفع صورة ${name} (${Math.round(buf.length / 1024)}KB)`, { ip: ip(req) });
      return send(res, 200, { url: `/uploads/${name}` });
    }
    if (p === '/api/admin/media' && m === 'GET') return send(res, 200, { media: listMedia() });
    if (p === '/api/admin/media' && m === 'DELETE') {
      if (!can(who, 'media_delete')) return forbid(res);
      const name = path.basename(String(url.searchParams.get('name') || ''));
      const f = within(UPLOADS_DIR, name);
      if (!name || !f || !fs.existsSync(f)) return send(res, 404, { error: 'الصورة غير موجودة' });
      const used = mediaUsage().get(`/uploads/${name}`);
      if (used && used.size) return send(res, 409, { error: 'الصورة مستخدمة ولا يمكن حذفها', usedBy: [...used] });
      fs.unlinkSync(f); audit(who, 'media_delete', `حذف صورة ${name}`, { ip: ip(req) });
      return send(res, 200, { ok: true });
    }
    if (p === '/api/admin/audit' && m === 'GET') {
      if (!can(who, 'audit')) return forbid(res);
      return send(res, 200, { entries: readAudit(Number(url.searchParams.get('limit')) || 200) });
    }
    if (p === '/api/admin/stats' && m === 'GET') {
      if (!can(who, 'stats')) return forbid(res);
      return send(res, 200, { demo: true, stats: loadStats() });
    }
    if (p === '/api/admin/stats' && m === 'DELETE') {
      if (!can(who, 'publish')) return forbid(res);
      stats = freshStats(); saveStatsSoon(); audit(who, 'stats_reset', 'تصفير إحصائيات المحاكاة', { ip: ip(req) });
      return send(res, 200, { ok: true });
    }
    return send(res, 404, { error: 'غير موجود' });
  }

  // --- لوحة التحكم (ملفات ثابتة) ---
  if (p === '/' ) { res.writeHead(302, { Location: '/admin/' }); return res.end(); }
  if (p === '/admin') { res.writeHead(302, { Location: '/admin/' }); return res.end(); }
  if (p.startsWith('/admin/')) {
    const rel = p.slice('/admin/'.length) || 'index.html';
    const f = within(path.join(PUBLIC_DIR, 'admin'), rel);
    if (!f) return send(res, 400, { error: 'مسار غير صالح' });
    return serveFile(req, res, f, { 'Cache-Control': 'no-cache', 'X-Frame-Options': 'DENY' });
  }
  return send(res, 404, { error: 'غير موجود' });
}

function createServer() {
  ensureData();
  return http.createServer((req, res) => {
    handle(req, res).catch((e) => {
      const status = e.status || 500;
      if (status === 500) console.error(e);
      if (!res.headersSent) send(res, status, { error: status === 500 ? 'خطأ في الخادم' : e.message });
    });
  });
}

if (require.main === module) {
  createServer().listen(PORT, () => {
    console.log(`Hadiyah catalog server on http://localhost:${PORT}  (لوحة التحكم: /admin/)`);
    console.log(`DATA_DIR = ${DATA_DIR}`);
    if (generatedPassword) console.log(`ADMIN_PASSWORD غير مضبوط — كلمة مرور مؤقتة لهذه الجلسة: ${ADMIN_PASSWORD}`);
  });
}
module.exports = { createServer, ADMIN_PASSWORD: () => ADMIN_PASSWORD, diffSummary };
