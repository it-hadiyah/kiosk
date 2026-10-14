'use strict';
// اختبارات الخادم: node --test test/   (أو npm test). تشغّل خادماً مؤقتاً ببيانات مؤقتة.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { normalize } = require('../validate');

const PASSWORD = 'unit-test-pass';
let proc, base, dataDir, token;

// png 1x1
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

async function api(method, url, body, headers = {}) {
  const res = await fetch(base + url, {
    method,
    headers: { ...(body && !Buffer.isBuffer(body) ? { 'Content-Type': 'application/json' } : {}), ...headers },
    body: body === undefined ? undefined : Buffer.isBuffer(body) ? body : JSON.stringify(body),
  });
  let json = null;
  const text = await res.text();
  try { json = JSON.parse(text); } catch { /* ليس JSON */ }
  return { status: res.status, json, text, headers: res.headers };
}
const admin = (method, url, body) => api(method, url, body, { Authorization: `Bearer ${token}` });

before(async () => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hd-srv-'));
  const port = 20000 + Math.floor(Math.random() * 20000);
  base = `http://127.0.0.1:${port}`;
  proc = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], {
    env: { ...process.env, PORT: String(port), DATA_DIR: dataDir, ADMIN_PASSWORD: PASSWORD },
    stdio: 'ignore',
  });
  for (let i = 0; i < 50; i++) {
    try { if ((await fetch(base + '/api/health')).ok) break; } catch { /* لم يبدأ بعد */ }
    await new Promise((r) => setTimeout(r, 100));
  }
  const r = await api('POST', '/api/login', { password: PASSWORD });
  token = r.json.token;
});
after(() => { proc.kill(); fs.rmSync(dataDir, { recursive: true, force: true }); });

test('public catalog: seeded, CORS, ETag/304', async () => {
  const r = await api('GET', '/api/catalog');
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('access-control-allow-origin'), '*');
  assert.ok(r.json.programs.length >= 7);
  const etag = r.headers.get('etag');
  const again = await api('GET', '/api/catalog', undefined, { 'If-None-Match': etag });
  assert.equal(again.status, 304);
});

test('seed passes validation with no errors', () => {
  const seed = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'seed', 'catalog.json'), 'utf8'));
  const { errors } = normalize(seed);
  assert.deepEqual(errors, []);
});

test('auth: wrong password, missing/forged token, rate limit', async () => {
  assert.equal((await api('POST', '/api/login', { password: 'nope' })).status, 401);
  assert.equal((await api('GET', '/api/admin/catalog')).status, 401);
  assert.equal((await api('GET', '/api/admin/catalog', undefined, { Authorization: 'Bearer abc.def' })).status, 401);
  const forged = Buffer.from(JSON.stringify({ exp: Date.now() + 1e9 })).toString('base64url') + '.AAAA';
  assert.equal((await api('GET', '/api/admin/catalog', undefined, { Authorization: `Bearer ${forged}` })).status, 401);
  let last;
  for (let i = 0; i < 7; i++) last = await api('POST', '/api/login', { password: 'bad' + i });
  assert.equal(last.status, 429);
});

test('draft save normalizes, validates, and does not touch the live catalog', async () => {
  const live0 = (await api('GET', '/api/catalog')).text;
  const cur = (await admin('GET', '/api/admin/catalog')).json.catalog;
  const next = structuredClone(cur);
  next.programs.push({ id: 'fixed15', title: { ar: 'وجبة', en: '<img src=x onerror=alert(1)>' }, image: '/uploads/p_meal.jpg', kind: 'fixed', price: 15, allowQuantity: true, maxQuantity: 5, junk: 1 });
  next.home.push({ type: 'program', id: 'fixed15', size: 'small' }, { type: 'program', id: 'ghost', size: 'large' });
  const r = await admin('PUT', '/api/admin/catalog', { catalog: next });
  assert.equal(r.status, 200);
  const saved = r.json.catalog.programs.find((p) => p.id === 'fixed15');
  assert.equal(saved.price, 15);
  assert.equal(saved.allowQuantity, true);
  assert.equal('junk' in saved, false);
  assert.equal(r.json.catalog.home.some((h) => h.id === 'ghost'), false); // مرجع غير موجود يُزال
  assert.equal(r.json.hasUnpublished, true);
  assert.equal((await api('GET', '/api/catalog')).text, live0); // المنشور لم يتغير
});

test('validation errors return 422 with Arabic messages', async () => {
  const cur = (await admin('GET', '/api/admin/catalog')).json.catalog;
  const bad = structuredClone(cur);
  bad.programs.push({ id: 'Bad ID', title: { ar: 'x' } }, { id: 'nofix', title: { ar: 'ثابت' }, kind: 'fixed', price: 0 }, { id: 'noar', title: { en: 'only en' } });
  const r = await admin('PUT', '/api/admin/catalog', { catalog: bad });
  assert.equal(r.status, 422);
  assert.ok(r.json.errors.some((e) => e.includes('معرّف غير صالح')));
  assert.ok(r.json.errors.some((e) => e.includes('القيمة الثابتة')));
  assert.ok(r.json.errors.some((e) => e.includes('العنوان العربي')));
});

test('publish: live updated, history kept, restore returns an older draft', async () => {
  const before = (await api('GET', '/api/catalog')).json;
  assert.equal(before.programs.some((p) => p.id === 'fixed15'), false);
  const pub = await admin('POST', '/api/admin/publish');
  assert.equal(pub.status, 200);
  const live = (await api('GET', '/api/catalog')).json;
  assert.ok(live.programs.some((p) => p.id === 'fixed15'));
  const hist = (await admin('GET', '/api/admin/history')).json.history;
  assert.ok(hist.length >= 1);
  const restored = await admin('POST', '/api/admin/restore', { id: hist[0].id });
  assert.equal(restored.status, 200);
  assert.equal(restored.json.catalog.programs.some((p) => p.id === 'fixed15'), false);
  assert.equal((await admin('POST', '/api/admin/restore', { id: '../../etc/passwd' })).status, 404);
  assert.equal((await admin('GET', '/api/admin/catalog')).json.hasUnpublished, true);
});

test('upload: accepts real images, rejects fake ones and oversize', async () => {
  const ok = await admin('POST', '/api/admin/upload?name=../../evil.png', PNG);
  assert.equal(ok.status, 200);
  assert.match(ok.json.url, /^\/uploads\/[\w\-]+\.png$/);
  const served = await fetch(base + ok.json.url);
  assert.equal(served.status, 200);
  assert.equal(served.headers.get('content-type'), 'image/png');
  assert.equal((await admin('POST', '/api/admin/upload?name=a.png', Buffer.from('<script>alert(1)</script>'))).status, 415);
  assert.equal((await api('POST', '/api/admin/upload', PNG)).status, 401);
  const big = Buffer.concat([PNG, Buffer.alloc(7 * 1024 * 1024)]);
  const r = await fetch(base + '/api/admin/upload', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: big }).catch(() => ({ status: 413 }));
  assert.ok([413, 0].includes(r.status) || r.status === 413);
});

test('static files: no path traversal', async () => {
  for (const p of ['/uploads/..%2Fdraft.json', '/uploads/%2e%2e/catalog.json', '/admin/..%2F..%2Fserver.js', '/admin/%2e%2e/validate.js']) {
    const r = await fetch(base + p);
    assert.ok([400, 404].includes(r.status), `${p} -> ${r.status}`);
  }
  assert.equal((await fetch(base + '/admin/', { redirect: 'manual' })).status, 200);
});

test('normalize unit: ids unique, sizes defaulted, quick amounts bounded', () => {
  const { catalog, errors } = normalize({
    settings: { quickAmounts: [5, 5, 'x', 0, 10, 20, 30, 40, 50, 60, 70, 80], idleSeconds: 1 },
    programs: [{ id: 'a', title: { ar: 'أ' } }, { id: 'a', title: { ar: 'ب' } }],
    catalogs: [{ id: 'c', title: { ar: 'ك' }, items: [{ programId: 'a', size: 'weird' }, { programId: 'a' }] }],
    home: [{ type: 'catalog', id: 'c', size: 'bogus' }],
  });
  assert.ok(errors.some((e) => e.includes('مكرر')));
  assert.equal(catalog.settings.quickAmounts.length, 8);
  assert.equal(catalog.settings.idleSeconds, 10);
  assert.deepEqual(catalog.catalogs[0].items, [{ programId: 'a', size: 'medium' }]);
  assert.equal(catalog.home[0].size, 'medium');
});

test('featured: normalized, bounded, references checked, survives publish', async () => {
  const cur = (await admin('GET', '/api/admin/catalog')).json.catalog;
  const next = structuredClone(cur);
  const id = next.programs[0].id;
  next.featured = {
    enabled: true, intervalSeconds: 999, title: { ar: 'الأكثر طلباً', en: 'Top' },
    items: [{ type: 'program', id }, { type: 'program', id }, { type: 'program', id: 'ghost' }, { type: 'catalog', id: 'nope' }, ...Array.from({ length: 12 }, () => ({ type: 'program', id }))],
  };
  const r = await admin('PUT', '/api/admin/catalog', { catalog: next });
  assert.equal(r.status, 200);
  assert.equal(r.json.catalog.featured.intervalSeconds, 60);
  assert.deepEqual(r.json.catalog.featured.items, [{ type: 'program', id }]); // مكرر/غير موجود أُزيل
  assert.equal(r.json.catalog.featured.title.ar, 'الأكثر طلباً');
  assert.equal((await admin('POST', '/api/admin/publish')).status, 200);
  const live = (await api('GET', '/api/catalog')).json;
  assert.equal(live.featured.enabled, true);
  assert.equal(live.featured.items.length, 1);
  // بلا إعداد = معطّل
  const bare = normalize({ programs: [{ id: 'a', title: { ar: 'أ' } }] });
  assert.equal(bare.catalog.featured.enabled, false);
});

test('theme: valid colors kept, bad hex defaulted, low contrast rejected', () => {
  const seed = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'seed', 'catalog.json'), 'utf8'));
  const withTheme = (t) => normalize({ ...seed, settings: { ...seed.settings, theme: t } });
  const ok = withTheme({ primary: '#c0392b', ink: '#222222', radius: 'round' });
  assert.deepEqual(ok.errors, []);
  assert.deepEqual(ok.catalog.settings.theme, { primary: '#C0392B', ink: '#222222', radius: 'round' });
  const bad = withTheme({ primary: 'red', ink: '#12', radius: 'x' });
  assert.deepEqual(bad.catalog.settings.theme, { primary: '#00A092', ink: '#1F4A47', radius: 'normal' });
  assert.ok(bad.warnings.length >= 2);
  const pale = withTheme({ primary: '#FFEEAA' });
  assert.ok(pale.errors.some((e) => e.includes('اللون الأساسي فاتح')));
  const faint = withTheme({ ink: '#BBBBBB' });
  assert.ok(faint.errors.some((e) => e.includes('لون النصوص باهت')));
});
