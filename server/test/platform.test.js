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
  return { status: res.status, json };
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
