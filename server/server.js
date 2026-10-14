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

let ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
let generatedPassword = false;
if (!ADMIN_PASSWORD) {
  ADMIN_PASSWORD = crypto.randomBytes(6).toString('base64url');
  generatedPassword = true;
}
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
  try { return JSON.parse(Buffer.from(body, 'base64url').toString()).exp > Date.now(); } catch { return false; }
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

// ---------- المسارات ----------
function auth(req) {
  const h = req.headers.authorization || '';
  return h.startsWith('Bearer ') && verifyToken(h.slice(7));
}
const ip = (req) => req.socket.remoteAddress || '?';

async function handle(req, res) {
  const url = new URL(req.url, 'http://x');
  const p = url.pathname;
  const m = req.method;

  if (m === 'OPTIONS') return send(res, 204, '', { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'If-None-Match' });

  // --- عام (يقرؤه التطبيق) ---
  if (p === '/api/health') return send(res, 200, { ok: true });
  if (p === '/api/catalog' && (m === 'GET' || m === 'HEAD')) {
    const body = fs.readFileSync(LIVE);
    const etag = '"' + crypto.createHash('sha1').update(body).digest('hex') + '"';
    const cors = { 'Access-Control-Allow-Origin': '*', ETag: etag, 'Cache-Control': 'no-cache', 'Content-Type': 'application/json; charset=utf-8' };
    if (req.headers['if-none-match'] === etag) { res.writeHead(304, cors); return res.end(); }
    res.writeHead(200, cors);
    return res.end(m === 'HEAD' ? undefined : body);
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
    if (!safeEqual(body.password ?? '', ADMIN_PASSWORD)) { noteFailure(who); return send(res, 401, { error: 'كلمة المرور غير صحيحة' }); }
    failures.delete(who);
    const exp = Date.now() + TOKEN_TTL_MS;
    return send(res, 200, { token: sign({ exp }), expiresAt: exp });
  }

  // --- الإدارة ---
  if (p.startsWith('/api/admin/')) {
    if (!auth(req)) return send(res, 401, { error: 'يلزم تسجيل الدخول' });

    if (p === '/api/admin/catalog' && m === 'GET') {
      const draft = readJson(DRAFT), live = readJson(LIVE);
      return send(res, 200, { catalog: draft, hasUnpublished: !sameContent(draft, live), liveUpdatedAt: live.updatedAt });
    }
    if (p === '/api/admin/catalog' && m === 'PUT') {
      const body = await readJsonBody(req);
      const { catalog, errors, warnings } = normalize(body.catalog ?? body);
      if (errors.length) return send(res, 422, { error: 'بيانات غير صالحة', errors, warnings });
      writeJsonAtomic(DRAFT, catalog);
      return send(res, 200, { catalog, warnings, hasUnpublished: !sameContent(catalog, readJson(LIVE)) });
    }
    if (p === '/api/admin/publish' && m === 'POST') {
      const draft = readJson(DRAFT);
      const { catalog, errors, warnings } = normalize(draft);
      if (errors.length) return send(res, 422, { error: 'لا يمكن النشر', errors, warnings });
      const prev = fs.readFileSync(LIVE);
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
      const { id } = await readJsonBody(req, 4096);
      const f = within(HISTORY_DIR, `${id}.json`);
      if (!f || !fs.existsSync(f)) return send(res, 404, { error: 'النسخة غير موجودة' });
      const { catalog } = normalize(readJson(f));
      writeJsonAtomic(DRAFT, catalog);
      return send(res, 200, { catalog });
    }
    if (p === '/api/admin/upload' && m === 'POST') {
      const buf = await readBody(req, 6 * 1024 * 1024);
      const ext = sniffImage(buf);
      if (!ext) return send(res, 415, { error: 'الملف ليس صورة مدعومة (jpg / png / webp)' });
      const base = path.basename(String(url.searchParams.get('name') || 'image')).replace(/\.[^.]*$/, '').replace(/[^\w\-]+/g, '_').slice(0, 30) || 'image';
      const name = `${base}-${crypto.randomBytes(4).toString('hex')}.${ext}`;
      fs.writeFileSync(path.join(UPLOADS_DIR, name), buf);
      return send(res, 200, { url: `/uploads/${name}` });
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
module.exports = { createServer, ADMIN_PASSWORD: () => ADMIN_PASSWORD };
