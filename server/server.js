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
  manager: new Set(['read', 'edit', 'upload', 'publish', 'settings', 'media_delete', 'audit', 'stats', 'devices']),
  super: new Set(['read', 'edit', 'upload', 'publish', 'settings', 'media_delete', 'audit', 'stats', 'devices']),
};
// مفتاح التوقيع: من المتغير أو من ملف دائم، كي لا تسقط جلسات الكيوسكات عند إعادة تشغيل الخادم.
function loadSecret() {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  const f = path.join(DATA_DIR, 'secret.key');
  try { const v = fs.readFileSync(f, 'utf8').trim(); if (v.length >= 32) return v; } catch { /* يُنشأ أدناه */ }
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const v = crypto.randomBytes(32).toString('hex');
  fs.writeFileSync(f, v, { mode: 0o600 });
  return v;
}
const SECRET = loadSecret();
/** كلمة مرور ضعيفة: أقل من 8 خانات أو رقمية فقط أو شائعة. */
const weakPassword = (v) => String(v).length < 8 || /^\d+$/.test(String(v)) || ['password', 'admin123', 'qwerty123'].includes(String(v).toLowerCase());
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
  const strip = (o) => JSON.stringify({ ...o, updatedAt: 0, release: 0 });
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
// تنظيف دوري لخرائط تحديد المعدل كي لا تنمو بلا حد
setInterval(() => {
  const now = Date.now();
  for (const m of [failures, actFail, evBucket]) for (const [k, v] of m) if ((v.until || v.reset || 0) < now) m.delete(k);
}, 5 * 60_000).unref();
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
// ترويسات أمان عامة. الصفحات الثابتة للوحة تضيف CSP صارمة.
const SEC_HEADERS = { 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()', 'Cross-Origin-Opener-Policy': 'same-origin' };
const ADMIN_CSP = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'";
function send(res, code, body, headers = {}) {
  const isBuf = Buffer.isBuffer(body);
  const data = isBuf ? body : typeof body === 'string' ? body : JSON.stringify(body);
  res.writeHead(code, {
    'Content-Type': isBuf || typeof body === 'string' ? 'text/plain; charset=utf-8' : 'application/json; charset=utf-8',
    ...SEC_HEADERS,
    ...(headers['Access-Control-Allow-Origin'] ? {} : { 'Cache-Control': 'no-store' }),
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
    res.writeHead(200, { 'Content-Type': type, 'Content-Length': st.size, ...SEC_HEADERS, ...extra });
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
const AUDIT_MAX_BYTES = 5 * 1024 * 1024;
/** سجل التدقيق: من (الدور) · ماذا · متى · النتيجة (ok / failed / denied). لا تُكتب فيه أسرار. */
function audit(who, action, summary, extra = {}) {
  try {
    try { if (fs.statSync(AUDIT).size > AUDIT_MAX_BYTES) fs.renameSync(AUDIT, AUDIT + '.1'); } catch { /* لا ملف بعد */ }
    const line = JSON.stringify({ at: new Date().toISOString(), role: who && who.role || '-', ip: extra.ip || '', action, result: extra.result || 'ok', summary: String(summary || '').slice(0, 400) });
    fs.appendFileSync(AUDIT, line + '\n');
  } catch (e) { console.error('audit failed', e.message); }
}
function readAudit(limit = 200) {
  const read = (f) => (fs.existsSync(f) ? fs.readFileSync(f, 'utf8').split('\n').filter(Boolean) : []);
  const lines = [...read(AUDIT + '.1'), ...read(AUDIT)].slice(-limit).reverse();
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
/** أبعاد الصورة من ترويستها (jpg/png/webp) دون مكتبات. */
function imageSize(buf) {
  try {
    if (buf[0] === 0x89 && buf[1] === 0x50) return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
    if (buf[0] === 0xff && buf[1] === 0xd8) {
      let i = 2;
      while (i < buf.length - 9) {
        if (buf[i] !== 0xff) { i++; continue; }
        const mk = buf[i + 1];
        if (mk >= 0xc0 && mk <= 0xcf && mk !== 0xc4 && mk !== 0xc8 && mk !== 0xcc) return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
        i += 2 + buf.readUInt16BE(i + 2);
      }
    }
    if (buf.subarray(0, 4).toString() === 'RIFF' && buf.subarray(8, 12).toString() === 'WEBP') {
      const k = buf.subarray(12, 16).toString();
      if (k === 'VP8 ') return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
      if (k === 'VP8L') { const b = buf.readUInt32LE(21); return { width: (b & 0x3fff) + 1, height: ((b >> 14) & 0x3fff) + 1 }; }
      if (k === 'VP8X') return { width: 1 + buf.readUIntLE(24, 3), height: 1 + buf.readUIntLE(27, 3) };
    }
  } catch { /* ملف تالف */ }
  return null;
}
const dimCache = new Map();
function dimsOf(file, st) {
  const key = file + ':' + st.mtimeMs;
  if (dimCache.has(key)) return dimCache.get(key);
  let d = null;
  try { const fd = fs.openSync(file, 'r'); const b = Buffer.alloc(262144); const n = fs.readSync(fd, b, 0, b.length, 0); fs.closeSync(fd); d = imageSize(b.subarray(0, n)); } catch { /* */ }
  dimCache.set(key, d); return d;
}
function listMedia() {
  const use = mediaUsage();
  return fs.readdirSync(UPLOADS_DIR).filter((f) => /\.(jpe?g|png|webp)$/i.test(f)).map((f) => {
    const st = fs.statSync(path.join(UPLOADS_DIR, f));
    const dm = dimsOf(path.join(UPLOADS_DIR, f), st) || {};
    return { name: f, url: `/uploads/${f}`, size: st.size, at: st.mtime.toISOString(), type: path.extname(f).slice(1).toLowerCase().replace('jpeg', 'jpg'), width: dm.width || 0, height: dm.height || 0, usedBy: [...(use.get(`/uploads/${f}`) || [])] };
  }).sort((x, y) => y.at.localeCompare(x.at));
}

// ---------- إحصائيات المحاكاة (تجريبية — بلا بيانات شخصية) ----------
let stats = null;
function freshStats() { return { since: new Date().toISOString(), sessions: 0, started: 0, completed: 0, abandoned: 0, durationSum: 0, programs: {}, amounts: {}, devices: {}, daily: {}, byDay: {} }; }
function loadStats() { if (stats) return stats; try { stats = readJson(STATS); } catch { stats = freshStats(); } return stats; }
let statsTimer = null;
function saveStatsSoon() { if (statsTimer) return; statsTimer = setTimeout(() => { statsTimer = null; try { writeJsonAtomic(STATS, stats); } catch (e) { console.error(e.message); } }, 5000); statsTimer.unref && statsTimer.unref(); }
function touchDevice(id, version, lang) {
  if (!id) return;
  const S = loadStats(); const key = String(id).replace(/[^\w-]/g, '').slice(0, 24); if (!key) return;
  if (!S.devices[key] && Object.keys(S.devices).length >= 50) return;
  const prev = S.devices[key] || {};
  S.devices[key] = { lastSeen: new Date().toISOString(), version: String(version || prev.version || '').slice(0, 16), lang: String(lang || prev.lang || '').slice(0, 4) };
  saveStatsSoon();
}
const EVENT_TYPES = new Set(['session_start', 'catalog_opened', 'program_selected', 'amount_chosen', 'payment_started', 'payment_completed', 'session_abandoned', 'heartbeat']);
// اليوم بتوقيت المحلي للجمعية (الافتراضي السعودية UTC+3) كي تُحسب «اليوم» صحيحاً
const TZ_HOURS = Number(process.env.TZ_OFFSET_HOURS ?? 3);
const dayKey = (t = Date.now()) => new Date(t + TZ_HOURS * 3_600_000).toISOString().slice(0, 10);
const cleanId = (v, n = 40) => (typeof v === 'string' ? v.replace(/[^\w-]/g, '').slice(0, n) : '');
const newScope = () => ({ sessions: 0, completed: 0, abandoned: 0, amount: 0, durationSum: 0, selected: 0, amountChosen: 0, started: 0, programs: {}, catalogs: {} });
/** يطبّق حدثاً على نطاق (يوم كامل أو جهاز داخل يوم). المبالغ تجريبية. */
function applyEvent(sc, type, pid, cid, amount, durationMs) {
  const prog = () => pid && (sc.programs[pid] || (Object.keys(sc.programs).length < 200 ? (sc.programs[pid] = { selected: 0, completed: 0, amount: 0 }) : null));
  const cat = () => cid && (sc.catalogs[cid] || (Object.keys(sc.catalogs).length < 100 ? (sc.catalogs[cid] = { visits: 0, completed: 0, amount: 0 }) : null));
  if (type === 'session_start') sc.sessions++;
  else if (type === 'session_abandoned') sc.abandoned++;
  else if (type === 'catalog_opened') { const c = cat(); if (c) c.visits++; }
  else if (type === 'program_selected') { sc.selected++; const q = prog(); if (q) q.selected++; }
  else if (type === 'amount_chosen') sc.amountChosen++;
  else if (type === 'payment_started') sc.started++;
  else if (type === 'payment_completed') {
    sc.completed++; sc.amount += amount;
    if (durationMs > 0 && durationMs < 3_600_000) sc.durationSum += durationMs;
    const q = prog(); if (q) { q.completed++; q.amount += amount; }
    const c = cat(); if (c) { c.completed++; c.amount += amount; }
  }
}
function recordEvent(e) {
  if (!e || !EVENT_TYPES.has(e.type)) return false;
  if (e.mode === 'production') return false; // لا مسار إنتاج فعلي بعد: لا تُخلط الأحداث
  const S = loadStats(); const day = dayKey();
  const D = S.daily[day] || (S.daily[day] = { sessions: 0, completed: 0 });
  const pid = cleanId(e.programId), cid = cleanId(e.catalogId), did = cleanId(e.deviceId, 24);
  const amount = (() => { const a = Math.round(Number(e.amount)); return a >= 1 && a <= 1e12 ? a : 0; })();
  const dur = Number(e.durationMs) || 0;
  // الإجماليات القديمة (متوافقة مع نظرة عامة)
  const P = pid && (S.programs[pid] || (Object.keys(S.programs).length < 200 ? (S.programs[pid] = { selected: 0, completed: 0 }) : null));
  switch (e.type) {
    case 'session_start': S.sessions++; D.sessions++; break;
    case 'program_selected': if (P) P.selected++; break;
    case 'amount_chosen': if (amount) { const k = String(amount); if (S.amounts[k] || Object.keys(S.amounts).length < 300) S.amounts[k] = (S.amounts[k] || 0) + 1; } break;
    case 'payment_started': S.started++; break;
    case 'payment_completed': S.completed++; D.completed++; if (P) P.completed++; if (dur > 0 && dur < 3_600_000) S.durationSum += dur; break;
    case 'session_abandoned': S.abandoned++; break;
    default: break;
  }
  // تفصيل يومي: الإجمالي + لكل جهاز (للوحة المؤشرات)
  if (e.type !== 'heartbeat') {
    S.byDay = S.byDay || {};
    const B = S.byDay[day] || (S.byDay[day] = { ...newScope(), devices: {} });
    applyEvent(B, e.type, pid, cid, amount, dur);
    if (did && (B.devices[did] || Object.keys(B.devices).length < 50)) applyEvent(B.devices[did] || (B.devices[did] = newScope()), e.type, pid, cid, amount, dur);
    const days = Object.keys(S.byDay).sort(); for (const d of days.slice(0, Math.max(0, days.length - 120))) delete S.byDay[d];
  }
  const days = Object.keys(S.daily).sort(); for (const d of days.slice(0, Math.max(0, days.length - 60))) delete S.daily[d];
  touchDevice(e.deviceId, e.appVersion, e.lang);
  saveStatsSoon();
  return true;
}
/** يجمع أيام النطاق إلى نطاق واحد: عام + لكل جهاز، مع السلسلة اليومية. */
function buildDashboard(range, mode = 'simulation') {
  if (mode === 'production') return { mode: 'production', demo: false, available: false, reason: 'لا يوجد نظام دفع فعلي مربوط بعد، فلا توجد تبرعات حقيقية لعرضها. ستظهر هنا بعد ربط بوابة دفع واعتمادها.' };
  const S = loadStats(); const byDay = S.byDay || {};
  const today = dayKey();
  const n = range === 'today' ? 1 : range === '7' ? 7 : range === '30' ? 30 : 0;
  const dayAt = (offset) => dayKey(Date.now() - offset * 86_400_000);
  const inRange = (from, to) => Object.keys(byDay).filter((d) => d >= from && d <= to).sort();
  const days = n ? inRange(dayAt(n - 1), today) : inRange('', today);
  const total = () => ({ ...newScope(), byDay: [] });
  const SUM = ['sessions', 'completed', 'abandoned', 'amount', 'durationSum', 'selected', 'amountChosen', 'started'];
  const add = (into, sc) => {
    for (const k of SUM) into[k] += sc[k] || 0;
    for (const [id, v] of Object.entries(sc.programs || {})) { const t = into.programs[id] || (into.programs[id] = { selected: 0, completed: 0, amount: 0 }); t.selected += v.selected; t.completed += v.completed; t.amount += v.amount; }
    for (const [id, v] of Object.entries(sc.catalogs || {})) { const t = into.catalogs[id] || (into.catalogs[id] = { visits: 0, completed: 0, amount: 0 }); t.visits += v.visits; t.completed += v.completed; t.amount += v.amount; }
  };
  const collect = (list) => { const all = total(); const devs = {}; for (const d of list) { const B = byDay[d]; add(all, B); for (const [did, sc] of Object.entries(B.devices || {})) add(devs[did] || (devs[did] = total()), sc); } return { all, devs }; };
  const cur = collect(days);
  const { all, devs } = cur;
  // الفترة السابقة المماثلة للمقارنة (غير متاحة لـ «الكل»)
  let prev = null; let prevDevs = {};
  if (n) { const pd = inRange(dayAt(2 * n - 1), dayAt(n)); const pc = collect(pd); prev = { sessions: pc.all.sessions, completed: pc.all.completed, abandoned: pc.all.abandoned, amount: pc.all.amount, hasData: pd.length > 0 }; prevDevs = pc.devs; }
  const series = n ? Array.from({ length: n }, (_, i) => dayAt(n - 1 - i)) : days;
  for (const d of series) {
    const B = byDay[d];
    all.byDay.push({ date: d, sessions: B ? B.sessions : 0, completed: B ? B.completed : 0, amount: B ? B.amount : 0 });
    for (const [did, t] of Object.entries(devs)) { const sc = B && B.devices && B.devices[did]; t.byDay.push({ date: d, sessions: sc ? sc.sessions : 0, completed: sc ? sc.completed : 0, amount: sc ? sc.amount : 0 }); }
  }
  const sortProg = (o) => Object.entries(o.programs).map(([id, v]) => ({ id, ...v })).sort((a, b) => b.completed - a.completed || b.selected - a.selected);
  const sortCat = (o) => Object.entries(o.catalogs).map(([id, v]) => ({ id, ...v })).sort((a, b) => b.completed - a.completed || b.visits - a.visits);
  const fin = (o) => ({ sessions: o.sessions, completed: o.completed, abandoned: o.abandoned, amount: o.amount, selected: o.selected, amountChosen: o.amountChosen, started: o.started, avgDurationSec: o.completed ? Math.round(o.durationSum / o.completed / 1000) : 0, programs: sortProg(o), catalogs: sortCat(o), byDay: o.byDay });
  const meta = new Map(knownDevices().map((d) => [d.deviceId, d]));
  const devices = Object.entries(devs).map(([deviceId, t]) => { const pv = prevDevs[deviceId]; return { deviceId, name: (meta.get(deviceId) || {}).name || deviceId, label: (meta.get(deviceId) || {}).label || '', status: (meta.get(deviceId) || {}).status || 'unknown', lastSeen: (meta.get(deviceId) || {}).lastSeen || '', ...fin(t), prev: n && pv ? { sessions: pv.sessions, completed: pv.completed, amount: pv.amount } : (n ? { sessions: 0, completed: 0, amount: 0 } : null) }; });
  for (const [deviceId, d] of meta) if (!devs[deviceId]) devices.push({ deviceId, name: d.name || deviceId, label: d.label || '', status: d.status, lastSeen: d.lastSeen, ...fin(total()), prev: null });
  devices.sort((a, b) => b.completed - a.completed || String(a.name).localeCompare(String(b.name), 'ar'));
  return { mode: 'simulation', demo: true, available: true, range: n ? range : 'all', since: S.since, days: days.length, prev, ...fin(all), devices };
}
const evBucket = new Map(); // ip -> {n, reset}
function eventAllowed(who) {
  const now = Date.now(); const b = evBucket.get(who);
  if (!b || b.reset < now) { evBucket.set(who, { n: 1, reset: now + 60_000 }); return true; }
  return ++b.n <= 300;
}

// ---------- جلسات الكيوسكات (تفعيل كل جهاز بمعرف جلسة) ----------
// pending = معرف جلسة أُنشئ من اللوحة وينتظر الإدخال في الكيوسك · active = كيوسك مفعّل · ended = جلسة منتهية
const DEVICES = path.join(DATA_DIR, 'devices.json');
const CODE_TTL_MS = 24 * 60 * 60 * 1000;
let sessionDb = null;
function sessions() {
  if (!sessionDb) { try { sessionDb = readJson(DEVICES); } catch { sessionDb = { sessions: [] }; } if (!Array.isArray(sessionDb.sessions)) sessionDb.sessions = []; }
  return sessionDb.sessions;
}
let sessionTimer = null;
function saveSessionsSoon(now) {
  if (now) { clearTimeout(sessionTimer); sessionTimer = null; try { writeJsonAtomic(DEVICES, sessionDb); } catch (e) { console.error(e.message); } return; }
  if (sessionTimer) return;
  sessionTimer = setTimeout(() => { sessionTimer = null; try { writeJsonAtomic(DEVICES, sessionDb); } catch (e) { console.error(e.message); } }, 5000);
  sessionTimer.unref && sessionTimer.unref();
}
const cleanText = (v, n) => String(v ?? '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, n);
function newCode() {
  const used = new Set(sessions().filter((x) => x.status === 'pending').map((x) => x.code));
  for (let i = 0; i < 20; i++) { const c = String(crypto.randomInt(0, 1e8)).padStart(8, '0'); if (!used.has(c)) return c; }
  throw Object.assign(new Error('تعذّر توليد معرف'), { status: 500 });
}
function createSession(label) {
  const now = Date.now();
  const s = { id: 'ss_' + crypto.randomBytes(4).toString('hex'), code: newCode(), label: cleanText(label, 60), kioskName: '', status: 'pending',
    createdAt: new Date(now).toISOString(), codeExpiresAt: new Date(now + CODE_TTL_MS).toISOString(), activatedAt: null, endedAt: null,
    deviceId: '', lastSeen: '', version: '', started: 0, completed: 0, contentRelease: 0, contentSyncedAt: '', log: [] };
  sessionLog(s, 'created', label ? 'المكان: ' + s.label : '');
  sessions().unshift(s); saveSessionsSoon(true); return s;
}
const OFFLINE_MS = Number(process.env.OFFLINE_MINUTES || 5) * 60_000;
function sessionLog(s, type, detail = '') {
  (s.log || (s.log = [])).unshift({ at: new Date().toISOString(), type, detail: String(detail).slice(0, 120) });
  if (s.log.length > 40) s.log.length = 40;
}
const deviceToken = (sid) => sign({ exp: 4102444800000, role: 'device', sid });
/** يفحص رمز الكيوسك: null = بلا رمز · {ended:true} = رمز غير صالح/جلسة منتهية · {session} = فعّال */
function deviceFromReq(req, tokenIn) {
  const raw = tokenIn !== undefined ? tokenIn : req.headers['x-kiosk-token'];
  if (!raw) return null;
  const t = verifyToken(raw);
  if (!t || t.role !== 'device' || !t.sid) return { ended: true };
  const s = sessions().find((x) => x.id === t.sid);
  return s && s.status === 'active' ? { session: s } : { ended: true };
}
function touchSession(s, version) {
  s.lastSeen = new Date().toISOString();
  if (version && String(version).slice(0, 16) !== s.version) { if (s.version) sessionLog(s, 'version', `إصدار التطبيق ${s.version} ← ${String(version).slice(0, 16)}`); s.version = String(version).slice(0, 16); }
  saveSessionsSoon();
}
/** يسجّل أن الجهاز جلب الإصدار المنشور (أي «استلمه»). */
function noteSync(s, release) {
  s.contentCheckedAt = new Date().toISOString();
  if (s.contentRelease !== release) { sessionLog(s, 'sync', release ? `استلم المحتوى — الإصدار ${release}` : 'استلم المحتوى (قبل ترقيم الإصدارات)'); s.contentRelease = release; s.contentSyncedAt = s.contentCheckedAt; }
}
const actFail = new Map(); // ip -> {n, until}
function activationLimited(ip2) { const f = actFail.get(ip2); return f && f.n >= 10 && f.until > Date.now(); }
function noteActFailure(ip2) { const f = actFail.get(ip2); if (!f || f.until < Date.now()) actFail.set(ip2, { n: 1, until: Date.now() + 60_000 }); else f.n++; }

// ---------- ظهور البرامج حسب الجهاز ----------
/** نسخة من الكتالوج مناسبة لجهاز معيّن: العناصر المحدّدة لأجهزة أخرى تُحذف مع كل مراجعها.
 *  بلا جهاز معروف (deviceId فارغ) يرى العناصر المفتوحة للكل فقط. */
function filterForDevice(cat, deviceId) {
  const ok = (o) => !o.archived && (!o.kiosks || !o.kiosks.length || (deviceId && o.kiosks.includes(deviceId)));
  const strip = (o) => { const rest = { ...o }; delete rest.kiosks; return rest; };
  const programs = (cat.programs || []).filter(ok);
  const progIds = new Set(programs.map((p) => p.id));
  const catalogs = [];
  for (const c of (cat.catalogs || []).filter(ok)) {
    const items = (c.items || []).filter((i) => progIds.has(i.programId));
    if ((c.items || []).length && !items.length) continue; // كتالوج صار فارغاً بسبب التصفية
    catalogs.push({ ...strip(c), items });
  }
  const catIds = new Set(catalogs.map((c) => c.id));
  const has = (t, id) => (t === 'catalog' ? catIds : progIds).has(id);
  const home = (cat.home || []).filter((h) => has(h.type, h.id));
  const featured = cat.featured ? { ...cat.featured, items: (cat.featured.items || []).filter((x) => has(x.type, x.id)) } : cat.featured;
  return { ...cat, programs: programs.map(strip), catalogs, home, featured };
}
const anyRestricted = (cat) => [...(cat.programs || []), ...(cat.catalogs || [])].some((o) => o.archived || (o.kiosks && o.kiosks.length));
/** الأجهزة المعروفة (آخر جلسة لكل deviceId) لاختيارها عند تحديد ظهور برنامج. */
function knownDevices() {
  const by = new Map();
  for (const s of sessions()) {
    if (!s.deviceId) continue;
    const prev = by.get(s.deviceId);
    const stamp = s.activatedAt || s.createdAt;
    if (!prev || stamp > prev.stamp) by.set(s.deviceId, { deviceId: s.deviceId, name: s.kioskName, label: s.label, status: s.status, sessionId: s.id, lastSeen: s.lastSeen, version: s.version, contentRelease: s.contentRelease || 0, contentSyncedAt: s.contentSyncedAt || '', activatedAt: s.activatedAt, stamp });
    else if (s.status === 'active' && prev.status !== 'active') prev.status = 'active';
  }
  const list = [...by.values()].map((d) => { const o = { ...d }; delete o.stamp; return o; });
  const now = Date.now(); const rel = liveRelease();
  const relAt = (readReleases()[0] || {}).at;
  const versions = list.filter((d) => d.status === 'active' && d.version).map((d) => d.version);
  const newest = versions.sort((a, b2) => a.localeCompare(b2, undefined, { numeric: true })).pop() || '';
  for (const d of list) {
    d.online = d.status === 'active' && !!d.lastSeen && now - Date.parse(d.lastSeen) < OFFLINE_MS;
    d.behind = d.status === 'active' && d.online && rel > 0 && d.contentRelease !== rel && relAt && now - Date.parse(relAt) > 3 * 60_000;
    d.alerts = [];
    if (d.status === 'active' && !d.online) d.alerts.push({ id: `offline:${d.deviceId}`, severity: 'error', kind: 'offline', title: `الجهاز «${d.name}» غير متصل`, detail: d.lastSeen ? `آخر اتصال ${d.lastSeen}` : 'لم يتصل بعد التفعيل', target: { type: 'device', id: d.deviceId } });
    if (d.behind) d.alerts.push({ id: `behind:${d.deviceId}`, severity: 'warn', kind: 'behind', title: `الجهاز «${d.name}» لم يستلم آخر إصدار`, detail: `لديه الإصدار ${d.contentRelease || 'القديم'} والمنشور ${rel}`, target: { type: 'device', id: d.deviceId } });
    if (d.status === 'active' && newest && d.version && d.version !== newest) d.alerts.push({ id: `appver:${d.deviceId}`, severity: 'info', kind: 'old_app', title: `الجهاز «${d.name}» بإصدار تطبيق أقدم (${d.version})`, detail: `الأحدث على الأجهزة ${newest}`, target: { type: 'device', id: d.deviceId } });
  }
  return list.sort((a, b2) => String(a.name).localeCompare(String(b2.name), 'ar'));
}

// ---------- الإصدارات (Releases) ----------
const RELEASES = path.join(DATA_DIR, 'releases.json');
const readReleases = () => { try { const a = readJson(RELEASES); return Array.isArray(a) ? a : []; } catch { return []; } };
const liveRelease = () => { try { return Number(readJson(LIVE).release) || 0; } catch { return 0; } };
const uploadExists = (url) => { const m = /^\/uploads\/([\w.\-]+)$/.exec(url || ''); return !!m && fs.existsSync(path.join(UPLOADS_DIR, m[1])); };

/** فحص ما قبل النشر على المسودة الحالية: أخطاء مانعة + تنبيهات + ملخص التغييرات. */
function preflight() {
  const draft = readJson(DRAFT); const live = readJson(LIVE);
  const { catalog, errors, warnings } = normalize(draft);
  const checks = []; const add = (id, status, title, items = [], detail = '') => checks.push({ id, status, title, detail, items });
  const act = (list) => list.filter((o) => o.active && !o.archived);
  const lab = (kind, o) => ({ type: kind, id: o.id, label: nameOf(o) });
  const progs = act(catalog.programs), cats = act(catalog.catalogs);
  add('structure', errors.length ? 'error' : 'ok', 'سلامة البيانات', errors.map((e) => ({ label: e })));
  const missingImg = [...progs.map((o) => ['program', o]), ...cats.map((o) => ['catalog', o])].filter(([, o]) => o.image && o.image.startsWith('/uploads/') && !uploadExists(o.image)).map(([k, o]) => lab(k, o));
  add('images_missing', missingImg.length ? 'error' : 'ok', 'ملفات الصور موجودة', missingImg, 'صور مرتبطة بملفات غير موجودة على الخادم.');
  const noImg = [...progs.map((o) => ['program', o]), ...cats.map((o) => ['catalog', o])].filter(([, o]) => !o.image).map(([k, o]) => lab(k, o));
  add('images_none', noImg.length ? 'warn' : 'ok', 'كل عنصر نشط له صورة', noImg);
  const needTr = [...progs.map((o) => ['program', o]), ...cats.map((o) => ['catalog', o])].filter(([, o]) => ['fr', 'en', 'ur'].some((l) => !(o.title[l] || '').trim())).map(([k, o]) => ({ ...lab(k, o), label: `${nameOf(o)} — ينقص: ${['fr', 'en', 'ur'].filter((l) => !(o.title[l] || '').trim()).map((l) => ({ fr: 'Français', en: 'English', ur: 'اردو' }[l])).join('، ')}` }));
  add('translations', needTr.length ? 'warn' : 'ok', 'الترجمات مكتملة', needTr, 'العنصر الناقص ترجمته يظهر بالعربية في اللغات الأخرى.');
  const placed = (kind, id) => (catalog.home || []).some((h) => h.type === kind && h.id === id) || (kind === 'program' ? catalog.catalogs.some((c) => c.active && !c.archived && c.items.some((i) => i.programId === id)) : false) || (catalog.featured.items || []).some((x) => x.type === kind && x.id === id);
  const orphans = [...progs.map((o) => ['program', o]), ...cats.map((o) => ['catalog', o])].filter(([k, o]) => !placed(k, o.id)).map(([k, o]) => lab(k, o));
  add('placement', orphans.length ? 'warn' : 'ok', 'كل عنصر نشط موضوع في مكان ظاهر', orphans, 'عنصر مفعّل لكنه غير موضوع في الرئيسية أو كتالوج.');
  const emptyCats = cats.filter((c) => !c.items.some((i) => progs.some((p) => p.id === i.programId))).map((o) => lab('catalog', o));
  add('empty_catalogs', emptyCats.length ? 'warn' : 'ok', 'لا كتالوج فارغ', emptyCats);
  const archivedUsed = [...catalog.programs.filter((p) => p.archived).filter((p) => (catalog.home || []).some((h) => h.type === 'program' && h.id === p.id)).map((p) => lab('program', p))];
  add('archived_refs', archivedUsed.length ? 'warn' : 'ok', 'لا عناصر مؤرشفة في الصفحة الرئيسية', archivedUsed, 'العنصر المؤرشف لا يظهر للمتبرعين رغم وجوده في الرئيسية.');
  const known = new Set(knownDevices().map((d) => d.deviceId));
  const unknownDev = [...catalog.programs.map((o) => ['program', o]), ...catalog.catalogs.map((o) => ['catalog', o])].filter(([, o]) => (o.kiosks || []).some((id) => !known.has(id))).map(([k, o]) => lab(k, o));
  add('devices_unknown', unknownDev.length ? 'warn' : 'ok', 'التقييد بالأجهزة يشير لأجهزة معروفة', unknownDev);
  if (catalog.featured && catalog.featured.enabled && !(catalog.featured.items || []).length) add('featured_empty', 'warn', 'شريط «الأكثر رواجاً» المفعّل له عناصر', []);
  const changes = diffSummary(live, catalog);
  const online = knownDevices().filter((d) => d.online).length;
  const blocking = errors.length > 0 || checks.some((c) => c.status === 'error');
  return { ok: !blocking, errors, warnings, checks, changes, hasChanges: !sameContent(catalog, live), nextRelease: (Number(live.release) || 0) + 1, currentRelease: Number(live.release) || 0, devicesOnline: online, devicesTotal: knownDevices().length };
}

/** مركز التشغيل: الأجهزة + حالة المزامنة + التنبيهات (حقيقية فقط، من بيانات الخادم). */
function buildOps() {
  const devices = knownDevices(); const active = devices.filter((d) => d.status === 'active');
  const rel = liveRelease(); const releases = readReleases();
  const alerts = devices.flatMap((d) => d.alerts);
  // صور مفقودة (مرتبطة بملف غير موجود)
  const refs = new Map();
  for (const [file, tag] of [[DRAFT, 'المسودة'], [LIVE, 'المنشور']]) {
    let c; try { c = readJson(file); } catch { continue; }
    const add = (u, d) => { if (u && u.startsWith('/uploads/')) { (refs.get(u) || refs.set(u, new Set()).get(u)).add(`${tag}: ${d}`); } };
    for (const p of c.programs || []) { add(p.image, `برنامج «${nameOf(p)}»`); add(p.popupImage, `نافذة «${nameOf(p)}»`); }
    for (const k of c.catalogs || []) add(k.image, `كتالوج «${nameOf(k)}»`);
    if (c.settings) add(c.settings.welcomeBackground, 'خلفية الترحيب');
  }
  const missing = [...refs].filter(([u]) => !uploadExists(u)).map(([u, set]) => ({ url: u, usedBy: [...set] }));
  for (const mm of missing) alerts.push({ id: `media:${mm.url}`, severity: 'error', kind: 'media_missing', title: `ملف صورة مفقود: ${path.basename(mm.url)}`, detail: mm.usedBy.slice(0, 2).join(' · '), target: { type: 'media', id: mm.url } });
  // فشل نشر بعد آخر نشر ناجح
  const lastOk = (releases[0] || {}).at || '';
  const failedPub = readAudit(100).find((e) => e.action === 'publish_failed' && e.at > lastOk && Date.now() - Date.parse(e.at) < 24 * 3_600_000);
  if (failedPub) alerts.push({ id: 'publish_failed', severity: 'error', kind: 'publish_failed', title: 'فشلت آخر محاولة نشر', detail: failedPub.summary, target: { type: 'publish', id: '' } });
  const order = { error: 0, warn: 1, info: 2 };
  alerts.sort((a, b) => order[a.severity] - order[b.severity]);
  const summary = { total: active.length, online: active.filter((d) => d.online).length, offline: active.filter((d) => !d.online).length, behind: active.filter((d) => d.behind).length, attention: active.filter((d) => d.alerts.length).length, upToDate: active.filter((d) => rel > 0 && d.contentRelease === rel).length };
  return { now: new Date().toISOString(), liveRelease: rel, livePublishedAt: (releases[0] || {}).at || '', lastPublish: releases[0] || null, devices, summary, alerts, missingMedia: missing, offlineMinutes: OFFLINE_MS / 60000 };
}

// ---------- المسارات ----------
function auth(req) {
  const h = req.headers.authorization || '';
  const t = h.startsWith('Bearer ') && verifyToken(h.slice(7));
  if (!t || t.role === 'device') return null;   // رمز الكيوسك لا يمنح صلاحيات الإدارة
  return { role: ROLE_CAN[t.role] ? t.role : 'viewer', exp: t.exp };
}
const can = (who, perm) => !!who && ROLE_CAN[who.role].has(perm);
const forbid = (res, who, req) => { if (who && req) audit(who, 'denied', `محاولة غير مصرّح بها: ${req.method} ${new URL(req.url, 'http://x').pathname}`, { ip: ip(req), result: 'denied' }); return send(res, 403, { error: 'ليست لديك صلاحية لهذا الإجراء' }); };
const ip = (req) => req.socket.remoteAddress || '?';

async function handle(req, res) {
  const url = new URL(req.url, 'http://x');
  const p = url.pathname;
  const m = req.method;

  if (m === 'OPTIONS') return send(res, 204, '', { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'If-None-Match, Content-Type, X-Kiosk-Device, X-Kiosk-Version, X-Kiosk-Token' });

  // --- عام (يقرؤه التطبيق) ---
  if (p === '/api/health') return send(res, 200, { ok: true });
  if (p === '/api/device/activate' && m === 'POST') {
    const who2 = ip(req); const cors = { 'Access-Control-Allow-Origin': '*' };
    if (activationLimited(who2)) return send(res, 429, { error: 'محاولات كثيرة، انتظر دقيقة', code: 'rate_limited' }, cors);
    const body = await readJsonBody(req, 2048);
    const code = String(body.code ?? '').replace(/\D/g, '');
    const name = cleanText(body.name, 40);
    if (code.length !== 8) return send(res, 400, { error: 'معرف الجلسة 8 أرقام', code: 'bad_code' }, cors);
    if (!name) return send(res, 400, { error: 'اكتب اسم الكيوسك', code: 'bad_name' }, cors);
    const s = sessions().find((x) => x.status === 'pending' && x.code === code);
    if (!s) { noteActFailure(who2); return send(res, 404, { error: 'معرف الجلسة غير صحيح أو مستخدم', code: 'invalid_code' }, cors); }
    if (Date.parse(s.codeExpiresAt) < Date.now()) { noteActFailure(who2); return send(res, 410, { error: 'انتهت صلاحية المعرف — أنشئ جلسة جديدة من اللوحة', code: 'expired' }, cors); }
    s.status = 'active'; s.kioskName = name; s.activatedAt = new Date().toISOString(); s.deviceId = cleanText(body.deviceId, 24);
    sessionLog(s, 'activated', `سُمّي «${name}»`); touchSession(s, body.appVersion); saveSessionsSoon(true);
    audit({ role: 'device' }, 'device_activate', `تفعيل كيوسك «${name}»${s.label ? ' — ' + s.label : ''}`, { ip: who2 });
    return send(res, 200, { sessionId: s.id, token: deviceToken(s.id), name, label: s.label }, cors);
  }
  if (p === '/api/device/deactivate' && m === 'POST') {
    const cors = { 'Access-Control-Allow-Origin': '*' };
    const d = deviceFromReq(req);
    if (d && d.session) { d.session.status = 'ended'; d.session.endedAt = new Date().toISOString(); sessionLog(d.session, 'ended', 'أنهيت من الكيوسك نفسه'); saveSessionsSoon(true); audit({ role: 'device' }, 'device_end', `إنهاء جلسة «${d.session.kioskName}» من الكيوسك نفسه`, { ip: ip(req) }); }
    return send(res, 200, { ok: true }, cors);
  }
  if (p === '/api/catalog' && (m === 'GET' || m === 'HEAD')) {
    const dev = deviceFromReq(req);
    if (dev && dev.ended) return send(res, 401, { error: 'انتهت جلسة هذا الكيوسك', code: 'session_ended' }, { 'Access-Control-Allow-Origin': '*' });
    if (dev && dev.session) { touchSession(dev.session, req.headers['x-kiosk-version']); noteSync(dev.session, liveRelease()); }
    if (req.headers['x-kiosk-device']) touchDevice(req.headers['x-kiosk-device'], req.headers['x-kiosk-version'], '');
    let body = fs.readFileSync(LIVE);
    {
      const full = JSON.parse(body.toString('utf8'));
      if (anyRestricted(full)) body = Buffer.from(JSON.stringify(filterForDevice(full, dev && dev.session ? dev.session.deviceId : ''), null, 2));
    }
    const etag = '"' + crypto.createHash('sha1').update(body).digest('hex') + '"';
    const cors = { 'Access-Control-Allow-Origin': '*', ETag: etag, 'Cache-Control': 'no-cache', 'Content-Type': 'application/json; charset=utf-8' };
    if (req.headers['if-none-match'] === etag) { res.writeHead(304, cors); return res.end(); }
    res.writeHead(200, cors);
    return res.end(m === 'HEAD' ? undefined : body);
  }
  if (p === '/api/events' && m === 'POST') {
    if (!eventAllowed(ip(req))) return send(res, 429, { error: 'كثير' }, { 'Access-Control-Allow-Origin': '*' });
    const body = await readJsonBody(req, 2048);
    const dev = deviceFromReq(req, body.token);
    if (dev && dev.ended) return send(res, 401, { error: 'انتهت جلسة هذا الكيوسك', code: 'session_ended' }, { 'Access-Control-Allow-Origin': '*' });
    if (dev && dev.session) {
      touchSession(dev.session, body.appVersion);
      if (body.type === 'session_start') dev.session.started++;
      if (body.type === 'payment_completed') dev.session.completed++;
      if (!body.deviceId) body.deviceId = dev.session.id;
    }
    if (body && body.mode === 'production') return send(res, 400, { error: 'الأحداث الفعلية غير مفعّلة (لا يوجد نظام دفع فعلي)', code: 'production_disabled' }, { 'Access-Control-Allow-Origin': '*' });
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
    if (!role) { noteFailure(who); audit(null, 'login_failed', 'محاولة دخول فاشلة', { ip: who, result: 'failed' }); return send(res, 401, { error: 'كلمة المرور غير صحيحة' }); }
    failures.delete(who);
    const exp = Date.now() + TOKEN_TTL_MS;
    audit({ role }, 'login', 'تسجيل دخول', { ip: who });
    return send(res, 200, { token: sign({ exp, role }), expiresAt: exp, role });
  }

  // --- الإدارة ---
  if (p.startsWith('/api/admin/')) {
    const who = auth(req);
    if (!who) return send(res, 401, { error: 'يلزم تسجيل الدخول' });
    if (p === '/api/admin/me') {
      const out = { role: who.role, can: [...ROLE_CAN[who.role]] };
      if (who.role === 'super') {
        const configured = ROLE_PASSWORDS.map(([n, g]) => [n, g()]).filter(([, v]) => v);
        out.security = { weakPasswordRoles: configured.filter(([, v]) => weakPassword(v)).map(([n]) => n), rolesConfigured: configured.map(([n]) => n), https: !!(req.socket.encrypted || req.headers['x-forwarded-proto'] === 'https'), generatedAdminPassword: generatedPassword, tokenHours: TOKEN_TTL_MS / 3_600_000, roleMatrix: Object.fromEntries(Object.entries(ROLE_CAN).map(([k, v]) => [k, [...v]])), offlineMinutes: OFFLINE_MS / 60000, codeValidityHours: CODE_TTL_MS / 3_600_000, auditMaxMB: AUDIT_MAX_BYTES / 1048576 };
      }
      return send(res, 200, out);
    }

    if (p === '/api/admin/catalog' && m === 'GET') {
      const draft = readJson(DRAFT), live = readJson(LIVE);
      return send(res, 200, { catalog: draft, hasUnpublished: !sameContent(draft, live), liveUpdatedAt: live.updatedAt, liveRelease: Number(live.release) || 0 });
    }
    if (p === '/api/admin/catalog' && m === 'PUT') {
      if (!can(who, 'edit')) return forbid(res, who, req);
      const body = await readJsonBody(req);
      const { catalog, errors, warnings } = normalize(body.catalog ?? body);
      if (errors.length) return send(res, 422, { error: 'بيانات غير صالحة', errors, warnings });
      const prevDraft = readJson(DRAFT);
      if (!can(who, 'settings') && JSON.stringify(normalize(prevDraft).catalog.settings) !== JSON.stringify(catalog.settings)) return send(res, 403, { error: 'تعديل الإعدادات العامة يتطلب صلاحية «مدير المحتوى»' });
      const changes = diffSummary(prevDraft, catalog);
      if (changes.length) audit(who, 'draft_save', changes.slice(0, 6).join('، ') + (changes.length > 6 ? ` (+${changes.length - 6})` : ''), { ip: ip(req) });
      writeJsonAtomic(DRAFT, catalog);
      return send(res, 200, { catalog, warnings, hasUnpublished: !sameContent(catalog, readJson(LIVE)) });
    }
    if (p === '/api/admin/preflight' && m === 'GET') return send(res, 200, preflight());
    if (p === '/api/admin/publish' && m === 'POST') {
      if (!can(who, 'publish')) return forbid(res, who, req);
      const draft = readJson(DRAFT);
      const { catalog, errors, warnings } = normalize(draft);
      if (errors.length) { audit(who, 'publish_failed', errors.slice(0, 3).join('، '), { ip: ip(req), result: 'failed' }); return send(res, 422, { error: 'لا يمكن النشر', errors, warnings }); }
      const blockers = preflight().checks.filter((c) => c.status === 'error' && c.id !== 'structure');
      if (blockers.length) {
        const errs = blockers.flatMap((c) => c.items.map((i) => `${c.title === 'ملفات الصور موجودة' ? 'ملف الصورة مفقود' : c.title}: ${i.label}`));
        audit(who, 'publish_failed', errs.slice(0, 3).join('، '), { ip: ip(req), result: 'failed' });
        return send(res, 422, { error: 'لا يمكن النشر', errors: errs, warnings });
      }
      const prevText = fs.readFileSync(LIVE, 'utf8'); const liveObj = JSON.parse(prevText);
      // الضغط المتكرر أو النشر بلا تغيير: لا إصدار جديد
      if (sameContent(catalog, liveObj)) return send(res, 200, { ok: true, unchanged: true, release: Number(liveObj.release) || 0, publishedAt: liveObj.updatedAt, warnings });
      const release = Math.max(Number(liveObj.release) || 0, ...readReleases().map((x) => x.version)) + 1;
      const changes = diffSummary(liveObj, catalog);
      const historyId = new Date().toISOString().replace(/[:.]/g, '-');
      const histFile = path.join(HISTORY_DIR, historyId + '.json');
      try {
        fs.writeFileSync(histFile, prevText);                  // 1) نسخة احتياطية من المنشور الحالي
        const next = { ...catalog, release };
        writeJsonAtomic(LIVE, next);                           // 2) المنشور الجديد (ذرّي: كامل أو لا شيء)
        const d2 = { ...next }; delete d2.release; writeJsonAtomic(DRAFT, d2); // 3) المسودة = المنشور
      } catch (e) {
        try { fs.unlinkSync(histFile); } catch { /* */ }
        audit(who, 'publish_failed', `خطأ كتابة: ${e.message}`, { ip: ip(req), result: 'failed' });
        throw Object.assign(new Error('تعذّر النشر — لم يتغير المنشور'), { status: 500 });
      }
      writeJsonAtomic(RELEASES, [{ version: release, at: new Date().toISOString(), role: who.role, historyId, changes: changes.slice(0, 40), changesCount: changes.length }, ...readReleases()].slice(0, 200));
      audit(who, 'publish', `الإصدار ${release}: ` + (changes.length ? changes.slice(0, 8).join('، ') : 'بلا تغييرات في المحتوى'), { ip: ip(req) });
      const files = fs.readdirSync(HISTORY_DIR).sort();
      for (const f of files.slice(0, Math.max(0, files.length - 30))) fs.unlinkSync(path.join(HISTORY_DIR, f));
      return send(res, 200, { ok: true, release, publishedAt: catalog.updatedAt, warnings });
    }
    if (p === '/api/admin/discard' && m === 'POST') {
      if (!can(who, 'edit')) return forbid(res, who, req);
      const live = readJson(LIVE); const d2 = { ...live }; delete d2.release;
      writeJsonAtomic(DRAFT, d2);
      audit(who, 'discard', 'تجاهل تعديلات المسودة غير المنشورة والعودة للمنشور', { ip: ip(req) });
      return send(res, 200, { catalog: d2 });
    }
    if (p === '/api/admin/releases' && m === 'GET') return send(res, 200, { release: liveRelease(), releases: readReleases().slice(0, 50) });
    if (p === '/api/admin/history' && m === 'GET') {
      const rel = readReleases();
      const list = fs.readdirSync(HISTORY_DIR).filter((f) => f.endsWith('.json')).sort().reverse().map((f) => {
        const id = f.replace(/\.json$/, ''); let release = 0;
        try { release = Number(readJson(path.join(HISTORY_DIR, f)).release) || 0; } catch { /* */ }
        const by = rel.find((x) => x.historyId === id);
        return { id, at: id.replace(/^(\d{4}-\d\d-\d\dT\d\d)-(\d\d)-(\d\d)-(\d+)Z$/, '$1:$2:$3.$4Z'), release, replacedBy: by ? { version: by.version, at: by.at, role: by.role, changesCount: by.changesCount } : null };
      });
      return send(res, 200, { history: list });
    }
    const hm = /^\/api\/admin\/history\/([\w\-]+)$/.exec(p);
    if (hm && m === 'GET') {
      const f = within(HISTORY_DIR, `${hm[1]}.json`);
      if (!f || !fs.existsSync(f)) return send(res, 404, { error: 'النسخة غير موجودة' });
      return send(res, 200, { id: hm[1], catalog: readJson(f) });
    }
    if (p === '/api/admin/restore' && m === 'POST') {
      if (!can(who, 'publish')) return forbid(res, who, req);
      const { id } = await readJsonBody(req, 4096);
      const f = within(HISTORY_DIR, `${id}.json`);
      if (!f || !fs.existsSync(f)) return send(res, 404, { error: 'النسخة غير موجودة' });
      const snap = readJson(f);
      const { catalog } = normalize(snap);
      writeJsonAtomic(DRAFT, catalog);
      audit(who, 'restore', `استعادة النسخة ${Number(snap.release) ? 'رقم ' + snap.release + ' ' : ''}(${id}) إلى المسودة — لم تُنشر بعد`, { ip: ip(req) });
      return send(res, 200, { catalog });
    }
    if (p === '/api/admin/upload' && m === 'POST') {
      if (!can(who, 'upload')) return forbid(res, who, req);
      const buf = await readBody(req, 6 * 1024 * 1024);
      const ext = sniffImage(buf);
      if (!ext) return send(res, 415, { error: 'الملف ليس صورة مدعومة (jpg / png / webp)' });
      const base = path.basename(String(url.searchParams.get('name') || 'image')).replace(/\.[^.]*$/, '').replace(/[^\w\-]+/g, '_').slice(0, 30) || 'image';
      const name = `${base}-${crypto.randomBytes(4).toString('hex')}.${ext}`;
      fs.writeFileSync(path.join(UPLOADS_DIR, name), buf);
      audit(who, 'upload', `رفع صورة ${name} (${Math.round(buf.length / 1024)}KB)`, { ip: ip(req) });
      return send(res, 200, { url: `/uploads/${name}`, size: buf.length, ...(imageSize(buf) || {}) });
    }
    if (p === '/api/admin/media' && m === 'GET') return send(res, 200, { media: listMedia() });
    if (p === '/api/admin/media' && m === 'DELETE' && url.searchParams.get('unused') === '1') {
      if (!can(who, 'media_delete')) return forbid(res, who, req);
      const gone = listMedia().filter((x) => !x.usedBy.length);
      for (const x of gone) fs.unlinkSync(path.join(UPLOADS_DIR, x.name));
      audit(who, 'media_cleanup', `تنظيف ${gone.length} صورة غير مستخدمة`, { ip: ip(req) });
      return send(res, 200, { ok: true, deleted: gone.length });
    }
    if (p === '/api/admin/media' && m === 'DELETE') {
      if (!can(who, 'media_delete')) return forbid(res, who, req);
      const name = path.basename(String(url.searchParams.get('name') || ''));
      const f = within(UPLOADS_DIR, name);
      if (!name || !f || !fs.existsSync(f)) return send(res, 404, { error: 'الصورة غير موجودة' });
      const used = mediaUsage().get(`/uploads/${name}`);
      if (used && used.size) return send(res, 409, { error: 'الصورة مستخدمة ولا يمكن حذفها', usedBy: [...used] });
      fs.unlinkSync(f); audit(who, 'media_delete', `حذف صورة ${name}`, { ip: ip(req) });
      return send(res, 200, { ok: true });
    }
    if (p === '/api/admin/ops' && m === 'GET') return send(res, 200, buildOps());
    const dm = /^\/api\/admin\/devices\/([\w-]{1,24})$/.exec(p);
    if (dm && m === 'GET') {
      if (!can(who, 'devices')) return forbid(res, who, req);
      const dev = knownDevices().find((d) => d.deviceId === dm[1]);
      if (!dev) return send(res, 404, { error: 'الجهاز غير موجود' });
      const mine = sessions().filter((x) => x.deviceId === dm[1]);
      const log = mine.flatMap((x) => (x.log || []).map((e) => ({ ...e, session: x.id }))).sort((a, b2) => b2.at.localeCompare(a.at)).slice(0, 60);
      const draft = readJson(DRAFT);
      const restricted = [...(draft.programs || []).map((o) => ['program', o]), ...(draft.catalogs || []).map((o) => ['catalog', o])].filter(([, o]) => (o.kiosks || []).includes(dm[1])).map(([t, o]) => ({ type: t, id: o.id, label: nameOf(o) }));
      return send(res, 200, { device: dev, sessions: mine.map((x) => ({ id: x.id, status: x.status, kioskName: x.kioskName, label: x.label, createdAt: x.createdAt, activatedAt: x.activatedAt, endedAt: x.endedAt, started: x.started, completed: x.completed })), log, restricted, liveRelease: liveRelease() });
    }
    if (p === '/api/admin/live' && m === 'GET') return send(res, 200, readJson(LIVE)); // المنشور كاملاً (للوحة)
    if (p === '/api/admin/devices' && m === 'GET') return send(res, 200, { devices: knownDevices() });
    if (p === '/api/admin/sessions' && m === 'GET') {
      if (!can(who, 'devices')) return forbid(res, who, req);
      return send(res, 200, { sessions: sessions() });
    }
    if (p === '/api/admin/sessions' && m === 'POST') {
      if (!can(who, 'devices')) return forbid(res, who, req);
      const body = await readJsonBody(req, 2048);
      const s = createSession(body.label);
      audit(who, 'session_create', `فتح جلسة كيوسك جديدة${s.label ? ' — ' + s.label : ''}`, { ip: ip(req) });
      return send(res, 200, { session: s });
    }
    const sm = /^\/api\/admin\/sessions\/(ss_[0-9a-f]{8})(?:\/(end|rename))?$/.exec(p);
    if (sm) {
      if (!can(who, 'devices')) return forbid(res, who, req);
      const s = sessions().find((x) => x.id === sm[1]);
      if (!s) return send(res, 404, { error: 'الجلسة غير موجودة' });
      if (m === 'POST' && sm[2] === 'end') {
        if (s.status === 'ended') return send(res, 200, { session: s });
        s.status = 'ended'; s.endedAt = new Date().toISOString(); sessionLog(s, 'ended', 'أنهيت من اللوحة'); saveSessionsSoon(true);
        audit(who, 'session_end', `إنهاء جلسة الكيوسك «${s.kioskName || s.label || s.id}»`, { ip: ip(req) });
        return send(res, 200, { session: s });
      }
      if (m === 'POST' && sm[2] === 'rename') {
        const body = await readJsonBody(req, 2048);
        if (body.kioskName !== undefined) s.kioskName = cleanText(body.kioskName, 40);
        if (body.label !== undefined) s.label = cleanText(body.label, 60);
        sessionLog(s, 'renamed', `الاسم: ${s.kioskName || '—'} · المكان: ${s.label || '—'}`); saveSessionsSoon(true); audit(who, 'session_rename', `تعديل بيانات الكيوسك «${s.kioskName || s.id}»`, { ip: ip(req) });
        return send(res, 200, { session: s });
      }
      if (m === 'DELETE' && !sm[2]) {
        if (s.status === 'active') return send(res, 409, { error: 'أنهِ الجلسة أولاً قبل حذفها' });
        sessionDb.sessions = sessions().filter((x) => x.id !== s.id); saveSessionsSoon(true);
        audit(who, 'session_delete', `حذف سجل جلسة «${s.kioskName || s.label || s.id}»`, { ip: ip(req) });
        return send(res, 200, { ok: true });
      }
    }
    if (p === '/api/admin/audit' && m === 'GET') {
      if (!can(who, 'audit')) return forbid(res, who, req);
      return send(res, 200, { entries: readAudit(Number(url.searchParams.get('limit')) || 200) });
    }
    if (p === '/api/admin/stats' && m === 'GET') {
      if (!can(who, 'stats')) return forbid(res, who, req);
      return send(res, 200, { demo: true, stats: loadStats() });
    }
    if (p === '/api/admin/dashboard' && m === 'GET') {
      if (!can(who, 'stats')) return forbid(res, who, req);
      const range = ['today', '7', '30', 'all'].includes(url.searchParams.get('range')) ? url.searchParams.get('range') : '7';
      return send(res, 200, buildDashboard(range, url.searchParams.get('mode') === 'production' ? 'production' : 'simulation'));
    }
    if (p === '/api/admin/stats' && m === 'DELETE') {
      if (!can(who, 'publish')) return forbid(res, who, req);
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
    return serveFile(req, res, f, { 'Cache-Control': 'no-cache', 'X-Frame-Options': 'DENY', 'Content-Security-Policy': ADMIN_CSP });
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
    for (const [n, g] of ROLE_PASSWORDS) if (g() && weakPassword(g())) console.warn(`تحذير أمني: كلمة مرور الدور «${n}» ضعيفة (استخدم 8 خانات فأكثر وليست أرقاماً فقط).`);
    if (generatedPassword) console.log(`ADMIN_PASSWORD غير مضبوط — كلمة مرور مؤقتة لهذه الجلسة: ${ADMIN_PASSWORD}`);
  });
}
module.exports = { createServer, ADMIN_PASSWORD: () => ADMIN_PASSWORD, diffSummary, filterForDevice };
