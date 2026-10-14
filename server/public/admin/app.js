/* =====================================================================
   لوحة تحكم كيوسك هدية — app.js
   واجهة أمامية فقط (Vanilla JS). كل الوصول إلى البيانات يمر عبر كائن `backend`.
   يمكن حقن backend بديل (مثلاً تجريبي) عبر window.HD_BACKEND قبل تحميل هذا الملف.
   ===================================================================== */
'use strict';

/* ---------- أدوات عامة ---------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
// تهريب النص قبل حقنه في HTML (حماية من XSS المخزّن عبر العناوين)
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const nf = (n) => Number(n).toLocaleString('en-US');
const clone = (o) => JSON.parse(JSON.stringify(o));
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const LANGS = [
  { k: 'ar', name: 'العربية', dir: 'rtl' },
  { k: 'fr', name: 'Français', dir: 'ltr' },
  { k: 'en', name: 'English', dir: 'ltr' },
  { k: 'ur', name: 'اردو', dir: 'rtl' },
];
const SIZES = ['small', 'medium', 'large'];
const UNITS = { small: 2, medium: 3, large: 6 };          // سعة الصف = 6 وحدات
const SIZE_LABEL = { small: 'صغير', medium: 'متوسط', large: 'كبير' };
const SIZE_HINT = { small: 'ثلث العرض', medium: 'نصف العرض', large: 'العرض كاملاً' };
const KIND_LABEL = { open: 'مبلغ يختاره المتبرع', presets: 'مبالغ محددة', fixed: 'قيمة ثابتة' };
const ALIGN_LABEL = { center: 'وسط', top: 'أعلى', bottom: 'أسفل' };
const ID_RE = /^[a-z0-9][a-z0-9_-]{0,39}$/;
const MAX_UPLOAD = 6 * 1024 * 1024;

/* أيقونات SVG بسيطة (stroke) */
const ICONS = {
  plus: 'M12 5v14M5 12h14', x: 'M18 6L6 18M6 6l12 12', up: 'M6 15l6-6 6 6', down: 'M6 9l6 6 6-6',
  trash: 'M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6',
  copy: 'M9 9h11v11H9zM5 15H4V4h11v1', edit: 'M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z',
  grip: 'M9 5h.01M9 12h.01M9 19h.01M15 5h.01M15 12h.01M15 19h.01',
  upload: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12',
  download: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3',
  home: 'M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10', grid: 'M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z',
  folder: 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
  gear: 'M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6',
  cloud: 'M16 16l-4-4-4 4M12 12v9M20.4 18.4A5 5 0 0 0 18 9h-1.3A8 8 0 1 0 4 16.3',
  check: 'M20 6L9 17l-5-5', logout: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
  search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3',
  alert: 'M12 9v4M12 17h.01M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z',
  image: 'M3 5h18v14H3zM8.5 10a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3M21 15l-5-5L5 19',
  clock: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 6v6l4 2',
};
const ic = (n, cls = '') => `<svg class="ic ${cls}" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${ICONS[n]}"/></svg>`;

/* =====================================================================
   1) backend — الطبقة الوحيدة التي تتصل بالبيانات
   الواجهة (كلها async عدا resolveImage):
     kind, login(pw), load(), save(catalog), publish(), history(), restore(id),
     upload(file), fetchLive(), resolveImage(url)
   ===================================================================== */
const PLACEHOLDER = 'data:image/svg+xml,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 90"><rect width="120" height="90" fill="#dfe8e7"/><g fill="none" stroke="#8aa3a0" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><rect x="38" y="28" width="44" height="34" rx="4"/><circle cx="51" cy="40" r="4"/><path d="M82 54l-12-12-22 20"/></g></svg>');
const ASSET_PLACEHOLDER = 'data:image/svg+xml,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 90"><rect width="120" height="90" fill="#cfe6e3"/><g fill="none" stroke="#5c8a85" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><rect x="38" y="22" width="44" height="34" rx="4"/><circle cx="51" cy="34" r="4"/><path d="M82 48l-12-12-22 20"/></g><text x="60" y="76" font-size="9" text-anchor="middle" fill="#3f6a65" font-family="sans-serif">صورة داخل التطبيق</text></svg>');

const serverBackend = {
  kind: 'server',
  _tk() { try { return sessionStorage.getItem('hd_token') || ''; } catch (e) { return this._mem || ''; } },
  _setTk(t) { this._mem = t; try { t ? sessionStorage.setItem('hd_token', t) : sessionStorage.removeItem('hd_token'); } catch (e) { /* مسموح */ } },
  hasSession() { return !!this._tk(); },
  logout() { this._setTk(''); },
  async _req(path, opt = {}) {
    const headers = Object.assign({}, opt.headers);
    if (opt.auth !== false) headers.Authorization = 'Bearer ' + this._tk();
    let res;
    try { res = await fetch(path, Object.assign({}, opt, { headers })); }
    catch (e) { const er = new Error('تعذّر الاتصال بالخادم'); er.network = true; throw er; }
    let data = null;
    try { data = await res.json(); } catch (e) { /* لا جسم */ }
    if (!res.ok) {
      const er = new Error((data && data.error) || 'خطأ ' + res.status);
      er.status = res.status; if (data && data.errors) er.errors = data.errors; if (data && data.warnings) er.warnings = data.warnings;
      throw er;
    }
    return data;
  },
  async login(password) {
    const d = await this._req('/api/login', { method: 'POST', auth: false, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) });
    this._setTk(d.token); return true;
  },
  async load() { const d = await this._req('/api/admin/catalog'); return { catalog: d.catalog, hasUnpublished: !!d.hasUnpublished }; },
  async save(catalog) {
    const d = await this._req('/api/admin/catalog', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ catalog }) });
    return { catalog: d.catalog, warnings: d.warnings || [], hasUnpublished: !!d.hasUnpublished };
  },
  async publish() { const d = await this._req('/api/admin/publish', { method: 'POST' }); return { warnings: d.warnings || [] }; },
  async history() { const d = await this._req('/api/admin/history'); return d.history || []; },
  async restore(id) { const d = await this._req('/api/admin/restore', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) }); return { catalog: d.catalog }; },
  async upload(file) {
    const d = await this._req('/api/admin/upload?name=' + encodeURIComponent(file.name || 'image'), { method: 'POST', headers: { 'Content-Type': file.type || 'application/octet-stream' }, body: file });
    return d.url;
  },
  async fetchLive() { return this._req('/api/catalog', { auth: false, cache: 'no-store' }); },
  resolveImage(url) {
    if (!url) return PLACEHOLDER;
    if (/^asset:/.test(url)) return ASSET_PLACEHOLDER;   // لا معاينة ويب لصور التطبيق المضمّنة
    return url;
  },
};
const backend = window.HD_BACKEND || serverBackend;
const imgSrc = (u) => { try { return backend.resolveImage(u) || PLACEHOLDER; } catch (e) { return PLACEHOLDER; } };

/* =====================================================================
   2) الحالة
   ===================================================================== */
const state = {
  catalog: null, hasUnpublished: false, warnings: [],
  dirty: false, rev: 0, saving: false, saveStatus: 'idle', failed: false, savePromise: null,
};
const ui = {
  tab: 'home', q: '', pvLang: 'ar', edit: null, drag: null,
  live: null, hist: null, histErr: '', pubBusy: false, restoreBusy: false,
};
let saveTimer = null;

const TABS = [
  { k: 'home', label: 'الصفحة الرئيسية', icon: 'home' },
  { k: 'programs', label: 'البرامج', icon: 'grid' },
  { k: 'catalogs', label: 'الكتالوجات', icon: 'folder' },
  { k: 'settings', label: 'الإعدادات', icon: 'gear' },
  { k: 'publish', label: 'النشر والنسخ', icon: 'cloud' },
];

/* ---------- وصول إلى الكيانات ---------- */
const C = () => state.catalog;
const findProg = (id) => C().programs.find((p) => p.id === id);
const findCat = (id) => C().catalogs.find((c) => c.id === id);
const tt = (o, lang = 'ar') => (o && o.title && (o.title[lang] || o.title.ar)) || (o && o.id) || '';
const blankLoc = () => ({ ar: '', fr: '', en: '', ur: '' });

function getPath(o, path) { return path.split('.').reduce((a, k) => (a == null ? a : a[k]), o); }
function setPath(o, path, v) { const ks = path.split('.'); const last = ks.pop(); const t = ks.reduce((a, k) => a[k], o); t[last] = v; }

/* الكيان الذي يعدّله المحرّر / الإعدادات حسب السياق */
function ctxObj(ctx) {
  if (ctx === 'set') return C().settings;
  const e = ui.edit; if (!e) return null;
  if (ctx === 'prog' && e.type === 'prog') return e.creating ? e.obj : findProg(e.id);
  if (ctx === 'cat' && e.type === 'cat') return e.creating ? e.obj : findCat(e.id);
  return null;
}
const editing = () => ctxObj(ui.edit && ui.edit.type);

/* =====================================================================
   3) التحقق (يعكس validate.js)
   ===================================================================== */
function progErrors(p, S, otherIds) {
  const e = {};
  if (!ID_RE.test(p.id || '')) e.id = 'المعرّف: أحرف إنجليزية صغيرة وأرقام و - و _ فقط (حتى 40 حرفاً، يبدأ بحرف أو رقم)';
  else if (otherIds.includes(p.id)) e.id = 'هذا المعرّف مستخدم في برنامج آخر';
  if (!String(p.title.ar || '').trim()) e['title.ar'] = 'العنوان العربي مطلوب';
  const num = (v, d) => (v === '' || v == null ? d : Number(v));
  if (p.kind === 'fixed' && !(num(p.price, 0) >= 1)) e.price = 'القيمة الثابتة يجب أن تكون 1 أو أكثر';
  const mn = num(p.minAmount, 1), mx = num(p.maxAmount, S.maxAmount);
  if (mn < 1) e.minAmount = 'الحد الأدنى 1 على الأقل';
  if (mx < mn) e.maxAmount = 'الحد الأعلى يجب ألا يقل عن الحد الأدنى';
  if (p.kind === 'fixed' && p.allowQuantity) {
    const mq = num(p.maxQuantity, 99); if (!(mq >= 1 && mq <= 999)) e.maxQuantity = 'أقصى كمية بين 1 و 999';
  }
  return e;
}
function catErrors(c, otherIds) {
  const e = {};
  if (!ID_RE.test(c.id || '')) e.id = 'المعرّف: أحرف إنجليزية صغيرة وأرقام و - و _ فقط (حتى 40 حرفاً، يبدأ بحرف أو رقم)';
  else if (otherIds.includes(c.id)) e.id = 'هذا المعرّف مستخدم في كتالوج آخر';
  if (!String(c.title.ar || '').trim()) e['title.ar'] = 'العنوان العربي مطلوب';
  return e;
}
function settingsErrors(s) {
  const e = {};
  const rng = (k, a, b, label) => { const v = s[k]; if (!(isNum(v) && v >= a && v <= b)) e[k] = `${label}: قيمة بين ${nf(a)} و ${nf(b)}`; };
  rng('idleSeconds', 10, 600, 'مهلة الخمول'); rng('warnSeconds', 5, 120, 'مهلة التنبيه'); rng('maxAmount', 1, 9999999, 'أقصى مبلغ');
  if (!s.quickAmounts.length) e.quickAmounts = 'أضف مبلغاً سريعاً واحداً على الأقل (حتى 8)';
  else if (isNum(s.maxAmount) && s.quickAmounts.some((n) => n > s.maxAmount)) e.quickAmounts = 'بعض المبالغ السريعة أكبر من أقصى مبلغ';
  return e;
}
/* قائمة أخطاء شاملة تمنع الحفظ */
function validateCatalog(c) {
  const out = [];
  const se = settingsErrors(c.settings); Object.values(se).forEach((m) => out.push({ msg: 'الإعدادات — ' + m }));
  const seen = new Set();
  c.programs.forEach((p) => {
    const others = c.programs.filter((x) => x !== p).map((x) => x.id);
    Object.values(progErrors(p, c.settings, others)).forEach((m) => out.push({ msg: `البرنامج «${tt(p)}» — ${m}` }));
    seen.add(p.id);
  });
  c.catalogs.forEach((k) => {
    const others = c.catalogs.filter((x) => x !== k).map((x) => x.id);
    Object.values(catErrors(k, others)).forEach((m) => out.push({ msg: `الكتالوج «${tt(k)}» — ${m}` }));
  });
  return out;
}
/* حمولة الإرسال: تحويل الحقول الفارغة إلى القيم الافتراضية */
function toPayload() {
  const c = clone(C());
  c.programs.forEach((p) => {
    p.price = p.price === '' ? 0 : p.price;
    p.minAmount = p.minAmount === '' ? 1 : p.minAmount;
    p.maxAmount = p.maxAmount === '' ? c.settings.maxAmount : p.maxAmount;
    p.maxQuantity = p.maxQuantity === '' ? 99 : p.maxQuantity;
  });
  return c;
}

/* =====================================================================
   4) الحفظ التلقائي
   ===================================================================== */
function markDirty(now) {
  state.rev++; state.dirty = true; state.failed = false;
  setSave('pending'); clearTimeout(saveTimer);
  saveTimer = setTimeout(flushSave, now ? 0 : 700);
}
function setSave(s) { state.saveStatus = s; updateChrome(); }

async function flushSave() {
  clearTimeout(saveTimer); saveTimer = null;
  if (state.saving) return state.savePromise;
  if (!state.dirty) return true;
  const errs = validateCatalog(C());
  if (errs.length) {
    state.failed = true;
    showErrors(errs.map((e) => e.msg), 'لن تُحفظ تعديلاتك حتى تُصحَّح الأخطاء التالية (تعديلاتك ما زالت هنا ولم تضع)');
    setSave('failed'); return false;
  }
  state.saving = true; const rev = state.rev; setSave('saving');
  state.savePromise = (async () => {
    let ok = false;
    try {
      const res = await backend.save(toPayload());
      if (rev === state.rev) { state.catalog = res.catalog; state.dirty = false; }
      state.hasUnpublished = res.hasUnpublished; state.warnings = res.warnings || [];
      state.failed = false; hideErrors(); ok = true;
      setSave(state.dirty ? 'pending' : 'saved');
    } catch (e) {
      state.failed = true; setSave('failed');
      if (e.status === 401) { showLogin('انتهت الجلسة، أعد تسجيل الدخول — لن تضيع تعديلاتك.'); }
      else if (e.errors) showErrors(e.errors, 'رفض الخادم الحفظ — صحّح ما يلي (تعديلاتك ما زالت هنا)');
      else { showErrors([e.message || 'تعذّر الحفظ'], 'تعذّر الحفظ — تعديلاتك ما زالت هنا وسنعيد المحاولة تلقائياً', true); saveTimer = setTimeout(flushSave, 6000); }
    } finally {
      state.saving = false;
      if (ok && state.dirty && !saveTimer) saveTimer = setTimeout(flushSave, 50);
      updateChrome();
    }
    return ok;
  })();
  return state.savePromise;
}
async function settleSaves() { clearTimeout(saveTimer); saveTimer = null; if (state.saving) await state.savePromise; return flushSave(); }

window.addEventListener('beforeunload', (e) => {
  if (state.dirty && (state.saveStatus === 'pending' || state.saveStatus === 'saving' || state.saveStatus === 'failed')) { e.preventDefault(); e.returnValue = ''; }
});

/* =====================================================================
   5) الواجهة العامة: الشريط العلوي، الإشعارات، الأخطاء، الحوارات
   ===================================================================== */
function updateChrome() {
  const pill = $('#pill'), si = $('#saveInd');
  if (!pill) return;
  let cls = 'ok', txt = 'منشور';
  if (state.dirty) { cls = 'warn'; txt = 'تغييرات غير منشورة'; }
  else if (state.hasUnpublished) { cls = 'info'; txt = 'مسودة محفوظة'; }
  pill.className = 'pill ' + cls; pill.textContent = txt;
  const m = { idle: ['', ''], pending: ['pending', 'تعديلات بانتظار الحفظ…'], saving: ['saving', 'جارٍ الحفظ…'], saved: ['saved', 'تم الحفظ ✓'], failed: ['failed', 'تعذّر الحفظ'] }[state.saveStatus];
  si.className = 'saveind ' + m[0]; si.textContent = m[1];
  const pb = $('#btnPublish'); if (pb) { pb.disabled = ui.pubBusy; pb.innerHTML = ic('cloud') + '<span>نشر التغييرات</span>'; }
}
function toast(msg, kind = 'ok') {
  const t = document.createElement('div'); t.className = 'toast ' + kind; t.textContent = msg;
  $('#toasts').appendChild(t); setTimeout(() => t.classList.add('out'), 3200); setTimeout(() => t.remove(), 3700);
}
const announce = (m) => { const l = $('#live'); l.textContent = ''; setTimeout(() => { l.textContent = m; }, 30); };

function showErrors(list, title, retry) {
  const uniq = [...new Set(list)];
  $('#errPanel').innerHTML = `<div class="errpanel" role="alert"><div class="errpanel-h">${ic('alert')}<strong>${esc(title || 'حدثت أخطاء')}</strong>
    <span class="sp"></span>${retry ? '<button class="btn small" data-act="retry-save" type="button">إعادة المحاولة</button>' : ''}
    <button class="icon-btn" data-act="dismiss-err" type="button" aria-label="إخفاء">${ic('x')}</button></div>
    <ul>${uniq.map((e) => `<li>${esc(e)}</li>`).join('')}</ul></div>`;
}
const hideErrors = () => { $('#errPanel').innerHTML = ''; };

function confirmDlg(msg, okLabel = 'موافق', danger = false) {
  return new Promise((res) => {
    const d = $('#dlg'); $('#dlgMsg').textContent = msg;
    const y = $('#dlgYes'); y.textContent = okLabel; y.className = 'btn ' + (danger ? 'danger' : 'primary');
    const done = () => { d.removeEventListener('close', done); res(d.returnValue === 'yes'); };
    d.returnValue = ''; d.addEventListener('close', done);
    d.showModal(); $('#dlgNo').focus();
  });
}

/* ---------- صور مصغّرة وأدوات صغيرة ---------- */
const POS = { center: '50% 50%', top: '50% 0%', bottom: '50% 100%' };
const imgTag = (url, align, cls = '') => `<img class="${cls}" src="${esc(imgSrc(url))}" alt="" loading="lazy" style="object-position:${POS[align] || POS.center}">`;
const badge = (txt, cls = '') => `<span class="badge ${cls}">${esc(txt)}</span>`;
function slug(s) { return String(s || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40).replace(/-+$/g, ''); }
const rnd = (pre) => pre + '-' + Math.random().toString(36).slice(2, 6).padEnd(4, '0');
function uniqueId(base, list) { let id = base, n = 2; while (list.some((x) => x.id === id)) id = (base + '-' + n++).slice(0, 40); return id; }

/* =====================================================================
   6) الرصّ (Packing) — مطابق للتطبيق: سعة الصف 6 وحدات
   ===================================================================== */
function pack(tiles) {
  const rows = []; let cur = [], used = 0;
  for (const t of tiles) {
    const u = UNITS[t.size] || 3;
    if (used + u > 6 && cur.length) { rows.push(cur); cur = []; used = 0; }
    cur.push(t); used += u;
  }
  if (cur.length) rows.push(cur);
  return rows;
}

function tileHtml(t, lang) {
  const o = t.obj;
  const title = tt(o, lang);
  const catBadge = t.type === 'catalog' ? `<span class="pv-badge">${ic('folder')}${nf(t.count)}</span>` : '';
  return `<div class="tile s-${esc(t.size)}" style="grid-column:span ${UNITS[t.size]}" data-tile="${esc(t.type)}:${esc(o.id)}">
    <div class="timg">${imgTag(o.image, o.imageAlign)}${catBadge}</div><div class="ttl"><span>${esc(title)}</span></div></div>`;
}
function rowsHtml(tiles, lang) {
  if (!tiles.length) return '<p class="pv-empty">لا توجد عناصر ظاهرة</p>';
  return pack(tiles).map((r) => `<div class="pv-row">${r.map((t) => tileHtml(t, lang)).join('')}</div>`).join('');
}
/* عناصر الرئيسية كما يراها المتبرع (المفعّلة فقط) */
function homeTiles() {
  const out = [];
  for (const h of C().home) {
    if (h.type === 'program') { const p = findProg(h.id); if (p && p.active) out.push({ type: 'program', obj: p, size: h.size }); }
    else { const c = findCat(h.id); if (c && c.active) out.push({ type: 'catalog', obj: c, size: h.size, count: c.items.filter((i) => { const p = findProg(i.programId); return p && p.active; }).length }); }
  }
  return out;
}
function catTiles(c) {
  return c.items.map((i) => ({ i, p: findProg(i.programId) })).filter((x) => x.p && x.p.active).map((x) => ({ type: 'program', obj: x.p, size: x.i.size }));
}
function langSwitch() {
  return `<div class="seg pv-lang" role="group" aria-label="لغة المعاينة">${LANGS.map((l) => `<button type="button" data-act="pv-lang" data-v="${l.k}" aria-pressed="${ui.pvLang === l.k}">${l.name}</button>`).join('')}</div>`;
}
function phone(inner, lang) {
  const L = LANGS.find((l) => l.k === lang);
  return `<div class="phone" dir="${L.dir}" lang="${lang}"><div class="pv-screen">${inner}</div></div>`;
}
function homePreview() {
  const lang = ui.pvLang, S = C().settings;
  const title = S.homeTitle[lang] || S.homeTitle.ar, sub = S.homeSubtitle[lang] || S.homeSubtitle.ar;
  const head = `<div class="pv-head"><h4>${title ? esc(title) : '<span class="muted">(العنوان الافتراضي للتطبيق)</span>'}</h4>${sub ? `<p>${esc(sub)}</p>` : ''}</div>`;
  return `<div class="pv-box"><div class="pv-top"><strong>معاينة صفحة المتبرع</strong>${langSwitch()}</div>${phone(head + `<div class="pv-grid" id="pvHomeGrid">${rowsHtml(homeTiles(), lang)}</div>`, lang)}
    <p class="hint center">المعاينة تقريبية: كل بطاقة تأخذ ثلث/نصف/كامل عرض الصفحة وتُرصّ كما في التطبيق.</p></div>`;
}
function catPreview(c) {
  const lang = ui.pvLang;
  const sub = c.subtitle && (c.subtitle[lang] || c.subtitle.ar);
  const banner = `<div class="pv-banner">${imgTag(c.image, c.imageAlign)}<div class="pv-banner-t"><h4>${esc(tt(c, lang))}</h4>${sub ? `<p>${esc(sub)}</p>` : ''}</div></div>`;
  return `<div class="pv-box"><div class="pv-top"><strong>معاينة صفحة الكتالوج</strong>${langSwitch()}</div>${phone(banner + `<div class="pv-grid">${rowsHtml(catTiles(c), lang)}</div>`, lang)}</div>`;
}

/* =====================================================================
   7) مكوّنات مشتركة: مفتاح التفعيل، مقسّم الأحجام، حقول متعددة اللغات
   ===================================================================== */
const sizeSeg = (attrs, cur, disabled) => `<div class="seg size-seg" role="group" aria-label="حجم البطاقة">${SIZES.map((s) =>
  `<button type="button" ${attrs} data-v="${s}" title="${SIZE_HINT[s]}" aria-pressed="${cur === s}" ${disabled ? 'disabled' : ''}><i class="sz sz-${s}" aria-hidden="true"></i>${SIZE_LABEL[s]}</button>`).join('')}</div>`;
const toggle = (attrs, on, label) => `<label class="switch"><input type="checkbox" role="switch" ${attrs} ${on ? 'checked' : ''}><span class="sw" aria-hidden="true"></span><span class="swl">${esc(label)}</span></label>`;

function locFields(ctx, base, label, opts = {}) {
  const o = ctxObj(ctx);
  return `<fieldset class="loc"><legend>${esc(label)}</legend>${LANGS.map((l) => {
    const id = `f-${ctx}-${base}-${l.k}`;
    const req = opts.arRequired && l.k === 'ar';
    return `<div class="field"><label for="${id}">${l.name}${req ? ' <b class="req" title="مطلوب">*</b>' : ''}</label>
      <input id="${id}" type="text" dir="${l.dir}" lang="${l.k}" data-ctx="${ctx}" data-f="${base}.${l.k}" value="${esc(getPath(o, base + '.' + l.k) || '')}" ${opts.ph ? `placeholder="${esc(opts.ph)}"` : ''} autocomplete="off">
      ${req ? `<div class="err" data-err="${base}.ar"></div>` : ''}</div>`;
  }).join('')}</fieldset>`;
}
const numField = (ctx, f, label, val, extra = {}) => `<div class="field ${extra.cls || ''}"><label for="f-${ctx}-${f}">${label}</label>
  <input id="f-${ctx}-${f}" type="number" inputmode="numeric" min="${extra.min ?? 0}" ${extra.max ? `max="${extra.max}"` : ''} data-ctx="${ctx}" data-f="${f}" value="${val === '' || val == null || (extra.blank0 && val === 0) ? '' : esc(val)}" ${extra.ph ? `placeholder="${esc(extra.ph)}"` : ''}>
  ${extra.hint ? `<p class="hint">${extra.hint}</p>` : ''}<div class="err" data-err="${f}"></div></div>`;

/* محرر الشرائح (chips) للمبالغ: path = "prog:presets" | "set:quickAmounts" */
function chipsHtml(path) {
  const [ctx, f] = path.split(':'); const arr = getPath(ctxObj(ctx), f) || [];
  return `${arr.map((n, i) => `<span class="chip">${nf(n)}<button type="button" data-act="chip-del" data-path="${path}" data-i="${i}" aria-label="حذف ${n}">${ic('x')}</button></span>`).join('') || '<span class="muted small">لا مبالغ</span>'}`;
}
function chipsEditor(path, label, hint) {
  const [ctx, f] = path.split(':');
  return `<div class="field"><label for="chipin-${f}">${label}</label>
    <div class="chips-ed" data-chips="${path}"><div class="chips" data-chiplist>${chipsHtml(path)}</div>
    <div class="chip-add"><input id="chipin-${f}" type="number" min="1" inputmode="numeric" placeholder="أضف مبلغاً" data-chipin="${path}"><button type="button" class="btn small" data-act="chip-add" data-path="${path}">${ic('plus')}إضافة</button></div></div>
    ${hint ? `<p class="hint">${hint}</p>` : ''}<div class="err" data-err="${f}"></div></div>`;
}

/* =====================================================================
   8) منتقي الصورة
   ===================================================================== */
function pickerTarget(pk) {
  if (pk === 'welcome') return { get: () => C().settings.welcomeBackground, set: (v) => { C().settings.welcomeBackground = v; }, align: false, ctx: 'set' };
  const ctx = pk; const o = () => ctxObj(ctx);
  return { get: () => o().image, set: (v) => { o().image = v; }, align: true, getAlign: () => o().imageAlign, setAlign: (v) => { o().imageAlign = v; }, ctx };
}
function imagePicker(pk, opts = {}) {
  const T = pickerTarget(pk); const url = T.get() || '';
  const align = T.align ? T.getAlign() : 'center';
  return `<div class="imgp" data-pk="${pk}" tabindex="0" aria-label="${esc(opts.label || 'الصورة')} — يمكنك رفع صورة أو إفلاتها أو لصقها هنا">
    <div class="imgp-prev"><div class="crop" title="هكذا ستظهر الصورة داخل البطاقة">${url ? imgTag(url, align) : `<div class="noimg">${ic('image')}<span>لا توجد صورة</span></div>`}</div></div>
    <div class="imgp-body">
      <div class="imgp-btns"><button class="btn" type="button" data-act="img-pick">${ic('upload')}رفع صورة</button>
        <button class="btn ghost" type="button" data-act="img-remove" ${url ? '' : 'disabled'}>${ic('trash')}إزالة</button></div>
      <p class="hint">اسحب صورة وأفلتها هنا، أو الصقها (Ctrl+V). يفضّل صورة أفقية 1200×900 فأكثر. (jpg / png / webp حتى 6MB)</p>
      <div class="field slim"><label>رابط الصورة (اختياري)</label><input type="text" dir="ltr" inputmode="url" data-img-url placeholder="https://… أو /uploads/…" value="${esc(url)}"></div>
      ${T.align ? `<div class="field slim"><label>محاذاة الصورة داخل البطاقة</label><div class="seg" role="group">${['top', 'center', 'bottom'].map((a) => `<button type="button" data-act="img-align" data-v="${a}" aria-pressed="${align === a}">${ALIGN_LABEL[a]}</button>`).join('')}</div></div>` : ''}
      <p class="err imgp-err" role="alert"></p><div class="progress" hidden><i></i></div>
    </div><input type="file" hidden accept="image/jpeg,image/png,image/webp" data-img-file></div>`;
}
function refreshPicker(pk) {
  const el = $(`.imgp[data-pk="${pk}"]`); if (!el) return;
  const t = document.createElement('div'); t.innerHTML = imagePicker(pk); el.replaceWith(t.firstElementChild);
}
function imgError(pk, msg) { const el = $(`.imgp[data-pk="${pk}"] .imgp-err`); if (el) el.textContent = msg || ''; }
function applyImage(pk, url) {
  const T = pickerTarget(pk); T.set(url);
  const e = ui.edit; const creating = pk !== 'welcome' && e && e.creating;
  if (!creating) markDirty();
  refreshPicker(pk); refreshRegions();
}
async function handleFile(pk, file) {
  imgError(pk, '');
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return imgError(pk, 'الملف غير مدعوم — اختر صورة jpg أو png أو webp.');
  if (file.size > 25 * 1024 * 1024) return imgError(pk, 'الصورة كبيرة جداً (الحد 6MB بعد الضغط).');
  const box = $(`.imgp[data-pk="${pk}"]`); box.classList.add('busy'); $$('button,input', box).forEach((b) => { b.disabled = true; }); $('.progress', box).hidden = false;
  try {
    let f = await downscale(file);
    if (f.size > MAX_UPLOAD) throw new Error('حجم الصورة يتجاوز 6MB — اختر صورة أصغر.');
    const url = await backend.upload(f);
    applyImage(pk, url); toast('تم رفع الصورة ✓');
  } catch (e) {
    if (e.status === 401) showLogin('انتهت الجلسة، أعد تسجيل الدخول ثم أعد رفع الصورة.');
    const b2 = $(`.imgp[data-pk="${pk}"]`); if (b2) { b2.classList.remove('busy'); $$('button,input', b2).forEach((b) => { b.disabled = false; }); $('.progress', b2).hidden = true; }
    imgError(pk, e.message || 'تعذّر رفع الصورة');
  }
}
/* تصغير الصور الكبيرة (أطول ضلع 1600px) إلى JPEG جودة .9 */
async function downscale(file) {
  let bmp;
  try { bmp = await createImageBitmap(file); } catch (e) { return file; }
  const max = Math.max(bmp.width, bmp.height);
  if (max <= 1600 && file.size <= MAX_UPLOAD) { bmp.close && bmp.close(); return file; }
  const k = Math.min(1, 1600 / max);
  const cv = document.createElement('canvas'); cv.width = Math.round(bmp.width * k); cv.height = Math.round(bmp.height * k);
  const g = cv.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, cv.width, cv.height); g.drawImage(bmp, 0, 0, cv.width, cv.height);
  bmp.close && bmp.close();
  const blob = await new Promise((r) => cv.toBlob(r, 'image/jpeg', 0.9));
  if (!blob) return file;
  return new File([blob], (file.name || 'image').replace(/\.[^.]*$/, '') + '.jpg', { type: 'image/jpeg' });
}

/* =====================================================================
   9) أقسام العرض (Views)
   ===================================================================== */
const regions = {};   // اسم المنطقة -> دالة ترسم HTML

/* ---- أ) الصفحة الرئيسية ---- */
function viewHome() {
  return `<div class="page-h"><div><h2>الصفحة الرئيسية</h2><p class="muted">رتّب ما يراه المتبرع أولاً: برامج مباشرة أو كتالوجات، واختر حجم كل بطاقة.</p></div></div>
  <div class="split"><div class="col-list"><div data-region="homeList"></div></div><div class="col-pv sticky" data-region="homePv"></div></div>`;
}
function entryInfo(list, entry) {
  if (list === 'items') { const p = findProg(entry.programId); return { type: 'program', obj: p, key: 'program:' + entry.programId }; }
  if (entry.type === 'program') return { type: 'program', obj: findProg(entry.id), key: 'program:' + entry.id };
  return { type: 'catalog', obj: findCat(entry.id), key: 'catalog:' + entry.id };
}
function listRows(list, arr) {
  return arr.map((entry, i) => {
    const info = entryInfo(list, entry); const o = info.obj; if (!o) return '';
    const sub = info.type === 'catalog' ? badge(`كتالوج · ${o.items.length} برامج`, 'cat') : badge(KIND_LABEL[o.kind], 'kind');
    return `<li class="row ${o.active ? '' : 'dim'}" data-dnd="${list}" data-i="${i}" draggable="true" data-key="${esc(info.key)}">
      <span class="grip" aria-hidden="true">${ic('grip')}</span>
      <div class="thumb">${imgTag(o.image, o.imageAlign)}</div>
      <div class="row-t"><strong>${esc(tt(o))}</strong><div class="row-sub">${sub}${o.active ? '' : badge('غير مفعّل', 'off')}</div></div>
      ${sizeSeg(`data-act="size" data-list="${list}" data-i="${i}"`, entry.size)}
      <div class="row-btns">
        <button type="button" class="icon-btn" data-act="move" data-list="${list}" data-i="${i}" data-d="-1" aria-label="نقل «${esc(tt(o))}» للأعلى" ${i === 0 ? 'disabled' : ''}>${ic('up')}</button>
        <button type="button" class="icon-btn" data-act="move" data-list="${list}" data-i="${i}" data-d="1" aria-label="نقل «${esc(tt(o))}» للأسفل" ${i === arr.length - 1 ? 'disabled' : ''}>${ic('down')}</button>
        <button type="button" class="icon-btn danger" data-act="remove-entry" data-list="${list}" data-i="${i}" aria-label="إزالة «${esc(tt(o))}» من ${list === 'home' ? 'الرئيسية' : 'الكتالوج'}">${ic('x')}</button>
      </div></li>`;
  }).join('');
}
function hiddenEverywhere() {
  const onHome = new Set(C().home.filter((h) => h.type === 'program').map((h) => h.id));
  const inCat = new Set(); C().catalogs.filter((c) => c.active).forEach((c) => c.items.forEach((i) => inCat.add(i.programId)));
  return C().programs.filter((p) => p.active && !onHome.has(p.id) && !inCat.has(p.id));
}
regions.homeList = () => {
  const home = C().home; const onHome = new Set(home.map((h) => h.type + ':' + h.id));
  const progs = C().programs.filter((p) => !onHome.has('program:' + p.id)), cats = C().catalogs.filter((c) => !onHome.has('catalog:' + c.id));
  const hid = hiddenEverywhere();
  return `${hid.length ? `<div class="warnbox"><div class="wb-h">${ic('alert')}<strong>برامج مفعّلة لكنها غير ظاهرة في أي مكان (${hid.length})</strong></div>
      <div class="chips">${hid.map((p) => `<span class="chip warn">${esc(tt(p))}<button type="button" class="chip-act" data-act="home-add-prog" data-id="${esc(p.id)}">إضافة للرئيسية</button></span>`).join('')}</div></div>` : ''}
    <div class="card"><div class="card-h"><h3>ترتيب البطاقات <span class="count">${home.length}</span></h3></div>
    ${home.length ? `<ul class="rows" data-dnd-list="home">${listRows('home', home)}</ul>` : `<div class="empty">${ic('home')}<strong>الصفحة الرئيسية فارغة</strong><p>أضف برنامجاً أو كتالوجاً ليظهر للمتبرعين.</p></div>`}
    <div class="addbar"><label for="homeAdd" class="sr">اختر عنصراً لإضافته</label>
      <select id="homeAdd" ${progs.length + cats.length ? '' : 'disabled'}>
        ${progs.length + cats.length ? '' : '<option>كل العناصر مضافة</option>'}
        ${progs.length ? `<optgroup label="برامج">${progs.map((p) => `<option value="program:${esc(p.id)}">${esc(tt(p))}${p.active ? '' : ' (غير مفعّل)'}</option>`).join('')}</optgroup>` : ''}
        ${cats.length ? `<optgroup label="كتالوجات">${cats.map((c) => `<option value="catalog:${esc(c.id)}">${esc(tt(c))}${c.active ? '' : ' (غير مفعّل)'}</option>`).join('')}</optgroup>` : ''}
      </select><button class="btn primary" type="button" data-act="home-add" ${progs.length + cats.length ? '' : 'disabled'}>${ic('plus')}إضافة</button></div>
    <p class="hint">اسحب البطاقة من المقبض لإعادة الترتيب، أو استخدم أزرار الأسهم.</p></div>`;
};
regions.homePv = () => homePreview();

/* ---- ب) البرامج ---- */
function viewPrograms() {
  return `<div class="page-h"><div><h2>البرامج</h2><p class="muted">كل ما يتبرّع له الزائر: صدقة حرّة، أو قيمة ثابتة، أو مبالغ محددة.</p></div>
    <button class="btn primary" type="button" data-act="new-prog">${ic('plus')}برنامج جديد</button></div>
    <div class="toolbar"><div class="search">${ic('search')}<label class="sr" for="q">بحث في البرامج</label><input id="q" type="search" placeholder="ابحث بالاسم أو المعرّف…" value="${esc(ui.q)}" data-q="1"></div></div>
    <div data-region="progList"></div>`;
}
function summary(p) {
  const S = C().settings;
  if (p.kind === 'fixed') return `قيمة ثابتة: ${nf(p.price || 0)}` + (p.allowQuantity ? ` · كمية حتى ${p.maxQuantity}` : '');
  const own = p.presets.length; const arr = own ? p.presets : S.quickAmounts;
  return (p.kind === 'open' ? 'مبلغ حر + ' : 'مبالغ: ') + arr.map(nf).join(' · ') + (own ? '' : ' (الافتراضية)');
}
function placementChips(p) {
  const ch = []; const h = C().home.find((x) => x.type === 'program' && x.id === p.id);
  if (h) ch.push(`<span class="chip soft">${ic('home')}الرئيسية · ${SIZE_LABEL[h.size]}</span>`);
  C().catalogs.forEach((c) => { const it = c.items.find((i) => i.programId === p.id); if (it) ch.push(`<span class="chip soft ${c.active ? '' : 'dimchip'}">${ic('folder')}${esc(tt(c))} · ${SIZE_LABEL[it.size]}</span>`); });
  if (!ch.length) ch.push(`<span class="chip warn">${ic('alert')}غير ظاهر في أي مكان</span>`);
  return ch.join('');
}
regions.progList = () => {
  const q = ui.q.trim().toLowerCase();
  const list = C().programs.filter((p) => !q || (LANGS.map((l) => p.title[l.k]).join(' ') + ' ' + p.id).toLowerCase().includes(q));
  if (!C().programs.length) return `<div class="empty big">${ic('grid')}<strong>لا توجد برامج بعد</strong><p>ابدأ بإنشاء أول برنامج.</p><button class="btn primary" type="button" data-act="new-prog">${ic('plus')}برنامج جديد</button></div>`;
  if (!list.length) return `<div class="empty">${ic('search')}<strong>لا نتائج مطابقة</strong><p>جرّب كلمة أخرى.</p></div>`;
  return `<div class="cards">${list.map((p) => `<article class="pcard ${p.active ? '' : 'dim'}" data-id="${esc(p.id)}">
    <div class="pc-img">${imgTag(p.image, p.imageAlign)}</div>
    <div class="pc-body"><div class="pc-top"><h3><button type="button" class="linkbtn" data-act="edit-prog" data-id="${esc(p.id)}">${esc(tt(p))}</button></h3>${badge(KIND_LABEL[p.kind], 'kind')}</div>
      <p class="pc-sum">${esc(summary(p))}</p><div class="chips">${placementChips(p)}</div></div>
    <div class="pc-foot">${toggle(`data-act="toggle-active" data-type="prog" data-id="${esc(p.id)}"`, p.active, p.active ? 'مفعّل' : 'غير مفعّل')}
      <button class="btn small" type="button" data-act="edit-prog" data-id="${esc(p.id)}">${ic('edit')}تعديل</button></div></article>`).join('')}</div>`;
};

/* ---- ج) الكتالوجات ---- */
function viewCatalogs() {
  return `<div class="page-h"><div><h2>الكتالوجات</h2><p class="muted">مجموعات برامج (مثل «القرآن الكريم») تظهر كبطاقة واحدة في الرئيسية وتفتح صفحة خاصة.</p></div>
    <button class="btn primary" type="button" data-act="new-cat">${ic('plus')}كتالوج جديد</button></div><div data-region="catList"></div>`;
}
regions.catList = () => {
  if (!C().catalogs.length) return `<div class="empty big">${ic('folder')}<strong>لا توجد كتالوجات</strong><p>أنشئ كتالوجاً لتجمّع فيه عدة برامج في بطاقة واحدة.</p><button class="btn primary" type="button" data-act="new-cat">${ic('plus')}كتالوج جديد</button></div>`;
  return `<div class="cards">${C().catalogs.map((c) => {
    const h = C().home.find((x) => x.type === 'catalog' && x.id === c.id);
    return `<article class="pcard ${c.active ? '' : 'dim'}"><div class="pc-img">${imgTag(c.image, c.imageAlign)}</div>
    <div class="pc-body"><div class="pc-top"><h3><button type="button" class="linkbtn" data-act="edit-cat" data-id="${esc(c.id)}">${esc(tt(c))}</button></h3>${badge(c.items.length + ' برامج', 'cat')}</div>
      <p class="pc-sum">${c.items.slice(0, 4).map((i) => esc(tt(findProg(i.programId)))).join(' · ') || 'بلا برامج'}${c.items.length > 4 ? '…' : ''}</p>
      <div class="chips">${h ? `<span class="chip soft">${ic('home')}الرئيسية · ${SIZE_LABEL[h.size]}</span>` : `<span class="chip warn">${ic('alert')}غير ظاهر في الرئيسية</span>`}</div></div>
    <div class="pc-foot">${toggle(`data-act="toggle-active" data-type="cat" data-id="${esc(c.id)}"`, c.active, c.active ? 'مفعّل' : 'غير مفعّل')}
      <button class="btn small" type="button" data-act="edit-cat" data-id="${esc(c.id)}">${ic('edit')}تعديل</button></div></article>`;
  }).join('')}</div>`;
};

/* ---- د) الإعدادات ---- */
function viewSettings() {
  const S = C().settings;
  return `<div class="page-h"><div><h2>الإعدادات</h2><p class="muted">إعدادات عامة للكيوسك: المهلات والمبالغ وصورة الترحيب وعنوان الصفحة.</p></div></div>
  <div class="stack">
  <section class="card"><h3>الخمول والمهلات</h3><div class="grid2">
    ${numField('set', 'idleSeconds', 'مهلة الخمول (ثانية)', S.idleSeconds, { min: 10, hint: 'المدة التي ينتظرها الكيوسك دون لمس قبل إظهار التنبيه (10 إلى 600).' })}
    ${numField('set', 'warnSeconds', 'مهلة التنبيه (ثانية)', S.warnSeconds, { min: 5, hint: 'مدة عرض «هل ما زلت هنا؟» قبل مسح الجلسة والعودة للبداية (5 إلى 120).' })}</div></section>
  <section class="card"><h3>المبالغ</h3>
    ${numField('set', 'maxAmount', 'أقصى مبلغ عام', S.maxAmount, { min: 1, hint: 'أعلى مبلغ يمكن للمتبرع إدخاله في أي برنامج مفتوح.' })}
    ${chipsEditor('set:quickAmounts', 'المبالغ السريعة الافتراضية (من 1 إلى 8)', 'تظهر كأزرار سريعة في البرامج التي لا تحدد مبالغها الخاصة.')}</section>
  <section class="card"><h3>صورة شاشة الترحيب</h3>${imagePicker('welcome', { label: 'خلفية شاشة الترحيب' })}</section>
  <section class="card"><h3>عنوان صفحة البرامج</h3><p class="hint">اختياري — إن تركته فارغاً يُستخدم العنوان الافتراضي في التطبيق.</p>
    ${locFields('set', 'homeTitle', 'العنوان الرئيسي')}${locFields('set', 'homeSubtitle', 'العنوان الفرعي')}</section></div>`;
}

/* ---- هـ) النشر والنسخ ---- */
function viewPublish() {
  return `<div class="page-h"><div><h2>النشر والنسخ</h2><p class="muted">ما تعدّله هنا يُحفظ كمسودة، ولا يراه المتبرعون إلا بعد «نشر التغييرات».</p></div></div>
  <div class="stack"><div data-region="pubStatus"></div><div data-region="diff"></div><div data-region="history"></div></div>`;
}
regions.pubStatus = () => {
  const un = state.dirty || state.hasUnpublished;
  return `<section class="card pub ${un ? 'has' : 'none'}"><div class="pub-s">${ic(un ? 'alert' : 'check')}<div><strong>${un ? 'توجد تغييرات لم تُنشر بعد' : 'كل شيء منشور'}</strong>
    <p class="muted">${un ? 'المتبرعون ما زالوا يرون النسخة المنشورة السابقة.' : 'المسودة مطابقة للنسخة المنشورة حالياً في الكيوسك.'}</p></div></div>
    <button class="btn primary big" type="button" data-act="publish" ${ui.pubBusy ? 'disabled' : ''}>${ic('cloud')}${ui.pubBusy ? 'جارٍ النشر…' : 'نشر التغييرات'}</button>
    ${state.warnings.length ? `<div class="warnbox slim"><div class="wb-h">${ic('alert')}<strong>تنبيهات (لا تمنع النشر)</strong></div><ul>${state.warnings.map((w) => `<li>${esc(w)}</li>`).join('')}</ul></div>` : ''}</section>`;
};
regions.diff = () => {
  if (!ui.live) return `<section class="card"><h3>ملخص التغييرات</h3><p class="muted">${ui.histErr ? esc(ui.histErr) : 'جارٍ مقارنة المسودة بالنسخة المنشورة…'}</p></section>`;
  const groups = diffCatalogs(ui.live, C());
  const n = groups.reduce((a, g) => a + g.items.length, 0);
  return `<section class="card"><h3>ملخص التغييرات <span class="count">${n}</span></h3>${n ? groups.filter((g) => g.items.length).map((g) => `<div class="dg"><h4>${esc(g.title)}</h4><ul>${g.items.map((i) => `<li class="${i.k}">${esc(i.t)}</li>`).join('')}</ul></div>`).join('') : '<p class="muted">لا فروق بين المسودة والنسخة المنشورة.</p>'}</section>`;
};
regions.history = () => `<section class="card"><h3>النسخ السابقة</h3>
  ${ui.hist == null ? '<p class="muted">جارٍ التحميل…</p>' : ui.hist.length ? `<ul class="rows plain">${ui.hist.map((h) => `<li class="row hist"><span class="hic">${ic('clock')}</span><div class="row-t"><strong>${esc(fmtDate(h.at))}</strong></div><button class="btn small" type="button" data-act="restore" data-id="${esc(h.id)}" ${ui.restoreBusy ? 'disabled' : ''}>استرجاع</button></li>`).join('')}</ul>` : '<p class="muted">لا توجد نسخ سابقة بعد — تُحفظ نسخة تلقائياً عند كل نشر.</p>'}
  <p class="hint">الاسترجاع يحمّل النسخة القديمة إلى المسودة فقط، ولا ينشرها حتى تضغط «نشر».</p>
  <div class="btnrow"><button class="btn" type="button" data-act="export">${ic('download')}تصدير المسودة (JSON)</button>
  <button class="btn" type="button" data-act="import">${ic('upload')}استيراد ملف JSON</button><input type="file" id="importFile" accept="application/json,.json" hidden></div></section>`;
const fmtDate = (s) => { try { return new Date(s).toLocaleString('ar-SA', { dateStyle: 'full', timeStyle: 'short' }); } catch (e) { return String(s); } };

/* ---------- مقارنة المسودة بالمنشور ---------- */
function diffCatalogs(a, b) {
  const same = (x, y) => JSON.stringify(x) === JSON.stringify(y);
  const nm = (o) => `«${tt(o)}»`;
  const G = [];
  /* البرامج */
  const pg = { title: 'البرامج', items: [] }; G.push(pg);
  const FL = { active: 'التفعيل', title: 'العناوين', image: 'الصورة', imageAlign: 'محاذاة الصورة', kind: 'النوع', price: 'القيمة', presets: 'المبالغ المحددة', minAmount: 'الحد الأدنى', maxAmount: 'الحد الأعلى', allowQuantity: 'خيار الكمية', maxQuantity: 'أقصى كمية' };
  const am = new Map(a.programs.map((p) => [p.id, p]));
  b.programs.forEach((p) => {
    const o = am.get(p.id); if (!o) return pg.items.push({ k: 'add', t: `إضافة برنامج ${nm(p)}` });
    const ch = Object.keys(FL).filter((k) => !same(o[k], p[k])).map((k) => FL[k]);
    if (ch.length) pg.items.push({ k: 'chg', t: `تعديل ${nm(p)}: ${ch.join('، ')}` });
  });
  const bm = new Set(b.programs.map((p) => p.id)); a.programs.forEach((p) => { if (!bm.has(p.id)) pg.items.push({ k: 'del', t: `حذف برنامج ${nm(p)}` }); });
  /* الكتالوجات */
  const cg = { title: 'الكتالوجات', items: [] }; G.push(cg);
  const CF = { active: 'التفعيل', title: 'العناوين', subtitle: 'العناوين الفرعية', image: 'الصورة', imageAlign: 'محاذاة الصورة' };
  const ac = new Map(a.catalogs.map((c) => [c.id, c]));
  b.catalogs.forEach((c) => {
    const o = ac.get(c.id); if (!o) return cg.items.push({ k: 'add', t: `إضافة كتالوج ${nm(c)} (${c.items.length} برامج)` });
    const ch = Object.keys(CF).filter((k) => !same(o[k], c[k])).map((k) => CF[k]);
    const oi = o.items.map((i) => i.programId), ni = c.items.map((i) => i.programId);
    const added = ni.filter((x) => !oi.includes(x)), removed = oi.filter((x) => !ni.includes(x));
    if (added.length) ch.push('إضافة: ' + added.map((id) => nm(b.programs.find((p) => p.id === id) || { id })).join('، '));
    if (removed.length) ch.push('إزالة: ' + removed.map((id) => nm(a.programs.find((p) => p.id === id) || { id })).join('، '));
    if (!added.length && !removed.length && !same(oi, ni)) ch.push('ترتيب البرامج');
    if (ni.some((id) => oi.includes(id) && o.items.find((i) => i.programId === id).size !== c.items.find((i) => i.programId === id).size)) ch.push('أحجام البرامج');
    if (ch.length) cg.items.push({ k: 'chg', t: `تعديل ${nm(c)}: ${ch.join('، ')}` });
  });
  const bc = new Set(b.catalogs.map((c) => c.id)); a.catalogs.forEach((c) => { if (!bc.has(c.id)) cg.items.push({ k: 'del', t: `حذف كتالوج ${nm(c)}` }); });
  /* الرئيسية */
  const hg = { title: 'الصفحة الرئيسية', items: [] }; G.push(hg);
  const hk = (h) => h.type + ':' + h.id; const hname = (h, cat) => nm((h.type === 'program' ? cat.programs : cat.catalogs).find((x) => x.id === h.id) || { id: h.id });
  const ah = new Map(a.home.map((h) => [hk(h), h])), bh = new Map(b.home.map((h) => [hk(h), h]));
  b.home.forEach((h) => { const o = ah.get(hk(h)); if (!o) hg.items.push({ k: 'add', t: `إضافة ${hname(h, b)} إلى الرئيسية (${SIZE_LABEL[h.size]})` }); else if (o.size !== h.size) hg.items.push({ k: 'chg', t: `تغيير حجم ${hname(h, b)}: ${SIZE_LABEL[o.size]} ← ${SIZE_LABEL[h.size]}` }); });
  a.home.forEach((h) => { if (!bh.has(hk(h))) hg.items.push({ k: 'del', t: `إزالة ${hname(h, a)} من الرئيسية` }); });
  const common = (arr, other) => arr.map(hk).filter((k) => other.has(k));
  if (!same(common(a.home, bh), common(b.home, ah))) hg.items.push({ k: 'chg', t: 'تغيير ترتيب البطاقات في الرئيسية' });
  /* الإعدادات */
  const sg = { title: 'الإعدادات', items: [] }; G.push(sg);
  const SL = { idleSeconds: 'مهلة الخمول', warnSeconds: 'مهلة التنبيه', maxAmount: 'أقصى مبلغ', quickAmounts: 'المبالغ السريعة', welcomeBackground: 'صورة الترحيب', homeTitle: 'عنوان الصفحة', homeSubtitle: 'العنوان الفرعي' };
  Object.keys(SL).forEach((k) => { if (!same(a.settings[k], b.settings[k])) sg.items.push({ k: 'chg', t: `تغيير ${SL[k]}` }); });
  return G;
}

/* =====================================================================
   10) المحرّرات (Drawer)
   ===================================================================== */
function newProgram() {
  return { id: '', active: true, title: blankLoc(), image: '', imageAlign: 'center', kind: 'open', price: 0, presets: [], minAmount: 1, maxAmount: C().settings.maxAmount, allowQuantity: false, maxQuantity: 99 };
}
function newCatalog() { return { id: '', active: true, title: blankLoc(), subtitle: blankLoc(), image: '', imageAlign: 'center', items: [] }; }

/* وضع الظهور (placements): مفاتيح 'home' و catId */
function plGet(key) {
  const e = ui.edit; const isProg = e.type === 'prog';
  if (e.creating && !(key !== 'home' && !isProg)) return e.pl[key] || null;
  if (key === 'home') { const h = C().home.find((x) => x.type === (isProg ? 'program' : 'catalog') && x.id === e.id); return h ? h.size : null; }
  const c = findCat(key); const it = c && c.items.find((i) => i.programId === e.id); return it ? it.size : null;
}
function plSet(key, size) {
  const e = ui.edit; const isProg = e.type === 'prog';
  if (e.creating) { if (size) e.pl[key] = size; else delete e.pl[key]; return; }
  if (key === 'home') {
    const t = isProg ? 'program' : 'catalog'; const i = C().home.findIndex((x) => x.type === t && x.id === e.id);
    if (size && i < 0) C().home.push({ type: t, id: e.id, size }); else if (size) C().home[i].size = size; else if (i >= 0) C().home.splice(i, 1);
  } else {
    const c = findCat(key); if (!c) return; const i = c.items.findIndex((x) => x.programId === e.id);
    if (size && i < 0) c.items.push({ programId: e.id, size }); else if (size) c.items[i].size = size; else if (i >= 0) c.items.splice(i, 1);
  }
  markDirty();
}
function placementRow(key, label, sub) {
  const size = plGet(key);
  return `<div class="pl-row ${size ? 'on' : ''}"><label class="check"><input type="checkbox" data-place="${esc(key)}" ${size ? 'checked' : ''}><span>${esc(label)}${sub ? ` <small class="muted">${esc(sub)}</small>` : ''}</span></label>
    ${sizeSeg(`data-act="pl-size" data-key="${esc(key)}"`, size || 'medium', !size)}</div>`;
}
function placementsHtml() {
  const e = ui.edit; const isProg = e.type === 'prog';
  const homeRow = placementRow('home', 'الصفحة الرئيسية');
  const cats = isProg ? C().catalogs.map((c) => placementRow(c.id, 'كتالوج: ' + tt(c), c.active ? '' : '(غير مفعّل)')).join('') : '';
  return `<section class="card"><h3>أين يظهر؟</h3><p class="hint">${isProg ? 'ضع البرنامج في الصفحة الرئيسية مباشرة و/أو داخل كتالوج، واختر حجمه في كل مكان.' : 'ضع الكتالوج في الصفحة الرئيسية واختر حجم بطاقته.'}</p>
    <div class="pl">${homeRow}${cats}${isProg && !C().catalogs.length ? '<p class="hint">لا توجد كتالوجات بعد — يمكنك إنشاء كتالوج من تبويب «الكتالوجات».</p>' : ''}</div></section>`;
}

function programEditorHtml() {
  const p = ui.edit.obj || findProg(ui.edit.id); const e = ui.edit;
  const kinds = [['open', 'يختار المتبرع المبلغ (مبالغ سريعة + مبلغ آخر) — مثل الصدقة'], ['presets', 'مبالغ محددة فقط'], ['fixed', 'قيمة ثابتة لا يغيّرها المتبرع']];
  let cond = '';
  if (p.kind === 'fixed') {
    cond = `${numField('prog', 'price', 'القيمة (1 أو أكثر)', p.price, { min: 1, blank0: true, ph: 'مثال: 15' })}
      <label class="check"><input type="checkbox" data-ctx="prog" data-f="allowQuantity" data-rerender ${p.allowQuantity ? 'checked' : ''}><span>السماح للمتبرع باختيار الكمية (عدّاد)</span></label>
      ${p.allowQuantity ? numField('prog', 'maxQuantity', 'أقصى كمية', p.maxQuantity, { min: 1, max: 999 }) : ''}`;
  } else if (p.kind === 'presets') {
    cond = chipsEditor('prog:presets', 'المبالغ المحددة', 'إذا تركتها فارغة تُستخدم المبالغ السريعة العامة: ' + C().settings.quickAmounts.map(nf).join('، '));
  } else {
    cond = `${chipsEditor('prog:presets', 'مبالغ سريعة خاصة بهذا البرنامج (اختياري)', 'إذا تركتها فارغة تُستخدم المبالغ السريعة العامة: ' + C().settings.quickAmounts.map(nf).join('، '))}
      <div class="grid2">${numField('prog', 'minAmount', 'أقل مبلغ', p.minAmount, { min: 1 })}${numField('prog', 'maxAmount', 'أعلى مبلغ', p.maxAmount, { min: 1 })}</div>`;
  }
  return `<div class="stack">
    <section class="card"><div class="two">${toggle('data-ctx="prog" data-f="active"', p.active, 'البرنامج مفعّل (ظاهر للمتبرعين)')}</div>
      <div class="field idf"><label for="f-prog-id">المعرّف (ID)</label><input id="f-prog-id" type="text" dir="ltr" data-ctx="prog" data-f="id" value="${esc(p.id)}" ${e.creating ? '' : 'readonly'} autocomplete="off" spellcheck="false">
      <p class="hint">${e.creating ? 'يُولَّد تلقائياً من العنوان الإنجليزي ويمكنك تعديله الآن فقط.' : 'لا يمكن تغيير المعرّف بعد الإنشاء.'}</p><div class="err" data-err="id"></div></div></section>
    <section class="card"><h3>العنوان</h3>${locFields('prog', 'title', 'عنوان البرنامج بأربع لغات', { arRequired: true })}</section>
    <section class="card"><h3>الصورة</h3>${imagePicker('prog', { label: 'صورة البرنامج' })}</section>
    <section class="card"><h3>نوع التبرع</h3><div class="rcards" role="radiogroup" aria-label="نوع البرنامج">${kinds.map(([k, d]) => `<label class="rcard ${p.kind === k ? 'sel' : ''}"><input type="radio" name="kind" value="${k}" data-ctx="prog" data-f="kind" data-rerender ${p.kind === k ? 'checked' : ''}><strong>${KIND_LABEL[k]}</strong><span>${d}</span></label>`).join('')}</div>
      <div class="cond">${cond}</div></section>
    ${placementsHtml()}</div>`;
}
function catalogEditorHtml() {
  const c = ui.edit.obj || findCat(ui.edit.id); const e = ui.edit;
  return `<div class="stack">
    <section class="card"><div class="two">${toggle('data-ctx="cat" data-f="active"', c.active, 'الكتالوج مفعّل (ظاهر للمتبرعين)')}</div>
      <div class="field idf"><label for="f-cat-id">المعرّف (ID)</label><input id="f-cat-id" type="text" dir="ltr" data-ctx="cat" data-f="id" value="${esc(c.id)}" ${e.creating ? '' : 'readonly'} autocomplete="off" spellcheck="false">
      <p class="hint">${e.creating ? 'يُولَّد تلقائياً من العنوان الإنجليزي ويمكنك تعديله الآن فقط.' : 'لا يمكن تغيير المعرّف بعد الإنشاء.'}</p><div class="err" data-err="id"></div></div></section>
    <section class="card"><h3>العنوان</h3>${locFields('cat', 'title', 'عنوان الكتالوج بأربع لغات', { arRequired: true })}</section>
    <section class="card"><h3>العنوان الفرعي</h3>${locFields('cat', 'subtitle', 'وصف قصير (اختياري)')}</section>
    <section class="card"><h3>الصورة</h3>${imagePicker('cat', { label: 'صورة الكتالوج' })}</section>
    ${placementsHtml()}
    <section class="card"><h3>برامج الكتالوج</h3><div data-region="catItems"></div></section>
    <section class="card"><div data-region="catPv"></div></section></div>`;
}
regions.catItems = () => {
  const c = editing(); if (!c || ui.edit.type !== 'cat') return '';
  const avail = C().programs.filter((p) => !c.items.some((i) => i.programId === p.id));
  return `${c.items.length ? `<ul class="rows" data-dnd-list="items">${listRows('items', c.items)}</ul>` : `<div class="empty">${ic('grid')}<strong>الكتالوج فارغ</strong><p>أضف برامج ليظهر محتوى للمتبرع.</p></div>`}
    <div class="addbar"><label for="itemAdd" class="sr">إضافة برنامج</label><select id="itemAdd" ${avail.length ? '' : 'disabled'}>${avail.length ? avail.map((p) => `<option value="${esc(p.id)}">${esc(tt(p))}${p.active ? '' : ' (غير مفعّل)'}</option>`).join('') : '<option>كل البرامج مضافة</option>'}</select>
    <button class="btn primary" type="button" data-act="item-add" ${avail.length ? '' : 'disabled'}>${ic('plus')}إضافة</button></div>`;
};
regions.catPv = () => { const c = editing(); return c && ui.edit.type === 'cat' ? catPreview(c) : ''; };

function openEditor(type, id) {
  const creating = !id;
  ui.edit = { type, id, creating, obj: creating ? (type === 'prog' ? newProgram() : newCatalog()) : null, pl: {}, idTouched: false, showErr: false, opener: document.activeElement };
  if (creating) ui.edit.pl = {};
  renderDrawer(true);
  $('#scrim').hidden = false; $('#drawer').hidden = false;
  ['#main', '#nav', '.topbar'].forEach((s) => $(s).setAttribute('inert', ''));
  requestAnimationFrame(() => { $('#drawer').classList.add('open'); $('#scrim').classList.add('open'); });
  setTimeout(() => { const f = $('#drawerBody input[type=text]'); if (f) f.focus(); }, 60);
}
async function closeEditor(force) {
  const e = ui.edit; if (!e) return;
  if (e.creating && !force && e.obj.title.ar.trim()) { if (!(await confirmDlg('سيتم تجاهل هذا العنصر الجديد ولن يُحفظ. متابعة؟', 'تجاهل', true))) return; }
  ui.edit = null;
  $('#drawer').classList.remove('open'); $('#scrim').classList.remove('open');
  ['#main', '#nav', '.topbar'].forEach((s) => $(s).removeAttribute('inert'));
  setTimeout(() => { if (!ui.edit) { $('#drawer').hidden = true; $('#scrim').hidden = true; $('#drawerBody').innerHTML = ''; } }, 220);
  if (e.opener && document.contains(e.opener)) try { e.opener.focus(); } catch (x) { /* */ }
  render(false);
}
function renderDrawer(full) {
  const e = ui.edit; if (!e) return;
  const isProg = e.type === 'prog'; const o = editing();
  $('#drawerTitle').textContent = e.creating ? (isProg ? 'برنامج جديد' : 'كتالوج جديد') : (isProg ? 'تعديل البرنامج: ' : 'تعديل الكتالوج: ') + tt(o);
  $('#drawer .icon-btn').innerHTML = ic('x');
  const body = $('#drawerBody'); const st = body.scrollTop;
  body.innerHTML = isProg ? programEditorHtml() : catalogEditorHtml();
  body.scrollTop = full ? 0 : st;
  $('#drawerFoot').innerHTML = e.creating
    ? `<button class="btn primary" type="button" data-act="create">${ic('check')}إنشاء ${isProg ? 'البرنامج' : 'الكتالوج'}</button><button class="btn ghost" type="button" data-act="close-editor">إلغاء</button>`
    : `<button class="btn primary" type="button" data-act="close-editor">${ic('check')}تم</button>
       <button class="btn" type="button" data-act="dup">${ic('copy')}تكرار</button><span class="sp"></span>
       <button class="btn danger-o" type="button" data-act="del">${ic('trash')}حذف</button>`;
  refreshRegions(); validateEditorUI();
}
function validateEditorUI() {
  const e = ui.edit; if (!e) return {};
  const o = editing(); if (!o) return {};
  const errs = e.type === 'prog' ? progErrors(o, C().settings, C().programs.filter((x) => x !== o).map((x) => x.id)) : catErrors(o, C().catalogs.filter((x) => x !== o).map((x) => x.id));
  const show = !e.creating || e.showErr || e.touched;
  $$('#drawerBody [data-err]').forEach((el) => { const m = (show || (e.touched && e.touched[el.dataset.err])) ? errs[el.dataset.err] || '' : ''; el.textContent = m; });
  $$('#drawerBody [data-f]').forEach((inp) => { const k = inp.dataset.f; const bad = !!($(`#drawerBody [data-err="${k}"]`) && $(`#drawerBody [data-err="${k}"]`).textContent); inp.toggleAttribute('aria-invalid', bad); });
  return errs;
}

/* =====================================================================
   11) العرض العام (Router) والمناطق
   ===================================================================== */
function renderNav() {
  $('#nav').innerHTML = TABS.map((t) => `<button type="button" class="navb" data-act="tab" data-tab="${t.k}" ${ui.tab === t.k ? 'aria-current="page"' : ''}>${ic(t.icon)}<span>${t.label}</span></button>`).join('');
}
function render(full = true) {
  renderNav(); updateChrome();
  if (full) {
    const v = { home: viewHome, programs: viewPrograms, catalogs: viewCatalogs, settings: viewSettings, publish: viewPublish }[ui.tab];
    $('#view').innerHTML = v(); window.scrollTo(0, 0);
  }
  refreshRegions();
  if (ui.tab === 'settings') validateSettingsUI();
}
function refreshRegions() {
  $$('[data-region]').forEach((el) => {
    if (el.contains(document.activeElement) && document.activeElement !== document.body && !ui.forceRegions) return;
    const fn = regions[el.dataset.region]; if (fn) el.innerHTML = fn();
  });
  updateChrome();
}
function validateSettingsUI() {
  const e = settingsErrors(C().settings);
  $$('#view [data-ctx="set"][data-f]').forEach((inp) => { const k = inp.dataset.f; const el = $(`#view [data-err="${k}"]`); if (el) { el.textContent = e[k] || ''; inp.toggleAttribute('aria-invalid', !!e[k]); } });
  const q = $('#view [data-err="quickAmounts"]'); if (q) q.textContent = e.quickAmounts || '';
}

/* =====================================================================
   12) الإجراءات (أحداث مفوَّضة)
   ===================================================================== */
function listArr(list) { return list === 'home' ? C().home : editing().items; }
function afterListChange() { if (!(ui.edit && ui.edit.creating && ui.edit.type === 'cat')) markDirty(); ui.forceRegions = true; refreshRegions(); ui.forceRegions = false; }
function moveItem(list, from, to) {
  const a = listArr(list); if (to < 0 || to >= a.length || from === to) return;
  const [x] = a.splice(from, 1); a.splice(to, 0, x); afterListChange();
}
function refocus(sel) { setTimeout(() => { const el = $(sel); if (el && !el.disabled) el.focus(); else { const alt = $(sel.replace(/\[data-d="-?1"\]/, '[data-d="1"]')); if (alt) alt.focus(); } }, 10); }

const actions = {
  tab(el) { if (ui.edit) return; ui.tab = el.dataset.tab; render(); if (ui.tab === 'publish') loadPublishData(); },
  'pv-lang'(el) { ui.pvLang = el.dataset.v; ui.forceRegions = true; refreshRegions(); ui.forceRegions = false; },
  size(el) {
    const a = listArr(el.dataset.list); a[+el.dataset.i].size = el.dataset.v; afterListChange();
    refocus(`[data-act="size"][data-list="${el.dataset.list}"][data-i="${el.dataset.i}"][data-v="${el.dataset.v}"]`);
  },
  move(el) {
    const i = +el.dataset.i, d = +el.dataset.d, list = el.dataset.list; const a = listArr(list);
    const info = entryInfo(list, a[i]); moveItem(list, i, i + d);
    announce(`تم نقل ${tt(info.obj)} إلى الموضع ${i + d + 1} من ${a.length}`);
    refocus(`[data-act="move"][data-list="${list}"][data-i="${i + d}"][data-d="${d}"]`);
  },
  'remove-entry'(el) {
    const list = el.dataset.list, a = listArr(list); const info = entryInfo(list, a[+el.dataset.i]);
    a.splice(+el.dataset.i, 1); afterListChange(); announce(`أُزيل ${tt(info.obj)}`);
  },
  'home-add'() {
    const v = $('#homeAdd').value; if (!v || !v.includes(':')) return; const [t, id] = v.split(':');
    C().home.push({ type: t, id, size: 'medium' }); markDirty(); ui.forceRegions = true; refreshRegions(); ui.forceRegions = false; toast('أُضيف إلى الرئيسية');
  },
  'home-add-prog'(el) { C().home.push({ type: 'program', id: el.dataset.id, size: 'medium' }); markDirty(); ui.forceRegions = true; refreshRegions(); ui.forceRegions = false; toast('أُضيف إلى الرئيسية'); },
  'item-add'() {
    const id = $('#itemAdd').value; const c = editing(); if (!id || !c) return;
    c.items.push({ programId: id, size: 'medium' }); afterListChange();
  },
  'new-prog'() { openEditor('prog'); },
  'new-cat'() { openEditor('cat'); },
  'edit-prog'(el) { openEditor('prog', el.dataset.id); },
  'edit-cat'(el) { openEditor('cat', el.dataset.id); },
  'close-editor'() { closeEditor(); },
  'toggle-active'(el) {
    const o = el.dataset.type === 'prog' ? findProg(el.dataset.id) : findCat(el.dataset.id); if (!o) return;
    o.active = el.checked; markDirty(); const lab = el.parentElement.querySelector('.swl'); if (lab) lab.textContent = o.active ? 'مفعّل' : 'غير مفعّل';
    el.closest('.pcard').classList.toggle('dim', !o.active); refreshRegionsExcept(el);
  },
  'pl-size'(el) {
    const key = el.dataset.key; if (!plGet(key)) return; plSet(key, el.dataset.v);
    $$(`#drawerBody [data-act="pl-size"][data-key="${key}"]`).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === el.dataset.v)));
    refreshRegions();
  },
  'img-pick'(el) { $('[data-img-file]', el.closest('.imgp')).click(); },
  'img-remove'(el) { applyImage(el.closest('.imgp').dataset.pk, ''); },
  'img-align'(el) { const pk = el.closest('.imgp').dataset.pk; const T = pickerTarget(pk); T.setAlign(el.dataset.v); if (!(ui.edit && ui.edit.creating)) markDirty(); refreshPicker(pk); refreshRegions(); },
  'chip-add'(el) { chipAdd(el.dataset.path); },
  'chip-del'(el) {
    const [ctx, f] = el.dataset.path.split(':'); const o = ctxObj(ctx); o[f].splice(+el.dataset.i, 1); chipsChanged(el.dataset.path, ctx);
  },
  async create() {
    const e = ui.edit; e.showErr = true; const errs = validateEditorUI();
    if (!e.obj.id) { e.obj.id = uniqueId(rnd(e.type === 'prog' ? 'p' : 'c'), e.type === 'prog' ? C().programs : C().catalogs); }
    const errs2 = validateEditorUI(); if (Object.keys(errs2).length) { const f = $('#drawerBody [aria-invalid]'); if (f) f.focus(); return; }
    const o = e.obj; (e.type === 'prog' ? C().programs : C().catalogs).push(o);
    e.creating = false; e.id = o.id; e.obj = null;
    Object.entries(e.pl).forEach(([k, s]) => { const sv = e.creating; plSet(k, s); });
    markDirty(); toast(e.type === 'prog' ? 'تم إنشاء البرنامج ✓' : 'تم إنشاء الكتالوج ✓');
    renderDrawer(false); refreshRegions();
  },
  async dup() {
    const e = ui.edit; const isProg = e.type === 'prog'; const src = clone(editing()); const list = isProg ? C().programs : C().catalogs;
    src.id = uniqueId((src.id + '-copy').slice(0, 40), list); src.title.ar = (src.title.ar + ' (نسخة)').trim();
    const at = list.findIndex((x) => x.id === e.id); list.splice(at + 1, 0, src); markDirty();
    ui.edit = { type: e.type, id: src.id, creating: false, obj: null, pl: {}, opener: e.opener }; renderDrawer(true); toast('تم إنشاء نسخة — عدّل عنوانها'); $('#drawerBody input[type=text][data-f$=".ar"]').focus();
  },
  async del() {
    const e = ui.edit; const o = editing(); const isProg = e.type === 'prog';
    const msg = isProg ? `حذف البرنامج «${tt(o)}»؟ سيُزال أيضاً من الصفحة الرئيسية ومن كل الكتالوجات.` : `حذف الكتالوج «${tt(o)}»؟ سيُزال من الصفحة الرئيسية (البرامج نفسها تبقى).`;
    if (!(await confirmDlg(msg, 'حذف', true))) return;
    const id = e.id;
    if (isProg) { C().programs = C().programs.filter((p) => p.id !== id); C().home = C().home.filter((h) => !(h.type === 'program' && h.id === id)); C().catalogs.forEach((c) => { c.items = c.items.filter((i) => i.programId !== id); }); }
    else { C().catalogs = C().catalogs.filter((c) => c.id !== id); C().home = C().home.filter((h) => !(h.type === 'catalog' && h.id === id)); }
    markDirty(); await closeEditor(true); toast('تم الحذف');
  },
  'dismiss-err'() { hideErrors(); },
  'retry-save'() { flushSave(); },
  'publish-top'() { ui.tab = 'publish'; if (ui.edit) closeEditor(true); render(); loadPublishData(); },
  publish() { doPublish(); },
  restore(el) { doRestore(el.dataset.id); },
  export() { doExport(); },
  import() { $('#importFile').click(); },
  logout() { if (backend.logout) backend.logout(); location.reload(); },
};
function refreshRegionsExcept(el) { const keep = el.closest('[data-region]'); $$('[data-region]').forEach((r) => { if (r !== keep && regions[r.dataset.region]) r.innerHTML = regions[r.dataset.region](); }); updateChrome(); }

/* ---- شرائح المبالغ ---- */
function chipAdd(path) {
  const [ctx, f] = path.split(':'); const inp = $(`[data-chipin="${path}"]`); const n = Math.round(Number(inp.value));
  const o = ctxObj(ctx); const arr = o[f];
  if (!(n >= 1)) { inp.focus(); return; }
  if (arr.length >= 8) { toast('الحد الأقصى 8 مبالغ', 'warn'); return; }
  if (arr.includes(n)) { toast('المبلغ مضاف مسبقاً', 'warn'); return; }
  arr.push(n); arr.sort((a, b) => a - b); inp.value = ''; chipsChanged(path, ctx); $(`[data-chipin="${path}"]`).focus();
}
function chipsChanged(path, ctx) {
  const box = $(`[data-chips="${path}"] [data-chiplist]`); if (box) box.innerHTML = chipsHtml(path);
  if (ctx === 'set') validateSettingsUI(); else if (!(ui.edit && ui.edit.creating)) markDirty();
  if (ctx === 'set') markDirty();
  refreshRegions();
}

/* ---- تحرير الحقول ---- */
function onField(el, ev) {
  const ctx = el.dataset.ctx, f = el.dataset.f; const o = ctxObj(ctx); if (!o) return;
  const type = el.type;
  if ((type === 'checkbox' || type === 'radio' || el.tagName === 'SELECT') && ev.type === 'input') return;
  if (!(type === 'checkbox' || type === 'radio' || el.tagName === 'SELECT') && ev.type === 'change') return;
  let v = type === 'checkbox' ? el.checked : type === 'number' ? (el.value === '' ? '' : Number(el.value)) : el.value;
  if (f === 'id' && ui.edit && ui.edit.creating) { ui.edit.idTouched = true; v = String(v).trim(); }
  setPath(o, f, v);
  const creating = ui.edit && ui.edit.creating && (ctx === 'prog' || ctx === 'cat');
  if (creating) {
    ui.edit.touched = ui.edit.touched || {}; ui.edit.touched[f] = true;
    if (f === 'title.en' && !ui.edit.idTouched) {
      const list = ctx === 'prog' ? C().programs : C().catalogs;
      o.id = uniqueId(slug(o.title.en) || rnd(ctx === 'prog' ? 'p' : 'c'), list); const idEl = $('#drawerBody [data-f="id"]'); if (idEl) idEl.value = o.id;
    }
  } else markDirty();
  if (ev.target.hasAttribute('data-rerender')) {
    if (f === 'kind') { if (v === 'fixed' && !(o.price >= 1)) o.price = 0; }
    const sig = type === 'radio' ? `[data-f="${f}"][value="${v}"]` : `[data-f="${f}"]`;
    renderDrawer(false); const nf2 = $('#drawerBody ' + sig); if (nf2) nf2.focus(); return;
  }
  if (ctx === 'set') validateSettingsUI(); else validateEditorUI();
  if (type === 'checkbox' && f === 'active') { /* مفتاح التفعيل داخل المحرر */ }
  if (ctx === 'prog' || ctx === 'cat') { if (f.startsWith('title.ar')) { const t = $('#drawerTitle'); if (!ui.edit.creating) t.textContent = (ctx === 'prog' ? 'تعديل البرنامج: ' : 'تعديل الكتالوج: ') + tt(o); } }
  refreshRegions();
}

/* ---- تحميل بيانات النشر ---- */
async function loadPublishData() {
  ui.hist = null; ui.histErr = '';
  try { ui.live = await backend.fetchLive(); } catch (e) { ui.live = null; ui.histErr = 'تعذّر قراءة النسخة المنشورة للمقارنة'; }
  refreshRegions();
  try { ui.hist = await backend.history(); } catch (e) { ui.hist = []; }
  refreshRegions();
}
async function doPublish() {
  if (ui.pubBusy) return;
  const errs = validateCatalog(C());
  if (errs.length) { showErrors(errs.map((e) => e.msg), 'لا يمكن النشر قبل تصحيح الأخطاء التالية'); return; }
  if (!(await confirmDlg('سيظهر هذا المحتوى لجميع المتبرعين في الكيوسك. هل تريد النشر الآن؟', 'نشر الآن'))) return;
  ui.pubBusy = true; refreshRegions();
  try {
    if (!(await settleSaves())) throw Object.assign(new Error('تعذّر حفظ المسودة قبل النشر'), { shown: true });
    const r = await backend.publish();
    state.hasUnpublished = false; state.dirty = state.dirty && false; state.warnings = r.warnings || state.warnings;
    toast('تم النشر ✓ — التغييرات ظاهرة الآن في الكيوسك'); hideErrors();
    ui.pubBusy = false; updateChrome(); await loadPublishData();
  } catch (e) {
    if (e.status === 401) showLogin('انتهت الجلسة، أعد تسجيل الدخول.');
    else if (e.errors) showErrors(e.errors, 'رفض الخادم النشر');
    else if (!e.shown) showErrors([e.message || 'تعذّر النشر'], 'تعذّر النشر');
  } finally { ui.pubBusy = false; refreshRegions(); updateChrome(); }
}
async function doRestore(id) {
  if (!(await confirmDlg('سيتم استبدال المسودة الحالية بهذه النسخة (لن تُنشر إلا بعد ضغط «نشر»). متابعة؟', 'استرجاع', true))) return;
  ui.restoreBusy = true; refreshRegions();
  try {
    await settleSaves();
    const r = await backend.restore(id); state.catalog = r.catalog; state.dirty = false;
    const l = await backend.load(); state.catalog = l.catalog; state.hasUnpublished = l.hasUnpublished;
    hideErrors(); setSave('saved'); toast('تم استرجاع النسخة إلى المسودة ✓');
  } catch (e) { showErrors([e.message || 'تعذّر الاسترجاع'], 'تعذّر الاسترجاع'); }
  ui.restoreBusy = false; ui.forceRegions = true; refreshRegions(); ui.forceRegions = false;
}
function doExport() {
  const blob = new Blob([JSON.stringify(toPayload(), null, 2)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `hadiyah-catalog-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500); toast('تم تصدير المسودة');
}
async function doImport(file) {
  let data;
  try { data = JSON.parse(await file.text()); } catch (e) { return showErrors(['الملف ليس JSON صالحاً'], 'تعذّر الاستيراد'); }
  if (!data || typeof data !== 'object' || !Array.isArray(data.programs) || !Array.isArray(data.catalogs) || !Array.isArray(data.home) || typeof data.settings !== 'object' || !data.settings) {
    return showErrors(['الملف لا يشبه ملف كتالوج هدية (يلزم: settings و programs و catalogs و home)'], 'تعذّر الاستيراد');
  }
  if (!(await confirmDlg('سيستبدل هذا الملف المسودة الحالية بالكامل. متابعة؟', 'استيراد', true))) return;
  const prev = state.catalog; state.catalog = data;
  state.catalog.settings.homeTitle = Object.assign(blankLoc(), data.settings.homeTitle); state.catalog.settings.homeSubtitle = Object.assign(blankLoc(), data.settings.homeSubtitle);
  state.catalog.settings.quickAmounts = Array.isArray(data.settings.quickAmounts) ? data.settings.quickAmounts : [10, 50, 100, 200];
  state.catalog.programs.forEach((p) => { p.title = Object.assign(blankLoc(), p.title); p.presets = p.presets || []; });
  state.catalog.catalogs.forEach((c) => { c.title = Object.assign(blankLoc(), c.title); c.subtitle = Object.assign(blankLoc(), c.subtitle); c.items = c.items || []; });
  markDirty(true); const ok = await flushSave();
  if (!ok && state.failed && false) state.catalog = prev;
  render(); toast(ok ? 'تم الاستيراد إلى المسودة ✓' : 'تم الاستيراد محلياً — راجع الأخطاء', ok ? 'ok' : 'warn');
}

/* =====================================================================
   13) ربط الأحداث (تفويض)
   ===================================================================== */
document.addEventListener('click', (ev) => {
  const el = ev.target.closest('[data-act]'); if (!el || el.disabled) return;
  if (el.type === 'checkbox') return;   // مفاتيح التفعيل تعالَج في change
  const fn = actions[el.dataset.act]; if (fn) { fn(el, ev); }
});
document.addEventListener('input', (ev) => {
  const el = ev.target;
  if (el.dataset && el.dataset.q) { ui.q = el.value; const r = $('[data-region="progList"]'); if (r) r.innerHTML = regions.progList(); return; }
  if (el.matches('[data-img-url]')) return;
  if (el.matches('[data-ctx][data-f]')) onField(el, ev);
});
document.addEventListener('change', (ev) => {
  const el = ev.target;
  if (el.matches('[data-act="toggle-active"]')) return actions['toggle-active'](el);
  if (el.matches('[data-ctx][data-f]')) return onField(el, ev);
  if (el.matches('[data-place]')) {
    const key = el.dataset.place; plSet(key, el.checked ? 'medium' : null);
    const row = el.closest('.pl-row'); row.classList.toggle('on', el.checked);
    $$('button', row).forEach((b) => { b.disabled = !el.checked; b.setAttribute('aria-pressed', String(b.dataset.v === 'medium')); });
    refreshRegions(); return;
  }
  if (el.matches('[data-img-file]')) { const f = el.files[0]; el.value = ''; if (f) handleFile(el.closest('.imgp').dataset.pk, f); return; }
  if (el.matches('[data-img-url]')) {
    const pk = el.closest('.imgp').dataset.pk; const v = el.value.trim();
    if (v && !/^(https:\/\/\S+|\/uploads\/[\w.\-]+)$/.test(v)) return imgError(pk, 'الرابط يجب أن يبدأ بـ https:// أو /uploads/');
    applyImage(pk, v); return;
  }
  if (el.id === 'importFile') { const f = el.files[0]; el.value = ''; if (f) doImport(f); }
});
document.addEventListener('keydown', (ev) => {
  if (ev.key === 'Enter' && ev.target.matches && ev.target.matches('[data-chipin]')) { ev.preventDefault(); chipAdd(ev.target.dataset.chipin); }
  if (ev.key === 'Escape' && ui.edit && !$('#dlg').open) closeEditor();
});

/* سحب وإفلات: ترتيب القوائم + ملفات الصور */
document.addEventListener('dragstart', (ev) => {
  const li = ev.target.closest && ev.target.closest('[data-dnd]'); if (!li) return;
  ui.drag = { list: li.dataset.dnd, i: +li.dataset.i }; li.classList.add('dragging'); ev.dataTransfer.effectAllowed = 'move'; try { ev.dataTransfer.setData('text/plain', 'row'); } catch (e) { /* */ }
});
document.addEventListener('dragend', () => { ui.drag = null; $$('.dragging,.over').forEach((x) => x.classList.remove('dragging', 'over')); });
document.addEventListener('dragover', (ev) => {
  const files = ev.dataTransfer && Array.from(ev.dataTransfer.types || []).includes('Files');
  const zone = ev.target.closest && ev.target.closest('.imgp');
  if (files && zone) { ev.preventDefault(); zone.classList.add('drag'); return; }
  const li = ev.target.closest && ev.target.closest('[data-dnd]');
  if (ui.drag && li && li.dataset.dnd === ui.drag.list) { ev.preventDefault(); $$('.over').forEach((x) => x.classList.remove('over')); li.classList.add('over'); }
});
document.addEventListener('dragleave', (ev) => { const z = ev.target.closest && ev.target.closest('.imgp'); if (z && !z.contains(ev.relatedTarget)) z.classList.remove('drag'); });
document.addEventListener('drop', (ev) => {
  const zone = ev.target.closest && ev.target.closest('.imgp');
  if (zone) { zone.classList.remove('drag'); const f = ev.dataTransfer.files && ev.dataTransfer.files[0]; if (f) { ev.preventDefault(); handleFile(zone.dataset.pk, f); return; } }
  const li = ev.target.closest && ev.target.closest('[data-dnd]');
  if (ui.drag && li && li.dataset.dnd === ui.drag.list) { ev.preventDefault(); const from = ui.drag.i, to = +li.dataset.i; ui.drag = null; moveItem(li.dataset.dnd, from, to); }
});
document.addEventListener('paste', (ev) => {
  const zone = ev.target.closest && ev.target.closest('.imgp'); if (!zone) return;
  const item = Array.from(ev.clipboardData ? ev.clipboardData.items : []).find((i) => i.kind === 'file' && i.type.startsWith('image/'));
  if (item) { ev.preventDefault(); const f = item.getAsFile(); if (f) handleFile(zone.dataset.pk, f); }
});

/* =====================================================================
   14) الدخول والإقلاع
   ===================================================================== */
function showLogin(msg) {
  $('#login').hidden = false; $('#app').hidden = !state.catalog; $('#loginErr').textContent = msg || '';
  document.body.classList.add('is-login'); setTimeout(() => $('#loginPw').focus(), 30);
}
function hideLogin() { $('#login').hidden = true; $('#app').hidden = false; document.body.classList.remove('is-login'); }
$('#loginForm').addEventListener('submit', async (ev) => {
  ev.preventDefault(); const btn = $('#loginBtn'); btn.disabled = true; $('#loginErr').textContent = '';
  try {
    await backend.login($('#loginPw').value); $('#loginPw').value = '';
    if (state.catalog) { hideLogin(); flushSave(); } else await boot();
  } catch (e) {
    $('#loginErr').textContent = e.status === 429 ? 'محاولات كثيرة — انتظر دقيقة ثم أعد المحاولة.' : e.status === 401 ? 'كلمة المرور غير صحيحة.' : (e.network ? 'تعذّر الاتصال بالخادم.' : (e.message || 'تعذّر تسجيل الدخول'));
  } finally { btn.disabled = false; }
});

async function boot() {
  try {
    const d = await backend.load();
    state.catalog = d.catalog; state.hasUnpublished = d.hasUnpublished; state.dirty = false;
    const S = C().settings; S.homeTitle = Object.assign(blankLoc(), S.homeTitle); S.homeSubtitle = Object.assign(blankLoc(), S.homeSubtitle);
  } catch (e) {
    if (e.status === 401) return showLogin();
    $('#app').hidden = true; $('#login').hidden = false; $('#loginErr').textContent = e.message || 'تعذّر التحميل'; return;
  }
  hideLogin();
  $('#demoBadge').hidden = backend.kind !== 'demo';
  $('#btnLogout').hidden = backend.kind === 'demo'; $('#btnLogout').innerHTML = ic('logout') + '<span>خروج</span>';
  $('#drawer .icon-btn').innerHTML = ic('x');
  render();
}
(function start() {
  if (backend.kind === 'demo' || (backend.hasSession && backend.hasSession())) boot(); else showLogin();
})();
