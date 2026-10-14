/* =====================================================================
   extras.js — منصّة الإدارة فوق app.js:
   الأدوار والصلاحيات، نظرة عامة (جودة المحتوى + الترجمات + إحصائيات المحاكاة + حالة الأجهزة)،
   مكتبة الوسائط، سجل التدقيق، والمحرر المباشر (اضغط بطاقة في المعاينة لتعديلها).
   يُحمَّل بعد app.js ويستخدم نفس الأدوات العامة (ui, state, regions, actions, backend…).
   ===================================================================== */
'use strict';

const ALL_PERMS = ['read', 'edit', 'upload', 'publish', 'settings', 'media_delete', 'audit', 'stats'];
const ROLE_LABEL = { super: 'مدير النظام', manager: 'مدير المحتوى', editor: 'محرّر', viewer: 'مشاهد' };
ui.role = 'super'; ui.can = new Set(ALL_PERMS);
const can = (p) => ui.can.has(p);
const feat = (f) => !!(backend.features && backend.features[f]);

ICONS.chart = 'M3 3v18h18M7 15l4-4 3 3 5-6';
ICONS.shield = 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z';
ICONS.monitor = 'M3 4h18v12H3zM8 20h8M12 16v4';

TABS.unshift({ k: 'overview', label: 'نظرة عامة', icon: 'chart' });
TABS.splice(TABS.findIndex((t) => t.k === 'settings'), 0, { k: 'media', label: 'الوسائط', icon: 'image' });
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
  if (backend.me) { try { const m = await backend.me(); ui.role = m.role; ui.can = new Set(m.can || []); } catch (e) { /* يبقى الافتراضي */ } }
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
  if (!feat('stats')) return `<section class="card"><h3>إحصائيات المحاكاة</h3><p class="muted">الإحصائيات تتطلب ربط الكيوسك بالخادم (غير متاحة في النسخة التجريبية).</p></section>`;
  if (!can('stats')) return '';
  const S = ui.stats;
  if (!S) return `<section class="card"><h3>إحصائيات المحاكاة</h3><p class="muted">${ui.statsErr ? esc(ui.statsErr) : 'جارٍ التحميل…'}</p></section>`;
  const progs = Object.entries(S.programs).map(([id, v]) => ({ id, ...v })).sort((a, b) => b.selected - a.selected).slice(0, 6);
  const maxSel = progs[0] ? progs[0].selected : 0;
  const amts = Object.entries(S.amounts).map(([a, n]) => ({ a: Number(a), n })).sort((x, y) => y.n - x.n).slice(0, 6);
  const days = Object.keys(S.daily).sort().slice(-7);
  const avg = S.completed ? Math.round(S.durationSum / S.completed / 1000) : 0;
  const nameFor = (id) => { const p = findProg(id); return p ? tt(p) : id; };
  return `<section class="card"><div class="card-h"><h3>إحصائيات المحاكاة <span class="badge off">بيانات تجريبية</span></h3>
    ${can('publish') ? `<button class="btn small danger-o" type="button" data-act="stats-reset">تصفير</button>` : ''}</div>
    <p class="hint">كل الأرقام من جلسات محاكاة فقط — ليست تبرعات حقيقية، ولا تُخزَّن أي بيانات شخصية أو مالية. منذ ${esc(fmtDate(S.since))}.</p>
    <div class="ovgrid">${stat(nf(S.sessions), 'جلسات بدأت')}${stat(nf(S.completed), 'محاكاة مكتملة')}${stat(pct(S.completed, S.sessions), 'معدل الإكمال', 'ok')}
      ${stat(pct(S.abandoned, S.sessions), 'معدل الترك', S.abandoned ? 'warn' : '')}${stat(pct(S.completed, S.started), 'من بدأ الدفع أكمله')}${stat(avg ? nf(avg) + ' ث' : '—', 'متوسط مدة الجلسة')}</div>
    <div class="grid2 st2"><div><h4>الأكثر اختياراً</h4>${progs.length ? `<ul class="rows plain">${progs.map((p) => `<li class="row"><div class="row-t">${esc(nameFor(p.id))}</div>${bar(p.selected, maxSel)}<span class="num">${nf(p.selected)} / ${nf(p.completed)}</span></li>`).join('')}</ul><p class="hint">اختير / أُكمل</p>` : '<p class="muted">لا بيانات بعد.</p>'}</div>
    <div><h4>المبالغ التجريبية الأكثر اختياراً</h4>${amts.length ? `<ul class="rows plain">${amts.map((x) => `<li class="row"><div class="row-t">${nf(x.a)} ر.س</div><span class="num">${nf(x.n)} مرة</span></li>`).join('')}</ul>` : '<p class="muted">لا بيانات بعد.</p>'}</div></div>
    ${days.length ? `<h4>آخر الأيام</h4><div class="trwrap"><table class="trt"><thead><tr><th>اليوم</th><th>جلسات</th><th>مكتملة</th></tr></thead><tbody>${days.map((d) => `<tr><td>${esc(d)}</td><td>${nf(S.daily[d].sessions)}</td><td>${nf(S.daily[d].completed)}</td></tr>`).join('')}</tbody></table></div>` : ''}</section>`;
};
regions.ovDevices = () => {
  if (!feat('stats') || !can('stats') || !ui.stats) return '';
  const devs = Object.entries(ui.stats.devices || {}).map(([id, d]) => ({ id, ...d })).sort((a, b) => b.lastSeen.localeCompare(a.lastSeen));
  return `<section class="card"><h3>أجهزة الكيوسك <span class="count">${nf(devs.length)}</span></h3>
    ${devs.length ? `<ul class="rows plain">${devs.map((d) => { const on = Date.now() - new Date(d.lastSeen).getTime() < 3 * 60 * 1000;
      return `<li class="row"><span class="dot ${on ? 'on' : 'off'}" aria-hidden="true"></span><div class="row-t"><strong dir="ltr">${esc(d.id)}</strong><div class="muted small">آخر اتصال ${esc(ago(d.lastSeen))} · إصدار التطبيق ${esc(d.version || '—')}</div></div><span class="badge ${on ? 'kind' : 'off'}">${on ? 'متصل' : 'غير متصل'}</span></li>`; }).join('')}</ul>` : '<p class="muted">لم يتصل أي كيوسك بعد. يظهر الجهاز هنا بعد أول تحديث للكتالوج.</p>'}</section>`;
};
async function loadOverviewData() {
  try { ui.live = normClient(await backend.fetchLive()); } catch (e) { /* يبقى */ }
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
const AUDIT_LABEL = { login: 'دخول', login_failed: 'دخول فاشل', draft_save: 'تعديل مسودة', publish: 'نشر', restore: 'استرجاع', upload: 'رفع صورة', media_delete: 'حذف صورة', stats_reset: 'تصفير الإحصائيات' };
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
function onTab(k) { if (k === 'overview') loadOverviewData(); if (k === 'media') loadMedia(); }
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
