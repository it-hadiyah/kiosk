'use strict';
// مركز التشغيل: الأمان، الإصدارات، الفحص المسبق، الأجهزة، الوسائط، الفصل بين المحاكاة والفعلي.  node --test test/ops.test.js
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const PW = { super: 'Strong-Pass-1', manager: 'mgr', editor: 'Editor-Pass-9' };
let proc, base, dataDir; const tok = {};
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
async function api(method, url, body, headers = {}) {
  const res = await fetch(base + url, { method, headers: { ...(body && !Buffer.isBuffer(body) ? { 'Content-Type': 'application/json' } : {}), ...headers }, body: body === undefined ? undefined : Buffer.isBuffer(body) ? body : JSON.stringify(body) });
  const text = await res.text(); let json = null; try { json = JSON.parse(text); } catch { /* */ }
  return { status: res.status, json, headers: res.headers, text };
}
const as = (role, method, url, body) => api(method, url, body, { Authorization: `Bearer ${tok[role]}` });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

before(async () => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hd-ops-'));
  const port = 20000 + Math.floor(Math.random() * 20000); base = `http://127.0.0.1:${port}`;
  proc = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], { env: { ...process.env, PORT: String(port), DATA_DIR: dataDir, ADMIN_PASSWORD: PW.super, MANAGER_PASSWORD: PW.manager, EDITOR_PASSWORD: PW.editor, OFFLINE_MINUTES: '0.03' }, stdio: 'ignore' });
  for (let i = 0; i < 50; i++) { try { if ((await fetch(base + '/api/health')).ok) break; } catch { /* */ } await wait(100); }
  for (const r of Object.keys(PW)) tok[r] = (await api('POST', '/api/login', { password: PW[r] })).json.token;
});
after(() => { proc.kill(); fs.rmSync(dataDir, { recursive: true, force: true }); });

test('security headers: strict CSP on the panel, no-store on admin API, nosniff everywhere', async () => {
  const page = await api('GET', '/admin/');
  assert.match(page.headers.get('content-security-policy'), /script-src 'self'/);
  assert.match(page.headers.get('content-security-policy'), /frame-ancestors 'none'/);
  assert.equal(page.headers.get('x-frame-options'), 'DENY');
  assert.equal(page.headers.get('referrer-policy'), 'no-referrer');
  const me = await as('super', 'GET', '/api/admin/me');
  assert.equal(me.headers.get('cache-control'), 'no-store');
  assert.equal(me.headers.get('x-content-type-options'), 'nosniff');
  // الأمن: المدير يرى الأدوار الضعيفة (manager = 'mgr')
  assert.ok(me.json.security.weakPasswordRoles.includes('manager'));
  assert.ok(!me.json.security.weakPasswordRoles.includes('super'));
  assert.equal(me.json.security.https, false);
  assert.equal((await as('editor', 'GET', '/api/admin/me')).json.security, undefined);
});

test('audit entries carry a result; denied attempts are logged', async () => {
  assert.equal((await as('editor', 'POST', '/api/admin/publish')).status, 403);
  await api('POST', '/api/login', { password: 'wrong' });
  const e = (await as('super', 'GET', '/api/admin/audit')).json.entries;
  assert.ok(e.some((x) => x.action === 'denied' && x.result === 'denied' && x.role === 'editor'));
  assert.ok(e.some((x) => x.action === 'login_failed' && x.result === 'failed'));
  assert.ok(e.every((x) => ['ok', 'failed', 'denied'].includes(x.result)));
  assert.ok(!JSON.stringify(e).includes(PW.super), 'no secrets in the audit log');
});

test('publishing: release numbers, idempotent repeat, history metadata, restore stays draft, discard', async () => {
  const cat = (await as('manager', 'GET', '/api/admin/catalog')).json;
  assert.equal(cat.liveRelease, 0);
  const d = cat.catalog; d.programs[0].title.ar = 'عنوان الإصدار 1';
  await as('manager', 'PUT', '/api/admin/catalog', { catalog: d });
  const pf = (await as('manager', 'GET', '/api/admin/preflight')).json;
  assert.equal(pf.ok, true); assert.equal(pf.hasChanges, true); assert.equal(pf.nextRelease, 1);
  assert.ok(pf.changes.some((c) => c.includes('عنوان الإصدار 1')));
  const p1 = (await as('manager', 'POST', '/api/admin/publish')).json;
  assert.equal(p1.release, 1);
  // ضغط متكرر: لا إصدار جديد
  const again = (await as('manager', 'POST', '/api/admin/publish')).json;
  assert.equal(again.unchanged, true); assert.equal(again.release, 1);
  assert.equal((await api('GET', '/api/catalog')).json.release, 1);
  assert.equal((await as('manager', 'GET', '/api/admin/catalog')).json.hasUnpublished, false);

  d.programs[0].title.ar = 'عنوان الإصدار 2';
  await as('manager', 'PUT', '/api/admin/catalog', { catalog: d });
  assert.equal((await as('manager', 'POST', '/api/admin/publish')).json.release, 2);
  const rel = (await as('manager', 'GET', '/api/admin/releases')).json;
  assert.equal(rel.release, 2); assert.equal(rel.releases[0].version, 2); assert.equal(rel.releases[0].role, 'manager');
  const hist = (await as('manager', 'GET', '/api/admin/history')).json.history;
  assert.equal(hist[0].release, 1); assert.equal(hist[0].replacedBy.version, 2);
  const snap = (await as('manager', 'GET', `/api/admin/history/${hist[0].id}`)).json.catalog;
  assert.equal(snap.programs[0].title.ar, 'عنوان الإصدار 1');
  assert.equal((await as('manager', 'GET', '/api/admin/history/nope')).status, 404);
  // استرجاع إلى المسودة فقط (المنشور لا يتغير)
  assert.equal((await as('manager', 'POST', '/api/admin/restore', { id: hist[0].id })).status, 200);
  assert.equal((await api('GET', '/api/catalog')).json.release, 2);
  const after = (await as('manager', 'GET', '/api/admin/catalog')).json;
  assert.equal(after.hasUnpublished, true); assert.equal(after.catalog.programs[0].title.ar, 'عنوان الإصدار 1'); assert.equal(after.catalog.release, undefined);
  // تجاهل التعديلات
  assert.equal((await as('editor', 'POST', '/api/admin/discard')).status, 200);
  const disc = (await as('manager', 'GET', '/api/admin/catalog')).json;
  assert.equal(disc.hasUnpublished, false); assert.equal(disc.catalog.programs[0].title.ar, 'عنوان الإصدار 2');
});

test('settings: warn seconds cannot exceed idle seconds', async () => {
  const d = (await as('manager', 'GET', '/api/admin/catalog')).json.catalog;
  d.settings.idleSeconds = 30; d.settings.warnSeconds = 45;
  const r = await as('manager', 'PUT', '/api/admin/catalog', { catalog: d });
  assert.equal(r.status, 422); assert.ok(r.json.errors.some((x) => x.includes('مهلة التنبيه')));
});

test('preflight blocks publishing when an image file is missing, and reports checks', async () => {
  const d = (await as('manager', 'GET', '/api/admin/catalog')).json.catalog;
  d.programs[0].image = '/uploads/ghost-file.jpg';
  d.programs[1].title.fr = ''; // ترجمة ناقصة
  assert.equal((await as('manager', 'PUT', '/api/admin/catalog', { catalog: d })).status, 200);
  const pf = (await as('manager', 'GET', '/api/admin/preflight')).json;
  assert.equal(pf.ok, false);
  assert.equal(pf.checks.find((c) => c.id === 'images_missing').status, 'error');
  assert.equal(pf.checks.find((c) => c.id === 'translations').status, 'warn');
  const pub = await as('manager', 'POST', '/api/admin/publish');
  assert.equal(pub.status, 422); assert.ok(pub.json.errors.some((x) => x.includes('ملف الصورة مفقود')));
  const ops = (await as('editor', 'GET', '/api/admin/ops')).json;
  assert.ok(ops.alerts.some((a) => a.kind === 'media_missing' && a.target.id === '/uploads/ghost-file.jpg'));
  assert.ok(ops.alerts.some((a) => a.kind === 'publish_failed'));
  assert.equal(ops.missingMedia[0].url, '/uploads/ghost-file.jpg');
  await as('manager', 'POST', '/api/admin/discard');
  assert.equal((await as('manager', 'GET', '/api/admin/preflight')).json.ok, true);
});

test('ops: devices connectivity, content sync, alerts, device detail', async () => {
  const mk = async (deviceId, name, ver) => { const s = (await as('manager', 'POST', '/api/admin/sessions', { label: 'مكان ' + name })).json.session; const a = await api('POST', '/api/device/activate', { code: s.code, name, deviceId, appVersion: ver }); return a.json.token; };
  const tA = await mk('opsA', 'جهاز أ', '2.0.0'), tB = await mk('opsB', 'جهاز ب', '1.0.0');
  await api('GET', '/api/catalog', undefined, { 'X-Kiosk-Token': tA, 'X-Kiosk-Version': '2.0.0' });
  await api('GET', '/api/catalog', undefined, { 'X-Kiosk-Token': tB, 'X-Kiosk-Version': '1.0.0' });
  let ops = (await as('manager', 'GET', '/api/admin/ops')).json;
  assert.equal(ops.summary.total, 2); assert.equal(ops.summary.online, 2); assert.equal(ops.summary.upToDate, 2);
  assert.equal(ops.liveRelease, 2);
  const a = ops.devices.find((d) => d.deviceId === 'opsA'); assert.equal(a.contentRelease, 2); assert.equal(a.online, true);
  assert.ok(ops.alerts.some((x) => x.kind === 'old_app' && x.target.id === 'opsB'), 'older app version is flagged');
  // فقد الاتصال بعد المهلة (OFFLINE_MINUTES=0.03 ≈ 1.8 ث)
  await wait(2300);
  await api('GET', '/api/catalog', undefined, { 'X-Kiosk-Token': tA, 'X-Kiosk-Version': '2.0.0' }); // A يتصل، B لا
  ops = (await as('manager', 'GET', '/api/admin/ops')).json;
  assert.equal(ops.summary.online, 1); assert.equal(ops.summary.offline, 1);
  assert.ok(ops.alerts.some((x) => x.kind === 'offline' && x.target.id === 'opsB' && x.severity === 'error'));
  // تفاصيل الجهاز: جلسات + سجل مزامنة + محتوى مخصص
  const d = (await as('manager', 'GET', '/api/admin/devices/opsA')).json;
  assert.equal(d.device.name, 'جهاز أ'); assert.equal(d.sessions.length, 1);
  assert.ok(d.log.some((e) => e.type === 'sync') && d.log.some((e) => e.type === 'activated'));
  assert.equal((await as('editor', 'GET', '/api/admin/devices/opsA')).status, 403);
  assert.equal((await as('manager', 'GET', '/api/admin/devices/nope')).status, 404);
  assert.equal((await api('GET', '/api/admin/ops')).status, 401);
});

test('media: dimensions, usage, bulk cleanup of unused files only', async () => {
  const up = await as('editor', 'POST', '/api/admin/upload?name=dim', PNG);
  assert.equal(up.json.width, 1); assert.equal(up.json.height, 1);
  const list = (await as('editor', 'GET', '/api/admin/media')).json.media;
  const mine = list.find((m) => m.url === up.json.url);
  assert.deepEqual([mine.width, mine.height, mine.type], [1, 1, 'png']);
  assert.ok(list.filter((m) => m.usedBy.length).every((m) => m.width > 0), 'seed JPEG dimensions parsed');
  assert.equal((await as('editor', 'DELETE', '/api/admin/media?unused=1')).status, 403);
  const used = list.filter((m) => m.usedBy.length).map((m) => m.name);
  const r = (await as('manager', 'DELETE', '/api/admin/media?unused=1')).json;
  assert.ok(r.deleted >= 1);
  const after = (await as('manager', 'GET', '/api/admin/media')).json.media;
  assert.ok(!after.some((m) => m.url === up.json.url));
  for (const n of used) assert.ok(after.some((m) => m.name === n), 'used files survive the cleanup');
});

test('analytics: simulation funnel + previous period; production mode is separate and unavailable', async () => {
  await as('manager', 'DELETE', '/api/admin/stats');
  const ev = (o) => api('POST', '/api/events', { deviceId: 'fun1', mode: 'simulation', ...o });
  for (const e of [{ type: 'session_start' }, { type: 'program_selected', programId: 'zakat' }, { type: 'amount_chosen', programId: 'zakat', amount: 50 }, { type: 'payment_started' }, { type: 'payment_completed', programId: 'zakat', amount: 50, durationMs: 4000 }, { type: 'session_start' }, { type: 'program_selected', programId: 'zakat' }]) assert.equal((await ev(e)).status, 200);
  const d = (await as('manager', 'GET', '/api/admin/dashboard?range=7')).json;
  assert.equal(d.mode, 'simulation'); assert.equal(d.demo, true);
  assert.deepEqual([d.sessions, d.selected, d.amountChosen, d.started, d.completed], [2, 2, 1, 1, 1]);
  assert.ok(d.prev && d.prev.hasData === false && d.prev.completed === 0, 'previous period exists but has no data');
  assert.equal((await as('manager', 'GET', '/api/admin/dashboard?range=all')).json.prev, null);
  const prod = (await as('manager', 'GET', '/api/admin/dashboard?mode=production')).json;
  assert.equal(prod.available, false); assert.equal(prod.mode, 'production'); assert.equal(prod.completed, undefined);
  // أحداث «إنتاج» ترفض ولا تدخل في إحصاءات المحاكاة
  const bad = await api('POST', '/api/events', { type: 'payment_completed', mode: 'production', amount: 99999, deviceId: 'fun1' });
  assert.equal(bad.status, 400); assert.equal(bad.json.code, 'production_disabled');
  assert.equal((await as('manager', 'GET', '/api/admin/dashboard?range=all')).json.amount, 50);
});
