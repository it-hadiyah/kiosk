/* =====================================================================
   extras.js — منصّة الإدارة فوق app.js:
   الأدوار والصلاحيات، نظرة عامة (جودة المحتوى + الترجمات + إحصائيات المحاكاة + حالة الأجهزة)،
   مكتبة الوسائط، سجل التدقيق، والمحرر المباشر (اضغط بطاقة في المعاينة لتعديلها).
   يُحمَّل بعد app.js ويستخدم نفس الأدوات العامة (ui, state, regions, actions, backend…).
   ===================================================================== */
'use strict';

const ALL_PERMS = ['read', 'edit', 'upload', 'publish', 'settings', 'media_delete', 'audit', 'stats', 'devices'];
const ROLE_LABEL = { super: 'مدير النظام', manager: 'مدير المحتوى', editor: 'محرّر', viewer: 'مشاهد', device: 'كيوسك' };
ui.role = 'super'; ui.can = new Set(ALL_PERMS);
const can = (p) => ui.can.has(p);
const feat = (f) => !!(backend.features && backend.features[f]);

ICONS.chart = 'M3 3v18h18M7 15l4-4 3 3 5-6';
ICONS.shield = 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z';
ICONS.monitor = 'M3 4h18v12H3zM8 20h8M12 16v4';

TABS.unshift({ k: 'overview', label: 'نظرة عامة', icon: 'chart' });
TABS.splice(TABS.findIndex((t) => t.k === 'settings'), 0, { k: 'media', label: 'الوسائط', icon: 'image' });
if (feat('stats')) TABS.splice(1, 0, { k: 'dashboard', label: 'لوحة المؤشرات', icon: 'chart' });
VIEWS.dashboard = () => viewDashboard();
if (feat('devices')) TABS.splice(TABS.findIndex((t) => t.k === 'settings'), 0, { k: 'devices', label: 'الأجهزة', icon: 'monitor' });
VIEWS.devices = () => viewDevices();
VIEWS.overview = () => viewOverview();
VIEWS.media = () => viewMedia();
ui.tab = 'overview';

const KB = (n) => (n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB');
const ago = (iso) => {
  if (!iso) return '—';
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'الآن'; if (s < 3600) return `قبل ${nf(Math.floor(s / 60))} دقيقة`;
  if (s < 86400) return `قبل ${nf(Math.floor(s / 3600))} ساعة`; return `قبل ${nf(Math.floor(s / 86400))} يوم`;
};
const pct = (a, b) => (b > 0 ? Math.round((a / b) * 100) + '%' : '—');

/* ---------- الأدوار ---------- */
async function onBoot() {
  if (backend.devices) { try { ui.devs = await backend.devices(); } catch (e) { ui.devs = []; } }
  if (backend.me) { try { const m = await backend.me(); ui.role = m.role; ui.can = new Set(m.can || []); } catch (e) { /* يبقى الافتراضي */ } }
  if (!can('devices')) { const i = TABS.findIndex((t) => t.k === 'devices'); if (i >= 0) TABS.splice(i, 1); }
  if (!can('stats')) { const i = TABS.findIndex((t) => t.k === 'dashboard'); if (i >= 0) TABS.splice(i, 1); }
  ALL_PERMS.forEach((p) => document.body.classList.toggle('can-' + p, can(p)));
  document.body.dataset.role = ui.role;
  const top = $('.top-status');
  if (top && feat('roles') && !$('#roleBadge')) top.insertAdjacentHTML('afterbegin', `<span id="roleBadge" class="badge role">${ic('shield')}${esc(ROLE_LABEL[ui.role] || ui.role)}</span>`);
  if (!can('edit')) {
    const main = $('#main'), dr = $('#drawerBody');
    const mo = new MutationObserver(() => lockUi());
    mo.observe(main, { childList: true, subtree: true }); mo.observe(dr, { childList: true, subtree: true });
    $('#view').insertAdjacentHTML('beforebegin', '<div class="rolebar" role="status">أنت في وضع «مشاهد»: يمكنك الاطلاع فقط، ولا يمكن التعديل أو النشر.</div>');
  } else if (!can('settings')) {
    new MutationObserver(() => lockUi()).observe($('#main'), { childList: true, subtree: true });
  }
}
const KEEP = '.navb,[data-act="close-editor"],[data-act="tab"],[data-act="edit-prog"],[data-act="edit-cat"],[data-act="pv-lang"],[data-act="pv-dev"],[data-act="feat-step"],[data-act="feat-go"],[data-q],[data-mq],[data-act="export"],[data-act="ov-open"],[data-act="media-copy"],[data-act="ov-refresh"],[data-act="media-filter"],[data-act="audit-refresh"],[data-act="dismiss-err"]';
function lockUi() {
  if (!can('edit')) {
    $$('#view input,#view select,#view textarea,#view button,#drawerBody input,#drawerBody select,#drawerBody textarea,#drawerBody button,#drawerFoot button').forEach((el) => { if (!el.matches(KEEP) && !el.disabled) el.disabled = true; });
  } else if (!can('settings') && ui.tab === 'settings') {
    $$('#view input,#view select,#view textarea,#view button').forEach((el) => { if (!el.disabled) el.disabled = true; });
    if (!$('#view .rolebar')) $('#view').insertAdjacentHTML('afterbegin', '<div class="rolebar" role="status">الإعدادات العامة يعدّلها «مدير المحتوى» أو أعلى.</div>');
  }
}

/* ---------- جودة المحتوى والترجمات ---------- */
function placed(kind, id) {
  const c = C();
  if (c.home.some((h) => h.type === kind && h.id === id)) return true;
  if (kind === 'program') return c.catalogs.some((k) => k.items.some((i) => i.programId === id)) || c.featured.items.some((x) => x.type === 'program' && x.id === id);
  return c.featured.items.some((x) => x.type === 'catalog' && x.id === id);
}
function qualityIssues() {
  const c = C(); const out = [];
  const each = (kind, list) => list.filter((o) => o.active).forEach((o) => {
    const label = kind === 'program' ? 'برنامج' : 'كتالوج';
    const act = kind === 'program' ? 'edit-prog' : 'edit-cat';
    if (!o.image) out.push({ k: 'img', text: `${label} «${tt(o)}» بلا صورة`, act, id: o.id });
    const miss = LANGS.filter((l) => !String((o.title || {})[l.k] || '').trim()).map((l) => l.name);
    if (miss.length) out.push({ k: 'tr', text: `${label} «${tt(o)}»: ينقص العنوان بـ ${miss.join('، ')}`, act, id: o.id });
    if (kind === 'program' && o.kind === 'free') {
      const filled = LANGS.filter((l) => String((o.popupTitle || {})[l.k] || '').trim());
      if (filled.length && filled.length < LANGS.length) out.push({ k: 'tr', text: `«${tt(o)}»: عبارة النافذة غير مكتملة الترجمة`, act, id: o.id });
    }
    if (backend.devices && ui.devs && (o.kiosks || []).some((id) => !ui.devs.some((d) => d.deviceId === id))) out.push({ k: 'place', text: `${label} «${tt(o)}» محدد لجهاز غير معروف (لن يراه أي كيوسك)`, act, id: o.id });
    if (!placed(kind, o.id)) out.push({ k: 'place', text: `${label} «${tt(o)}» مفعّل لكنه غير موضوع في أي مكان (لن يراه المتبرع)`, act, id: o.id });
    if (kind === 'catalog' && !o.items.some((i) => { const p = findProg(i.programId); return p && p.active; })) out.push({ k: 'empty', text: `كتالوج «${tt(o)}» بلا برامج مفعّلة`, act, id: o.id });
  });
  each('program', c.programs); each('catalog', c.catalogs);
  if (c.featured.enabled && !featItems().length) out.push({ k: 'feat', text: 'شريط «الأكثر رواجاً» مفعّل بلا عناصر ظاهرة' });
  if (!c.settings.welcomeBackground) out.push({ k: 'info', text: 'خلفية شاشة الترحيب غير محددة (تُستخدم الصورة المضمّنة في التطبيق)' });
  return out;
}
function translationRows() {
  const rows = [];
  const add = (type, o) => { if (o.active) rows.push({ type, o, ok: LANGS.map((l) => !!String((o.title || {})[l.k] || '').trim()) }); };
  C().programs.forEach((p) => add('program', p)); C().catalogs.forEach((k) => add('catalog', k));
  return rows;
}

/* ---------- نظرة عامة ---------- */
function viewOverview() {
  return `<div class="page-h"><div><h2>نظرة عامة</h2><p class="muted">حالة المحتوى المنشور، وجودته، وأداء المحاكاة على الكيوسك.</p></div>
    <button class="btn" type="button" data-act="ov-refresh">${ic('clock')}تحديث</button></div>
  <div class="stack"><div data-region="ovCards"></div><div data-region="ovQuality"></div><div data-region="ovTr"></div>
  <div data-region="ovStats"></div><div data-region="ovDevices"></div></div>`;
}
const stat = (n, label, cls = '') => `<div class="stat ${cls}"><strong>${n}</strong><span>${esc(label)}</span></div>`;
regions.ovCards = () => {
  const c = C(); const ap = c.programs.filter((p) => p.active).length, ac = c.catalogs.filter((k) => k.active).length;
  const off = c.programs.length + c.catalogs.length - ap - ac;
  const un = state.dirty || state.hasUnpublished;
  const liveAt = (ui.live && ui.live.updatedAt) || state.liveAt;
  return `<div class="ovgrid">${stat(nf(ap), 'برامج نشطة')}${stat(nf(ac), 'كتالوجات نشطة')}${stat(nf(off), 'عناصر موقوفة', off ? 'warn' : '')}
    ${stat(un ? 'نعم' : 'لا', 'تغييرات غير منشورة', un ? 'warn' : 'ok')}${stat(liveAt ? ago(liveAt) : '—', 'آخر نشر')}${stat(c.updatedAt ? ago(c.updatedAt) : '—', 'آخر تعديل')}</div>`;
};
regions.ovQuality = () => {
  const q = qualityIssues();
  const real = q.filter((x) => x.k !== 'info');
  return `<section class="card"><h3>جودة المحتوى <span class="count">${nf(real.length)}</span></h3>
    ${q.length ? `<ul class="rows plain qlist">${q.map((x) => `<li class="row"><span class="qk ${x.k}">${{ img: 'صورة', tr: 'ترجمة', place: 'ظهور', empty: 'فارغ', feat: 'رواجاً', info: 'ملاحظة' }[x.k]}</span><div class="row-t">${esc(x.text)}</div>${x.act ? `<button class="btn small" type="button" data-act="${x.act}" data-id="${esc(x.id)}">فتح</button>` : ''}</li>`).join('')}</ul>` : `<p class="ok-line">${ic('check')}كل شيء مكتمل: صور وترجمات وأماكن ظهور.</p>`}</section>`;
};
regions.ovTr = () => {
  const rows = translationRows(); if (!rows.length) return '';
  const miss = LANGS.map((l, i) => rows.filter((r) => !r.ok[i]).length);
  return `<section class="card"><h3>الترجمات</h3><p class="hint">✓ = العنوان مترجم. اللغة العربية إلزامية، والبقية تظهر بالعربية عند غياب الترجمة.</p>
    <div class="trwrap"><table class="trt"><thead><tr><th>العنصر</th>${LANGS.map((l, i) => `<th>${l.name}${miss[i] ? ` <span class="count warn">${nf(miss[i])}</span>` : ''}</th>`).join('')}</tr></thead>
    <tbody>${rows.map((r) => `<tr><td>${esc(tt(r.o))}</td>${r.ok.map((ok) => `<td class="${ok ? 'y' : 'n'}">${ok ? '✓' : '✗'}</td>`).join('')}</tr>`).join('')}</tbody></table></div></section>`;
};
const bar = (v, max) => `<span class="bar"><i style="width:${max ? Math.round((v / max) * 100) : 0}%"></i></span>`;
regions.ovStats = () => {
  if (!feat('stats') || !can('stats')) return `<section class="card"><h3>إحصائيات المحاكاة</h3><p class="muted">الإحصائيات تتطلب ربط الكيوسك بالخادم وصلاحية «مدير المحتوى».</p></section>`;
  const S = ui.stats;
  return `<section class="card"><div class="card-h"><h3>إحصائيات المحاكاة <span class="badge off">بيانات تجريبية</span></h3><button class="btn small primary" type="button" data-act="tab" data-tab="dashboard">${ic('chart')}افتح لوحة المؤشرات</button></div>
    ${S ? `<div class="ovgrid">${stat(nf(S.sessions), 'جلسات بدأت')}${stat(nf(S.completed), 'محاكاة مكتملة')}${stat(pct(S.completed, S.sessions), 'معدل الإكمال', 'ok')}</div>` : '<p class="muted">جارٍ التحميل…</p>'}
    <p class="hint">التفاصيل لكل جهاز وبرنامج وكتالوج في «لوحة المؤشرات».</p></section>`;
};
regions.ovDevices = () => {
  const bySess = feat('devices') && can('devices');
  if (!bySess && !(feat('stats') && can('stats') && ui.stats)) return '';
  if (bySess && !ui.sessions) return '';
  const devs = bySess
    ? ui.sessions.filter((x) => x.status === 'active').map((x) => ({ id: x.kioskName || x.id, sub: x.label, lastSeen: x.lastSeen, version: x.version }))
    : Object.entries(ui.stats.devices || {}).map(([id, d]) => ({ id, ...d }));
  devs.sort((a2, b2) => String(b2.lastSeen || '').localeCompare(String(a2.lastSeen || '')));
  return `<section class="card"><h3>أجهزة الكيوسك <span class="count">${nf(devs.length)}</span></h3>
    ${devs.length ? `<ul class="rows plain">${devs.map((d) => { const on = d.lastSeen && Date.now() - new Date(d.lastSeen).getTime() < 3 * 60 * 1000;
      return `<li class="row"><span class="dot ${on ? 'on' : 'off'}" aria-hidden="true"></span><div class="row-t"><strong>${esc(d.id)}</strong><div class="muted small">${d.sub ? esc(d.sub) + ' · ' : ''}آخر اتصال ${esc(ago(d.lastSeen))} · إصدار التطبيق ${esc(d.version || '—')}</div></div><span class="badge ${on ? 'kind' : 'off'}">${on ? 'متصل' : 'غير متصل'}</span></li>`; }).join('')}</ul>` : `<p class="muted">لا يوجد كيوسك مفعّل بعد. ${bySess ? 'افتح جلسة من تبويب «الأجهزة» ثم أدخل معرفها في الكيوسك.' : ''}</p>`}</section>`;
};
async function loadOverviewData() {
  try { ui.live = normClient(await backend.fetchLive()); } catch (e) { /* يبقى */ }
  if (feat('devices') && can('devices')) { try { ui.sessions = await backend.sessions(); } catch (e) { /* يبقى */ } }
  if (feat('stats') && can('stats')) { try { ui.stats = await backend.stats(); ui.statsErr = ''; } catch (e) { ui.stats = null; ui.statsErr = e.message || 'تعذّر تحميل الإحصائيات'; } }
  refreshRegions();
}

/* ---------- مكتبة الوسائط ---------- */
function usageOf(m) {
  const u = new Set(m.usedBy || []); const c = C();
  c.programs.forEach((p) => { if (p.image === m.url) u.add(`برنامج «${tt(p)}»`); if (p.popupImage === m.url) u.add(`نافذة «${tt(p)}»`); });
  c.catalogs.forEach((k) => { if (k.image === m.url) u.add(`كتالوج «${tt(k)}»`); });
  if (c.settings.welcomeBackground === m.url) u.add('خلفية الترحيب');
  return [...u];
}
function viewMedia() {
  return `<div class="page-h"><div><h2>الوسائط</h2><p class="muted">كل الصور المرفوعة: تصفّح، أعد الاستخدام، وتعرّف أين تُستخدم كل صورة. لا يمكن حذف صورة مستخدمة.</p></div>
    ${can('upload') ? `<button class="btn primary" type="button" data-act="media-upload">${ic('upload')}رفع صورة</button><input id="mediaFile" type="file" accept="image/jpeg,image/png,image/webp" hidden>` : ''}</div>
  <div class="toolbar row-tools"><div class="search">${ic('search')}<label class="sr" for="mq">بحث في الوسائط</label><input id="mq" type="search" data-mq="1" placeholder="ابحث باسم الملف…" value="${esc(ui.mq || '')}"></div>
    <div class="seg" role="group" aria-label="تصفية">${[['all', 'الكل'], ['used', 'مستخدمة'], ['free', 'غير مستخدمة']].map(([k, n]) => `<button type="button" data-act="media-filter" data-v="${k}" aria-pressed="${(ui.mf || 'all') === k}">${n}</button>`).join('')}</div></div>
  <div data-region="mediaGrid"></div>`;
}
regions.mediaGrid = () => {
  if (!ui.media) return `<p class="muted">${ui.mediaErr ? esc(ui.mediaErr) : 'جارٍ التحميل…'}</p>`;
  const q = (ui.mq || '').trim().toLowerCase(); const f = ui.mf || 'all';
  const list = ui.media.map((m) => ({ ...m, use: usageOf(m) })).filter((m) => (!q || m.name.toLowerCase().includes(q)) && (f === 'all' || (f === 'used') === (m.use.length > 0)));
  if (!list.length) return '<div class="empty"><strong>لا توجد صور مطابقة</strong></div>';
  return `<div class="mgrid">${list.map((m) => `<article class="mcard"><div class="mimg"><img src="${esc(imgSrc(m.url))}" alt="" loading="lazy"></div>
    <div class="mbody"><strong dir="ltr" class="mname" title="${esc(m.name)}">${esc(m.name)}</strong><span class="muted small">${KB(m.size || 0)}${m.at ? ' · ' + esc(ago(m.at)) : ''}</span>
    ${m.use.length ? `<span class="badge kind" title="${esc(m.use.join('\n'))}">مستخدمة (${nf(m.use.length)})</span>` : '<span class="badge off">غير مستخدمة</span>'}
    <div class="btnrow tight"><button class="btn small" type="button" data-act="media-copy" data-url="${esc(m.url)}">نسخ الرابط</button>
    ${feat('deleteMedia') && can('media_delete') ? `<button class="btn small danger-o" type="button" data-act="media-del" data-name="${esc(m.name)}" ${m.use.length ? 'disabled title="مستخدمة — أزلها أولاً"' : ''}>${ic('trash')}</button>` : ''}</div></div></article>`).join('')}</div>`;
};
async function loadMedia() {
  try { ui.media = await backend.media(); ui.mediaErr = ''; } catch (e) { ui.media = null; ui.mediaErr = e.message || 'تعذّر تحميل الوسائط'; }
  refreshRegions();
}

/* نافذة «اختيار من المكتبة» داخل منتقي الصور */
async function openLibrary(pk) {
  let dlg = $('#libDlg'); if (!dlg) { document.body.insertAdjacentHTML('beforeend', '<dialog id="libDlg" class="dlg lib"></dialog>'); dlg = $('#libDlg'); }
  dlg.innerHTML = '<div class="lib-h"><h3>اختر صورة من المكتبة</h3><button class="icon-btn" type="button" data-lib-close aria-label="إغلاق"></button></div><div class="lib-body"><p class="muted">جارٍ التحميل…</p></div>';
  $('[data-lib-close]', dlg).innerHTML = ic('x'); dlg.showModal();
  let list = [];
  try { list = await backend.media(); } catch (e) { $('.lib-body', dlg).innerHTML = `<p class="err">${esc(e.message || 'تعذّر التحميل')}</p>`; return; }
  $('.lib-body', dlg).innerHTML = list.length ? `<div class="mgrid lib-grid">${list.map((m) => `<button type="button" class="mcard pick" data-lib-pick="${esc(m.url)}" title="${esc(m.name)}"><div class="mimg"><img src="${esc(imgSrc(m.url))}" alt="${esc(m.name)}"></div></button>`).join('')}</div>` : '<p class="muted">لا توجد صور مرفوعة بعد.</p>';
  dlg.onclick = (ev) => {
    if (ev.target === dlg || ev.target.closest('[data-lib-close]')) return dlg.close();
    const b = ev.target.closest('[data-lib-pick]'); if (b) { applyImage(pk, b.dataset.libPick); dlg.close(); toast('تم اختيار الصورة ✓'); }
  };
}

/* ---------- سجل التدقيق ---------- */
const AUDIT_LABEL = { login: 'دخول', login_failed: 'دخول فاشل', draft_save: 'تعديل مسودة', publish: 'نشر', restore: 'استرجاع', upload: 'رفع صورة', media_delete: 'حذف صورة', stats_reset: 'تصفير الإحصائيات', session_create: 'فتح جلسة', device_activate: 'تفعيل كيوسك', session_end: 'إنهاء جلسة', device_end: 'إنهاء من الكيوسك', session_rename: 'تعديل كيوسك', session_delete: 'حذف جلسة' };
regions.audit = () => {
  if (!feat('audit')) return `<section class="card"><h3>سجل التدقيق</h3><p class="muted">متاح عند الاتصال بالخادم (غير متاح في النسخة التجريبية).</p></section>`;
  if (!can('audit')) return '';
  const L = ui.audit;
  return `<section class="card"><div class="card-h"><h3>سجل التدقيق</h3><button class="btn small" type="button" data-act="audit-refresh">${ic('clock')}تحديث</button></div>
    <p class="hint">من عدّل أو نشر أو رفع ومتى — آخر 200 حدث.</p>
    ${L == null ? `<p class="muted">${ui.auditErr ? esc(ui.auditErr) : 'جارٍ التحميل…'}</p>` : L.length ? `<ul class="rows plain alist">${L.map((e) => `<li class="row"><span class="ak a-${esc(e.action)}">${esc(AUDIT_LABEL[e.action] || e.action)}</span><div class="row-t">${esc(e.summary)}<div class="muted small">${esc(ROLE_LABEL[e.role] || e.role)} · ${esc(fmtDate(e.at))}${e.ip ? ' · <span dir="ltr">' + esc(e.ip.replace('::ffff:', '')) + '</span>' : ''}</div></div></li>`).join('')}</ul>` : '<p class="muted">لا أحداث بعد.</p>'}</section>`;
};
async function loadAudit() {
  if (!feat('audit') || !can('audit')) return;
  try { ui.audit = await backend.audit(); ui.auditErr = ''; } catch (e) { ui.audit = null; ui.auditErr = e.message || 'تعذّر تحميل السجل'; }
  refreshRegions();
}

/* ---------- ربط التبويبات والإجراءات ---------- */
function onTab(k) {
  clearInterval(ui.sessTimer);
  if (k === 'overview') loadOverviewData();
  if (k === 'dashboard') { loadDashboard(); ui.sessTimer = setInterval(() => { if (ui.tab === 'dashboard') loadDashboard(true); else clearInterval(ui.sessTimer); }, 30000); }
  if (k === 'media') loadMedia();
  if (k === 'devices') { loadSessions(); ui.sessTimer = setInterval(() => { if (ui.tab === 'devices') loadSessions(); else clearInterval(ui.sessTimer); }, 30000); }
}
Object.assign(actions, {
  'ov-open'(el) { actions[el.dataset.kind === 'cat' ? 'edit-cat' : 'edit-prog'](el); },
  'ov-refresh'() { loadOverviewData(); },
  'audit-refresh'() { loadAudit(); },
  'img-library'(el) { openLibrary(el.closest('.imgp').dataset.pk); },
  'media-upload'() { $('#mediaFile').click(); },
  'media-filter'(el) { ui.mf = el.dataset.v; $$('[data-act="media-filter"]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === ui.mf))); refreshRegions(); },
  async 'media-copy'(el) {
    const abs = new URL(el.dataset.url, location.href).href;
    try { await navigator.clipboard.writeText(abs); toast('تم نسخ الرابط ✓'); } catch (e) { toast(abs, 'warn'); }
  },
  async 'media-del'(el) {
    if (!(await confirmDlg(`حذف الصورة ${el.dataset.name} نهائياً؟`, 'حذف', true))) return;
    try { await backend.deleteMedia(el.dataset.name); toast('تم حذف الصورة'); loadMedia(); }
    catch (e) { toast(e.message || 'تعذّر الحذف', 'warn'); }
  },
  async 'stats-reset'() {
    if (!(await confirmDlg('تصفير كل إحصائيات المحاكاة؟ لا يمكن التراجع.', 'تصفير', true))) return;
    try { await backend.resetStats(); toast('تم التصفير'); loadOverviewData(); } catch (e) { toast(e.message || 'تعذّر التصفير', 'warn'); }
  },
});
document.addEventListener('input', (ev) => {
  const el = ev.target; if (!el.matches || !el.matches('[data-mq]')) return;
  ui.mq = el.value; const r = $('[data-region="mediaGrid"]'); if (r) r.innerHTML = regions.mediaGrid();
});
document.addEventListener('change', async (ev) => {
  const el = ev.target; if (!el.matches || !el.matches('#mediaFile')) return;
  const f = el.files[0]; el.value = ''; if (!f) return;
  if (!/^image\/(jpeg|png|webp)$/.test(f.type)) return toast('الملف غير مدعوم — اختر jpg أو png أو webp', 'warn');
  try { const url = await backend.upload(await downscale(f)); toast('تم رفع الصورة ✓'); await loadMedia(); announce('تم رفع ' + url); }
  catch (e) { if (e.status === 401) showLogin('انتهت الجلسة، أعد تسجيل الدخول.'); else toast(e.message || 'تعذّر الرفع', 'warn'); }
});

/* المحرر المباشر: اضغط أي بطاقة في المعاينة لفتح محررها */
document.addEventListener('click', (ev) => {
  const t = ev.target.closest('.phone [data-tile]'); if (!t || ev.target.closest('[data-act]') || ui.edit) return;
  const [type, id] = t.dataset.tile.split(':');
  ev.preventDefault(); openEditor(type === 'catalog' ? 'cat' : 'prog', id);
});

/* ---------- الهوية البصرية (ألوان + استدارة) داخل الإعدادات ---------- */
const THEME_DEF = { primary: '#00A092', ink: '#1F4A47', radius: 'normal' };
const RADIUS_LABEL = { sharp: 'حادة', normal: 'عادية', round: 'مستديرة' };
const _viewSettings = viewSettings;
VIEWS.settings = () => _viewSettings().replace(/<\/div>\s*$/, '<div data-region="themeCard"></div></div>');
function themeInfoHtml() {
  const t = C().settings.theme; const e = settingsErrors(C().settings);
  const c1 = contrastHex(t.primary, '#FFFFFF'), c2 = contrastHex(t.ink, '#F4F6F6');
  const line = (ok, txt) => `<li class="${ok ? 'okc' : 'badc'}">${ok ? '✓' : '✗'} ${esc(txt)}</li>`;
  const r = { sharp: 6, normal: 18, round: 30 }[t.radius] || 18;
  return `<div class="th-demo" style="--c:${esc(t.primary)};--i:${esc(t.ink)};--r:${r}px">
      <div class="th-tile"><span>سقيا الماء</span></div><button type="button" class="th-btn" tabindex="-1">متابعة للدفع</button><span class="th-chip">50 ر.س</span></div>
    <ul class="th-checks">${line(!e.themePrimary, `اللون الأساسي — التباين مع النص الأبيض ${c1.toFixed(1)} (الحد الأدنى 3)`)}${line(!e.themeInk, `لون النصوص — التباين مع الخلفية ${c2.toFixed(1)} (الحد الأدنى 4.5)`)}</ul>
    ${e.themePrimary || e.themeInk ? '<p class="err">لن تُحفظ الهوية حتى تُصحَّح الألوان أعلاه.</p>' : ''}`;
}
regions.themeCard = () => {
  const t = C().settings.theme;
  const changed = JSON.stringify(t) !== JSON.stringify(THEME_DEF);
  return `<section class="card"><div class="card-h"><h3>الهوية البصرية</h3>${changed ? '<button class="btn small" type="button" data-act="theme-reset">استعادة الافتراضي</button>' : ''}</div>
    <p class="hint">لون العلامة ولون النصوص ودرجة استدارة الزوايا في تطبيق الكيوسك. الحدود تمنع ألواناً ضعيفة التباين. تظهر التغييرات في الكيوسك بعد «نشر التغييرات».</p>
    <div class="grid2"><div class="field"><label for="thPrimary">اللون الأساسي (الأزرار والشارات)</label><div class="colorrow"><input id="thPrimary" type="color" data-ctx="set" data-f="theme.primary" value="${esc(t.primary)}"><code dir="ltr">${esc(t.primary)}</code></div></div>
    <div class="field"><label for="thInk">لون النصوص والعناوين</label><div class="colorrow"><input id="thInk" type="color" data-ctx="set" data-f="theme.ink" value="${esc(t.ink)}"><code dir="ltr">${esc(t.ink)}</code></div></div></div>
    <div class="field"><label>استدارة الزوايا</label><div class="seg" role="group" aria-label="استدارة الزوايا">${['sharp', 'normal', 'round'].map((k) => `<button type="button" data-act="theme-radius" data-v="${k}" aria-pressed="${t.radius === k}">${RADIUS_LABEL[k]}</button>`).join('')}</div></div>
    <div id="themeInfo">${themeInfoHtml()}</div></section>`;
};
function themeChanged() {
  markDirty(); const el = $('#themeInfo'); if (el) el.innerHTML = themeInfoHtml();
  $$('[data-region="themeCard"] code').forEach((c, i) => { c.textContent = C().settings.theme[i ? 'ink' : 'primary']; });
  refreshRegions();
}
Object.assign(actions, {
  'theme-radius'(el) { C().settings.theme.radius = el.dataset.v; $$('[data-act="theme-radius"]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === el.dataset.v))); themeChanged(); const r = $('[data-region="themeCard"]'); if (r) r.innerHTML = regions.themeCard(); },
  'theme-reset'() { C().settings.theme = { ...THEME_DEF }; markDirty(); ui.forceRegions = true; refreshRegions(); ui.forceRegions = false; },
});

/* ---------- الأجهزة: جلسات الكيوسكات ---------- */
const fmtCode = (c) => String(c || '').replace(/^(\d{4})(\d{4})$/, '$1-$2');
const SESS_STATUS = { pending: ['بانتظار التفعيل', 'off'], active: ['نشط', 'kind'], ended: ['منتهية', 'off'] };
function viewDevices() {
  return `<div class="page-h"><div><h2>الأجهزة</h2><p class="muted">كل كيوسك يُفعَّل بمعرف جلسة تنشئه من هنا، ويُسمّى عند التفعيل. عند نقل الكيوسك إلى مكان آخر أنهِ جلسته وافتح له جلسة جديدة.</p></div>
    ${can('devices') ? `<button class="btn primary" type="button" data-act="sess-new">${ic('plus')}فتح جلسة جديدة</button>` : ''}</div>
  <section class="card steps"><h3>كيف أفعّل كيوسكاً؟</h3><ol><li>اضغط «فتح جلسة جديدة» (واكتب مكان الكيوسك إن أردت).</li><li>يظهر <b>معرف الجلسة</b> من 8 أرقام.</li><li>افتح التطبيق على الكيوسك، وأدخل المعرف مع <b>اسم الكيوسك</b> ثم «تفعيل».</li></ol></section>
  <div data-region="devList"></div>`;
}
regions.devList = () => {
  if (!ui.sessions) return `<p class="muted">${ui.sessErr ? esc(ui.sessErr) : 'جارٍ التحميل…'}</p>`;
  if (!ui.sessions.length) return `<div class="empty">${ic('monitor')}<strong>لا توجد جلسات بعد</strong><p>اضغط «فتح جلسة جديدة» لتفعيل أول كيوسك.</p></div>`;
  return `<div class="sgrid">${ui.sessions.map((x) => {
    const on = x.status === 'active' && x.lastSeen && Date.now() - new Date(x.lastSeen).getTime() < 3 * 60 * 1000;
    const [stTxt, stCls] = SESS_STATUS[x.status] || ['—', 'off'];
    const expired = x.status === 'pending' && Date.parse(x.codeExpiresAt) < Date.now();
    return `<article class="scard ${esc(x.status)}"><div class="sc-h"><span class="dot ${on ? 'on' : 'off'}" aria-hidden="true"></span>
      <strong class="sc-name">${esc(x.kioskName || (x.status === 'pending' ? 'كيوسك جديد' : '—'))}</strong><span class="badge ${stCls}">${esc(expired ? 'انتهت صلاحية المعرف' : stTxt)}</span></div>
      ${x.label ? `<div class="muted">المكان: ${esc(x.label)}</div>` : ''}
      <div class="sc-code"><span>معرف الجلسة</span><b dir="ltr">${esc(fmtCode(x.code))}</b>${x.status === 'pending' && !expired ? `<button class="btn small" type="button" data-act="sess-copy" data-code="${esc(x.code)}">نسخ</button>` : ''}</div>
      ${x.status === 'pending' ? `<p class="hint">${expired ? 'أنشئ جلسة جديدة' : 'أدخله في الكيوسك قبل ' + esc(fmtDate(x.codeExpiresAt))}</p>` : ''}
      ${x.status === 'active' ? `<div class="muted small">آخر اتصال ${esc(ago(x.lastSeen))} · إصدار ${esc(x.version || '—')}</div><div class="muted small">جلسات المحاكاة ${nf(x.started || 0)} · المكتملة ${nf(x.completed || 0)} · فُعّل ${esc(ago(x.activatedAt))}</div>` : ''}
      ${x.status === 'ended' ? `<div class="muted small">انتهت ${esc(ago(x.endedAt))}${x.kioskName ? '' : ''}</div>` : ''}
      <div class="btnrow tight">${can('devices') ? `${x.status !== 'ended' ? `<button class="btn small" type="button" data-act="sess-rename" data-id="${esc(x.id)}">${ic('edit')}تعديل</button>` : ''}
        ${x.status !== 'ended' ? `<button class="btn small danger-o" type="button" data-act="sess-end" data-id="${esc(x.id)}">${x.status === 'pending' ? 'إلغاء المعرف' : 'إنهاء الجلسة'}</button>` : `<button class="btn small danger-o" type="button" data-act="sess-del" data-id="${esc(x.id)}">${ic('trash')}حذف</button>`}` : ''}</div></article>`;
  }).join('')}</div>`;
};
async function loadSessions(force) {
  if (!feat('devices') || !can('devices')) return;
  try { ui.sessions = await backend.sessions(); ui.sessErr = ''; } catch (e) { if (!ui.sessions) ui.sessErr = e.message || 'تعذّر تحميل الجلسات'; }
  if (backend.devices) { try { ui.devs = await backend.devices(); } catch (e) { /* يبقى */ } }
  ui.forceRegions = !!force; refreshRegions(); ui.forceRegions = false;
}
function askFields(title, fields, okLabel = 'حفظ') {
  return new Promise((res) => {
    const old = $('#askDlg'); if (old) old.remove();
    document.body.insertAdjacentHTML('beforeend', `<dialog id="askDlg" class="dlg ask"><form method="dialog"><h3>${esc(title)}</h3>${fields.map((f, i) => `<div class="field"><label for="ask${i}">${esc(f.label)}</label><input id="ask${i}" type="text" maxlength="${f.max || 60}" value="${esc(f.value || '')}" placeholder="${esc(f.ph || '')}" autocomplete="off"></div>`).join('')}
      <div class="dlg-btns"><button class="btn ghost" type="button" data-ask-cancel>إلغاء</button><button class="btn primary" value="yes">${esc(okLabel)}</button></div></form></dialog>`);
    const d = $('#askDlg');
    d.addEventListener('click', (ev) => { if (ev.target.closest('[data-ask-cancel]')) d.close('no'); });
    d.addEventListener('close', () => { const ok = d.returnValue === 'yes'; res(ok ? Object.fromEntries(fields.map((f, i) => [f.k, $('#ask' + i, d).value])) : null); d.remove(); });
    d.showModal(); $('#ask0', d).focus();
  });
}
function showCodeDlg(sess) {
  const old = $('#codeDlg'); if (old) old.remove();
  document.body.insertAdjacentHTML('beforeend', `<dialog id="codeDlg" class="dlg ask"><form method="dialog"><h3>معرف الجلسة الجديدة</h3>
    <div class="bigcode" dir="ltr" id="bigCode">${esc(fmtCode(sess.code))}</div>
    <p class="muted">${sess.label ? 'للمكان: ' + esc(sess.label) + '. ' : ''}اكتب هذا المعرف في شاشة التفعيل بالكيوسك مع اسم له. يعمل <b>لمرة واحدة</b> ويصلح 24 ساعة.</p>
    <div class="dlg-btns"><button class="btn" type="button" data-copy-code="${esc(sess.code)}">نسخ</button><button class="btn primary" value="yes">تم</button></div></form></dialog>`);
  const d = $('#codeDlg');
  d.addEventListener('click', async (ev) => { const b = ev.target.closest('[data-copy-code]'); if (b) { try { await navigator.clipboard.writeText(b.dataset.copyCode); toast('تم نسخ المعرف ✓'); } catch (e) { toast(b.dataset.copyCode, 'warn'); } } });
  d.addEventListener('close', () => d.remove()); d.showModal();
}
Object.assign(actions, {
  async 'sess-new'() {
    const v = await askFields('فتح جلسة كيوسك جديدة', [{ k: 'label', label: 'مكان الكيوسك (اختياري)', ph: 'مثال: بهو الفرع الرئيسي' }], 'إنشاء المعرف');
    if (!v) return;
    try { const sess = await backend.createSession(v.label); showCodeDlg(sess); await loadSessions(true); } catch (e) { toast(e.message || 'تعذّر إنشاء الجلسة', 'warn'); }
  },
  async 'sess-rename'(el) {
    const x = (ui.sessions || []).find((q) => q.id === el.dataset.id); if (!x) return;
    const v = await askFields('تعديل بيانات الكيوسك', [{ k: 'kioskName', label: 'اسم الكيوسك', value: x.kioskName, max: 40 }, { k: 'label', label: 'المكان', value: x.label }]);
    if (!v) return;
    try { await backend.renameSession(x.id, v.kioskName, v.label); toast('تم الحفظ ✓'); await loadSessions(true); } catch (e) { toast(e.message || 'تعذّر الحفظ', 'warn'); }
  },
  async 'sess-end'(el) {
    const x = (ui.sessions || []).find((q) => q.id === el.dataset.id); if (!x) return;
    const msg = x.status === 'pending' ? 'إلغاء هذا المعرف؟ لن يمكن استخدامه في الكيوسك.' : `إنهاء جلسة «${x.kioskName || x.id}»؟ سيعود الكيوسك إلى شاشة التفعيل خلال دقيقة ويحتاج معرف جلسة جديداً.`;
    if (!(await confirmDlg(msg, x.status === 'pending' ? 'إلغاء المعرف' : 'إنهاء الجلسة', true))) return;
    try { await backend.endSession(x.id); toast('تم'); await loadSessions(true); } catch (e) { toast(e.message || 'تعذّر الإنهاء', 'warn'); }
  },
  async 'sess-del'(el) {
    if (!(await confirmDlg('حذف سجل هذه الجلسة نهائياً؟', 'حذف', true))) return;
    try { await backend.deleteSession(el.dataset.id); toast('تم الحذف'); await loadSessions(true); } catch (e) { toast(e.message || 'تعذّر الحذف', 'warn'); }
  },
  async 'sess-copy'(el) { try { await navigator.clipboard.writeText(el.dataset.code); toast('تم نسخ المعرف ✓'); } catch (e) { toast(el.dataset.code, 'warn'); } },
});

/* ---------- ظهور البرنامج/الكتالوج حسب الجهاز ---------- */
const _placementsHtml = placementsHtml;
placementsHtml = () => _placementsHtml() + '<div data-region="kiosksCard"></div>';
const _placementChips = placementChips;
placementChips = (p) => _placementChips(p) + (p.kiosks && p.kiosks.length ? `<span class="chip soft">${ic('monitor')}${nf(p.kiosks.length)} أجهزة</span>` : '');
const DEV_STATUS = { active: 'نشط', ended: 'جلسته منتهية', pending: 'بانتظار التفعيل' };
regions.kiosksCard = () => {
  if (!backend.devices || !ui.edit) return '';
  const o = editing(); if (!o) return '';
  const ids = o.kiosks || []; const devs = ui.devs || [];
  const some = ids.length > 0 || ui.kSome === (ui.edit.id || '__new');
  const unknown = ids.filter((id) => !devs.some((d) => d.deviceId === id));
  const what = ui.edit.type === 'prog' ? 'البرنامج' : 'الكتالوج';
  return `<section class="card"><h3>الأجهزة التي يظهر عليها</h3>
    <p class="hint">اختر هل يظهر ${what} على <b>كل الكيوسكات</b> أو على أجهزة محددة فقط. الجهاز يُعرف بالتفعيل، ويبقى اختيارك صالحاً حتى لو فتحت له جلسة جديدة بعد نقله.</p>
    <div class="seg" role="group" aria-label="أجهزة الظهور"><button type="button" data-act="kiosk-mode" data-v="all" aria-pressed="${!some}">كل الأجهزة</button><button type="button" data-act="kiosk-mode" data-v="some" aria-pressed="${some}">أجهزة محددة</button></div>
    ${some ? `${devs.length || unknown.length ? `<ul class="rows plain kl">${devs.map((d) => `<li class="row"><label class="check"><input type="checkbox" data-kiosk="${esc(d.deviceId)}" ${ids.includes(d.deviceId) ? 'checked' : ''}><span><b>${esc(d.name || d.deviceId)}</b>${d.label ? ' <small class="muted">— ' + esc(d.label) + '</small>' : ''}</span></label><small class="muted">${esc(DEV_STATUS[d.status] || '')}</small></li>`).join('')}
      ${unknown.map((id) => `<li class="row"><label class="check"><input type="checkbox" data-kiosk="${esc(id)}" checked><span><b dir="ltr">${esc(id)}</b> <small class="muted">— جهاز غير معروف</small></span></label></li>`).join('')}</ul>` : '<p class="hint">لا توجد أجهزة مفعّلة بعد. فعّل كيوسكاً من تبويب «الأجهزة» أولاً.</p>'}
      ${ids.length ? `<p class="hint">يظهر على ${nf(ids.length)} ${ids.length === 1 ? 'جهاز' : 'أجهزة'} فقط، ولا يراه غيرها (ولا الأجهزة غير المفعّلة).</p>` : '<p class="warnbox slim"><strong>اختر جهازاً واحداً على الأقل، وإلا سيظهر على كل الأجهزة.</strong></p>'}` : `<p class="hint">يظهر ${what} على كل الكيوسكات.</p>`}</section>`;
};
function rerenderKiosks() { ui.forceRegions = true; refreshRegions(); ui.forceRegions = false; }
Object.assign(actions, {
  'kiosk-mode'(el) {
    const o = editing(); if (!o) return;
    if (el.dataset.v === 'all') { if (o.kiosks && o.kiosks.length) { o.kiosks = []; if (!ui.edit.creating) markDirty(); } ui.kSome = null; }
    else ui.kSome = ui.edit.id || '__new';
    rerenderKiosks();
  },
});
document.addEventListener('change', (ev) => {
  const el = ev.target; if (!el.matches || !el.matches('[data-kiosk]')) return;
  const o = editing(); if (!o) return;
  const set = new Set(o.kiosks || []); if (el.checked) set.add(el.dataset.kiosk); else set.delete(el.dataset.kiosk);
  o.kiosks = [...set];
  if (!ui.edit.creating) markDirty();
  rerenderKiosks();
});

/* ---------- لوحة المؤشرات: التبرعات (تجريبية) لكل جهاز وبرنامج وكتالوج ---------- */
ui.dRange = '7'; ui.dDev = '';
const RANGES = [['today', 'اليوم'], ['7', '7 أيام'], ['30', '30 يوماً'], ['all', 'الكل']];
const SAR = (n) => nf(n) + ' ر.س';
const progName = (id) => { const p = findProg(id); return p ? tt(p) : id + ' (محذوف)'; };
const catName = (id) => { const c = findCat(id); return c ? tt(c) : id + ' (محذوف)'; };
function viewDashboard() {
  return `<div class="page-h"><div><h2>لوحة المؤشرات</h2><p class="muted">كم تبرعاً أُنجز، وأي البرامج والكتالوجات الأكثر، وأداء كل كيوسك.</p></div>
    <div class="dash-tools"><div class="seg" role="group" aria-label="الفترة">${RANGES.map(([k, n]) => `<button type="button" data-act="dash-range" data-v="${k}" aria-pressed="${ui.dRange === k}">${n}</button>`).join('')}</div>
      <label class="sr" for="dashDev">الجهاز</label><select id="dashDev" class="dash-dev"></select>
      <button class="btn" type="button" data-act="dash-refresh">${ic('clock')}تحديث</button>
      ${can('publish') ? `<button class="btn danger-o" type="button" data-act="stats-reset-dash">تصفير</button>` : ''}</div></div>
  <div class="demo-note" role="note"><b>بيانات تجريبية:</b> كل «التبرعات» والمبالغ هنا من محاكاة الدفع على الكيوسك، وليست تبرعات حقيقية، ولا تُخزَّن أي بيانات شخصية أو مالية.</div>
  <div class="stack" data-region="dashBody"></div>`;
}
const dscope = () => { const D = ui.dash; if (!D) return null; return ui.dDev ? (D.devices.find((d) => d.deviceId === ui.dDev) || D) : D; };
function chartHtml(days) {
  if (!days.length) return '<p class="muted">لا بيانات في هذه الفترة.</p>';
  const max = Math.max(1, ...days.map((d) => d.sessions));
  const every = days.length > 14 ? Math.ceil(days.length / 10) : 1;
  return `<div class="chart" role="img" aria-label="الجلسات والتبرعات المكتملة حسب اليوم">${days.map((d, i) => `<div class="chcol" title="${esc(d.date)} — جلسات ${d.sessions} · تبرعات ${d.completed}${d.amount ? ' · ' + d.amount + ' ر.س' : ''}"><div class="chbars"><i class="b-s" style="height:${Math.round((d.sessions / max) * 100)}%"></i><i class="b-c" style="height:${Math.round((d.completed / max) * 100)}%"></i></div><span class="chl">${i % every === 0 ? esc(d.date.slice(5)) : ''}</span></div>`).join('')}</div>
    <p class="hint"><i class="lg b-s"></i> جلسات &nbsp; <i class="lg b-c"></i> تبرعات مكتملة</p>`;
}
function rankList(items, valueFn, subFn, nameFn) {
  const max = Math.max(1, ...items.map(valueFn));
  return items.length ? `<ol class="rank">${items.map((x, i) => `<li><span class="rk">${i + 1}</span><div class="rk-t"><b>${esc(nameFn(x.id))}</b><span class="muted small">${subFn(x)}</span></div>${bar(valueFn(x), max)}<span class="num">${nf(valueFn(x))}</span></li>`).join('')}</ol>` : '<p class="muted">لا بيانات بعد.</p>';
}
regions.dashBody = () => {
  if (!ui.dash) return `<p class="muted">${ui.dashErr ? esc(ui.dashErr) : 'جارٍ التحميل…'}</p>`;
  const D = ui.dash; const sc = dscope(); const isDev = sc !== D;
  const name = isDev ? `«${sc.name}»` : 'كل الأجهزة';
  const rate = pct(sc.completed, sc.sessions), abRate = pct(sc.abandoned, sc.sessions);
  const topProg = [...sc.programs].sort((a, b) => b.completed - a.completed || b.selected - a.selected).slice(0, 8);
  const catsByVisit = [...sc.catalogs].sort((a, b) => b.visits - a.visits || b.completed - a.completed).slice(0, 6);
  const catsByDon = [...sc.catalogs].sort((a, b) => b.completed - a.completed || b.visits - a.visits).slice(0, 6);
  const devRows = D.devices.map((d) => {
    const tp = d.programs[0] && d.programs[0].completed ? progName(d.programs[0].id) : '—';
    const tc = d.catalogs[0] && d.catalogs[0].completed ? catName(d.catalogs[0].id) : '—';
    const on = d.status === 'active' && d.lastSeen && Date.now() - new Date(d.lastSeen).getTime() < 3 * 60 * 1000;
    return `<tr class="${ui.dDev === d.deviceId ? 'sel' : ''}"><td><span class="dot ${on ? 'on' : 'off'}" aria-hidden="true"></span> <button type="button" class="linkbtn" data-act="dash-dev" data-id="${esc(d.deviceId)}">${esc(d.name)}</button>${d.label ? `<div class="muted small">${esc(d.label)}</div>` : ''}</td>
      <td class="nm">${nf(d.completed)}</td><td class="nm">${SAR(d.amount)}</td><td class="nm">${nf(d.sessions)}</td><td class="nm">${pct(d.completed, d.sessions)}</td><td>${esc(tp)}</td><td>${esc(tc)}</td></tr>`;
  }).join('');
  return `<section class="card"><h3>الملخص — ${esc(name)} <span class="count">${esc((RANGES.find((r) => r[0] === ui.dRange) || [])[1] || '')}</span></h3>
    <div class="ovgrid kpis">${stat(nf(sc.completed), 'إجمالي التبرعات (تجريبي)', 'ok')}${stat(SAR(sc.amount), 'إجمالي المبالغ (تجريبي)')}${stat(nf(sc.sessions), 'جلسات المتبرعين')}${stat(rate, 'معدل الإكمال')}${stat(abRate, 'معدل الترك', sc.abandoned ? 'warn' : '')}${stat(sc.avgDurationSec ? nf(sc.avgDurationSec) + ' ث' : '—', 'متوسط مدة التبرع')}</div></section>
  <section class="card"><h3>التبرعات حسب اليوم — ${esc(name)}</h3>${chartHtml(sc.byDay)}</section>
  <div class="grid2 dash2"><section class="card"><h3>البرامج الأكثر تبرعاً — ${esc(name)}</h3>${rankList(topProg, (x) => x.completed, (x) => `اختير ${nf(x.selected)} مرة · ${SAR(x.amount)}`, progName)}</section>
  <section class="card"><h3>الكتالوجات — ${esc(name)}</h3><h4>الأكثر زيارة</h4>${rankList(catsByVisit, (x) => x.visits, (x) => `${nf(x.completed)} تبرع · ${x.visits ? pct(x.completed, x.visits) : '—'} تحويل`, catName)}<h4 class="h4gap">الأكثر تبرعاً</h4>${rankList(catsByDon, (x) => x.completed, (x) => `${SAR(x.amount)} · ${nf(x.visits)} زيارة`, catName)}</section></div>
  ${isDev ? '' : `<section class="card"><h3>حسب الجهاز <span class="count">${nf(D.devices.length)}</span></h3><p class="hint">اضغط اسم الجهاز لعرض كل المؤشرات أعلاه له وحده.</p>
    ${D.devices.length ? `<div class="trwrap"><table class="trt dev-t"><thead><tr><th>الجهاز</th><th>التبرعات</th><th>المبالغ</th><th>الجلسات</th><th>الإكمال</th><th>أكثر برنامج</th><th>أكثر كتالوج</th></tr></thead><tbody>${devRows}</tbody></table></div>` : '<p class="muted">لا توجد أجهزة مفعّلة بعد.</p>'}</section>`}`;
};
async function loadDashboard(quiet) {
  if (!feat('stats') || !can('stats')) return;
  try { ui.dash = await backend.dashboard(ui.dRange); ui.dashErr = ''; } catch (e) { if (!ui.dash) ui.dashErr = e.message || 'تعذّر تحميل المؤشرات'; }
  syncDashDev(); ui.forceRegions = !quiet; refreshRegions(); ui.forceRegions = false;
}
function syncDashDev() {
  const sel = $('#dashDev'); if (!sel || !ui.dash) return;
  if (ui.dDev && !ui.dash.devices.some((d) => d.deviceId === ui.dDev)) ui.dDev = '';
  sel.innerHTML = `<option value="">كل الأجهزة</option>${ui.dash.devices.map((d) => `<option value="${esc(d.deviceId)}" ${ui.dDev === d.deviceId ? 'selected' : ''}>${esc(d.name)}</option>`).join('')}`;
}
Object.assign(actions, {
  'dash-range'(el) { ui.dRange = el.dataset.v; $$('[data-act="dash-range"]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === ui.dRange))); loadDashboard(); },
  'dash-refresh'() { loadDashboard(); },
  'dash-dev'(el) { ui.dDev = el.dataset.id; const sel = $('#dashDev'); if (sel) sel.value = ui.dDev; ui.forceRegions = true; refreshRegions(); ui.forceRegions = false; },
  async 'stats-reset-dash'() {
    if (!(await confirmDlg('تصفير كل إحصائيات المحاكاة؟ لا يمكن التراجع.', 'تصفير', true))) return;
    try { await backend.resetStats(); toast('تم التصفير'); loadDashboard(); } catch (e) { toast(e.message || 'تعذّر التصفير', 'warn'); }
  },
});
document.addEventListener('change', (ev) => { const el = ev.target; if (el.matches && el.matches('#dashDev')) { ui.dDev = el.value; ui.forceRegions = true; refreshRegions(); ui.forceRegions = false; } });
