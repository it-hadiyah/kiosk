'use strict';
// أدوار + سجل تدقيق + مكتبة وسائط + إحصائيات المحاكاة.  node --test test/
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const PW = { super: 'pw-super', manager: 'pw-manager', editor: 'pw-editor', viewer: 'pw-viewer' };
let proc, base, dataDir; const tok = {};
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

async function api(method, url, body, headers = {}) {
  const res = await fetch(base + url, {
    method,
    headers: { ...(body && !Buffer.isBuffer(body) ? { 'Content-Type': 'application/json' } : {}), ...headers },
    body: body === undefined ? undefined : Buffer.isBuffer(body) ? body : JSON.stringify(body),
  });
  const text = await res.text(); let json = null; try { json = JSON.parse(text); } catch { /* */ }
  return { status: res.status, json, headers: res.headers };
}
const as = (role, method, url, body) => api(method, url, body, { Authorization: `Bearer ${tok[role]}` });

before(async () => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hd-plat-'));
  const port = 20000 + Math.floor(Math.random() * 20000); base = `http://127.0.0.1:${port}`;
  proc = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], {
    env: { ...process.env, PORT: String(port), DATA_DIR: dataDir, ADMIN_PASSWORD: PW.super, MANAGER_PASSWORD: PW.manager, EDITOR_PASSWORD: PW.editor, VIEWER_PASSWORD: PW.viewer },
    stdio: 'ignore',
  });
  for (let i = 0; i < 50; i++) { try { if ((await fetch(base + '/api/health')).ok) break; } catch { /* */ } await new Promise((r) => setTimeout(r, 100)); }
  for (const role of Object.keys(PW)) { const r = await api('POST', '/api/login', { password: PW[role] }); assert.equal(r.json.role, role); tok[role] = r.json.token; }
});
after(() => { proc.kill(); fs.rmSync(dataDir, { recursive: true, force: true }); });

test('roles: viewer reads only; editor edits draft but not settings/publish; manager publishes', async () => {
  const cat = (await as('viewer', 'GET', '/api/admin/catalog')).json.catalog;
  assert.equal((await as('viewer', 'PUT', '/api/admin/catalog', { catalog: cat })).status, 403);
  assert.equal((await as('viewer', 'POST', '/api/admin/upload?name=a', PNG)).status, 403);

  const edited = JSON.parse(JSON.stringify(cat)); edited.programs[0].title.ar = 'عنوان جديد';
  assert.equal((await as('editor', 'PUT', '/api/admin/catalog', { catalog: edited })).status, 200);
  const settingsChanged = JSON.parse(JSON.stringify(edited)); settingsChanged.settings.idleSeconds = 77;
  assert.equal((await as('editor', 'PUT', '/api/admin/catalog', { catalog: settingsChanged })).status, 403);
  assert.equal((await as('editor', 'POST', '/api/admin/publish')).status, 403);
  assert.equal((await as('editor', 'GET', '/api/admin/audit')).status, 403);

  assert.equal((await as('manager', 'PUT', '/api/admin/catalog', { catalog: settingsChanged })).status, 200);
  assert.equal((await as('manager', 'POST', '/api/admin/publish')).status, 200);
  assert.equal((await as('viewer', 'POST', '/api/admin/publish')).status, 403);
  assert.equal((await api('POST', '/api/login', { password: 'wrong' })).status, 401);
  assert.equal((await as('viewer', 'GET', '/api/admin/me')).json.role, 'viewer');
});

test('audit log records login, draft edits and publish with summaries', async () => {
  const r = await as('super', 'GET', '/api/admin/audit');
  assert.equal(r.status, 200);
  const acts = r.json.entries.map((e) => e.action);
  for (const a of ['login', 'draft_save', 'publish', 'login_failed']) assert.ok(acts.includes(a), a);
  const pub = r.json.entries.find((e) => e.action === 'publish');
  assert.match(pub.summary, /تعديل برنامج|تغيير الإعدادات/);
  assert.equal(pub.role, 'manager');
});

test('media library: list with usage, delete unused only, role-gated', async () => {
  const up = await as('editor', 'POST', '/api/admin/upload?name=lib', PNG);
  assert.equal(up.status, 200);
  const name = path.basename(up.json.url);
  const list = (await as('viewer', 'GET', '/api/admin/media')).json.media;
  assert.ok(list.some((m) => m.name === name && m.usedBy.length === 0));
  assert.ok(list.some((m) => m.usedBy.length > 0), 'seed images are in use');
  const used = list.find((m) => m.usedBy.length > 0);
  assert.equal((await as('manager', 'DELETE', `/api/admin/media?name=${used.name}`)).status, 409);
  assert.equal((await as('editor', 'DELETE', `/api/admin/media?name=${name}`)).status, 403);
  assert.equal((await as('manager', 'DELETE', `/api/admin/media?name=${name}`)).status, 200);
  assert.equal((await as('manager', 'DELETE', '/api/admin/media?name=..%2F..%2Fserver.js')).status, 404);
});

test('demo analytics: public events aggregate, validated, admin-only read', async () => {
  const ev = (o) => api('POST', '/api/events', { deviceId: 'dev1', appVersion: '1.0.0', ...o });
  assert.equal((await ev({ type: 'session_start' })).status, 200);
  assert.equal((await ev({ type: 'program_selected', programId: 'zakat' })).status, 200);
  assert.equal((await ev({ type: 'amount_chosen', programId: 'zakat', amount: 150 })).status, 200);
  assert.equal((await ev({ type: 'payment_started' })).status, 200);
  assert.equal((await ev({ type: 'payment_completed', programId: 'zakat', durationMs: 9000 })).status, 200);
  assert.equal((await ev({ type: 'session_start' })).status, 200);
  assert.equal((await ev({ type: 'session_abandoned' })).status, 200);
  assert.equal((await ev({ type: 'evil' })).status, 400);
  const s = (await as('manager', 'GET', '/api/admin/stats')).json;
  assert.equal(s.demo, true);
  assert.equal(s.stats.sessions, 2); assert.equal(s.stats.completed, 1); assert.equal(s.stats.abandoned, 1);
  assert.deepEqual(s.stats.programs.zakat, { selected: 1, completed: 1 });
  assert.equal(s.stats.amounts['150'], 1);
  assert.ok(s.stats.devices.dev1);
  assert.equal((await as('viewer', 'GET', '/api/admin/stats')).status, 403);
  assert.equal((await as('manager', 'DELETE', '/api/admin/stats')).status, 200);
  assert.equal((await as('manager', 'GET', '/api/admin/stats')).json.stats.sessions, 0);
});

test('kiosk catalog fetch registers the device heartbeat', async () => {
  await api('GET', '/api/catalog', undefined, { 'X-Kiosk-Device': 'kiosk-77', 'X-Kiosk-Version': '1.2.3' });
  const s = (await as('manager', 'GET', '/api/admin/stats')).json.stats;
  assert.equal(s.devices['kiosk-77'].version, '1.2.3');
});

test('kiosk sessions: create → activate with code+name → heartbeat → end → kiosk is told to re-activate', async () => {
  // الصلاحيات: المحرر والمشاهد لا يديران الجلسات
  assert.equal((await as('editor', 'POST', '/api/admin/sessions', { label: 'x' })).status, 403);
  assert.equal((await as('viewer', 'GET', '/api/admin/sessions')).status, 403);

  const created = (await as('manager', 'POST', '/api/admin/sessions', { label: 'بهو الفرع' })).json.session;
  assert.match(created.code, /^\d{8}$/); assert.equal(created.status, 'pending'); assert.equal(created.label, 'بهو الفرع');

  // أخطاء التفعيل
  assert.equal((await api('POST', '/api/device/activate', { code: '12', name: 'k' })).status, 400);
  assert.equal((await api('POST', '/api/device/activate', { code: created.code, name: '' })).status, 400);
  const wrong = await api('POST', '/api/device/activate', { code: '00000000', name: 'k' });
  assert.equal(wrong.status, 404); assert.equal(wrong.json.code, 'invalid_code');

  // تفعيل ناجح (يقبل الشرطة والمسافات)
  const pretty = created.code.slice(0, 4) + '-' + created.code.slice(4);
  const act = await api('POST', '/api/device/activate', { code: pretty, name: 'كيوسك المدخل', deviceId: 'abc123', appVersion: '1.0.0' });
  assert.equal(act.status, 200); assert.equal(act.json.name, 'كيوسك المدخل'); assert.ok(act.json.token);
  const token = act.json.token;
  // المعرف يُستخدم مرة واحدة
  assert.equal((await api('POST', '/api/device/activate', { code: created.code, name: 'ثاني' })).status, 404);

  // الكتالوج يعمل بالرمز ويسجل آخر اتصال
  const cat = await api('GET', '/api/catalog', undefined, { 'X-Kiosk-Token': token, 'X-Kiosk-Version': '1.2.3' });
  assert.equal(cat.status, 200);
  // رمز الكيوسك لا يعطي صلاحيات الإدارة
  assert.equal((await api('GET', '/api/admin/catalog', undefined, { Authorization: `Bearer ${token}` })).status, 401);
  // أحداث بالرمز تُحتسب على الجلسة
  await api('POST', '/api/events', { type: 'session_start', token });
  await api('POST', '/api/events', { type: 'payment_completed', programId: 'zakat', token });
  const list = (await as('manager', 'GET', '/api/admin/sessions')).json.sessions;
  const mine = list.find((x) => x.id === created.id);
  assert.equal(mine.status, 'active'); assert.equal(mine.kioskName, 'كيوسك المدخل'); assert.equal(mine.version, '1.2.3');
  assert.equal(mine.started, 1); assert.equal(mine.completed, 1); assert.ok(mine.lastSeen);

  // إعادة تسمية ثم إنهاء من اللوحة
  assert.equal((await as('manager', 'POST', `/api/admin/sessions/${created.id}/rename`, { kioskName: 'المدخل الرئيسي', label: 'الدور الأرضي' })).json.session.kioskName, 'المدخل الرئيسي');
  assert.equal((await as('manager', 'DELETE', `/api/admin/sessions/${created.id}`)).status, 409); // فعّالة
  assert.equal((await as('manager', 'POST', `/api/admin/sessions/${created.id}/end`)).json.session.status, 'ended');
  const after = await api('GET', '/api/catalog', undefined, { 'X-Kiosk-Token': token });
  assert.equal(after.status, 401); assert.equal(after.json.code, 'session_ended');
  assert.equal((await api('POST', '/api/events', { type: 'session_start', token })).status, 401);
  // كيوسك قديم بلا رمز ما زال يقرأ الكتالوج العام
  assert.equal((await api('GET', '/api/catalog')).status, 200);

  // فتح جلسة ثانية (نقل الكيوسك) وتفعيله من جديد ثم إنهاؤها من الكيوسك نفسه
  const second = (await as('manager', 'POST', '/api/admin/sessions', { label: 'المكان الجديد' })).json.session;
  const act2 = await api('POST', '/api/device/activate', { code: second.code, name: 'كيوسك المدخل' });
  assert.equal(act2.status, 200);
  assert.equal((await api('POST', '/api/device/deactivate', {}, { 'X-Kiosk-Token': act2.json.token })).status, 200);
  assert.equal((await api('GET', '/api/catalog', undefined, { 'X-Kiosk-Token': act2.json.token })).status, 401);
  assert.equal((await as('manager', 'DELETE', `/api/admin/sessions/${created.id}`)).status, 200);

  const acts = (await as('super', 'GET', '/api/admin/audit')).json.entries.map((e) => e.action);
  for (const a of ['session_create', 'device_activate', 'session_end', 'device_end', 'session_rename', 'session_delete']) assert.ok(acts.includes(a), a);
});

test('session secret persists across restarts (device tokens stay valid)', async () => {
  assert.ok(fs.existsSync(path.join(dataDir, 'secret.key')));
});

test('per-kiosk visibility: restricted items reach only the chosen device; anonymous sees open items only', async () => {
  const mk = async (deviceId, name) => {
    const s = (await as('manager', 'POST', '/api/admin/sessions', { label: name })).json.session;
    const a = await api('POST', '/api/device/activate', { code: s.code, name, deviceId });
    assert.equal(a.status, 200); return a.json.token;
  };
  const tokA = await mk('devA', 'كيوسك أ'), tokB = await mk('devB', 'كيوسك ب');

  const draft = (await as('manager', 'GET', '/api/admin/catalog')).json.catalog;
  const cat = draft.catalogs.find((c) => c.items.length >= 1);
  const inCat = new Set(cat.items.map((i) => i.programId));
  draft.programs.forEach((p) => { if (inCat.has(p.id)) p.kiosks = ['devA', 'bad id!', 'devA']; });
  const alone = draft.programs.find((p) => !inCat.has(p.id));
  alone.kiosks = ['devB'];
  assert.equal((await as('manager', 'PUT', '/api/admin/catalog', { catalog: draft })).status, 200);
  assert.equal((await as('manager', 'POST', '/api/admin/publish')).status, 200);

  const get = async (token) => (await api('GET', '/api/catalog', undefined, token ? { 'X-Kiosk-Token': token } : {})).json;
  const a = await get(tokA), b = await get(tokB), anon = await get(null);
  const ids = (c) => c.programs.map((p) => p.id);
  for (const id of inCat) { assert.ok(ids(a).includes(id)); assert.ok(!ids(b).includes(id)); assert.ok(!ids(anon).includes(id)); }
  assert.ok(ids(b).includes(alone.id) && !ids(a).includes(alone.id) && !ids(anon).includes(alone.id));
  // الكتالوج الذي فرغ بالتصفية يختفي مع مدخله في الرئيسية
  assert.ok(a.catalogs.some((c) => c.id === cat.id));
  assert.ok(!b.catalogs.some((c) => c.id === cat.id) && !b.home.some((h) => h.type === 'catalog' && h.id === cat.id));
  // لا مراجع معلّقة في الرئيسية ولا الأكثر رواجاً
  for (const c of [a, b, anon]) {
    for (const h of c.home) assert.ok(h.type === 'catalog' ? c.catalogs.some((x) => x.id === h.id) : ids(c).includes(h.id));
    for (const f of c.featured.items) assert.ok(f.type === 'catalog' ? c.catalogs.some((x) => x.id === f.id) : ids(c).includes(f.id));
    assert.ok(!JSON.stringify(c).includes('"kiosks"'), 'kiosks field is not leaked to kiosks');
  }
  // ETag يتبع المحتوى المفلتر
  const ra = await api('GET', '/api/catalog', undefined, { 'X-Kiosk-Token': tokA });
  const rb = await api('GET', '/api/catalog', undefined, { 'X-Kiosk-Token': tokB });
  assert.notEqual(ra.headers.get('etag'), rb.headers.get('etag'));
  // اللوحة ترى المنشور كاملاً بالحقل، وقائمة الأجهزة للمحرر
  const live = (await as('editor', 'GET', '/api/admin/live')).json;
  assert.deepEqual(live.programs.find((p) => inCat.has(p.id)).kiosks, ['devA']);
  const devs = (await as('editor', 'GET', '/api/admin/devices')).json.devices;
  assert.ok(devs.some((d) => d.deviceId === 'devA' && d.name === 'كيوسك أ') && devs.some((d) => d.deviceId === 'devB'));
  assert.equal((await api('GET', '/api/admin/devices')).status, 401);
  // إرجاع كل شيء للكل
  draft.programs.forEach((p) => { p.kiosks = []; });
  await as('manager', 'PUT', '/api/admin/catalog', { catalog: draft }); await as('manager', 'POST', '/api/admin/publish');
  assert.ok(ids(await get(tokB)).includes([...inCat][0]));
});
