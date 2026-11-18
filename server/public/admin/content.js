/* =====================================================================
   content.js — تحرير المحتوى: الصفحة الرئيسية (معاينة مسودة/منشور، تجاهل التعديلات)،
   شارات حالة العناصر، فلاتر البرامج والكتالوجات، الأرشفة، والحذف الآمن.
   يُحمَّل بعد dashboard.js.
   ===================================================================== */
'use strict';
const KIOSK_W = 1080, KIOSK_H = 1920;
ui.pvDev = 'kiosk'; ui.pvSrc = 'draft';

/* ---------- حالة العنصر: شارات في قوائم البطاقات ---------- */
function itemBadges(info) {
  const o = info.obj; const out = [];
  if (o.archived) out.push(badge('مؤرشف', 'off'));
  if (!o.image) out.push(badge('بلا صورة', 'off'));
  else if (/^\/uploads\//.test(o.image) && ui.ops && (ui.ops.missingMedia || []).some((m) => m.url === o.image)) out.push(badge('ملف الصورة مفقود', 'off'));
  const miss = LANGS.filter((l) => !String((o.title || {})[l.k] || '').trim());
  if (miss.length) out.push(badge('ترجمة ناقصة', 'off'));
  if ((o.kiosks || []).length) out.push(badge(`${nf(o.kiosks.length)} أجهزة`, 'kind'));
  return out.join('');
}

/* ---------- معاينة الصفحة الرئيسية: مسودة أو منشور ---------- */
const _homePreview = homePreview;
homePreview = function homePreviewSrc() {
  const live = ui.pvSrc === 'live' && ui.live;
  let html;
  if (live) { const saved = state.catalog; state.catalog = ui.live; try { html = _homePreview(); } finally { state.catalog = saved; } } else html = _homePreview();
  const un = state.dirty || state.hasUnpublished;
  const note = ui.pvSrc === 'live' ? (ui.live ? '<span class="badge off">النسخة المنشورة — للقراءة فقط</span>' : '<span class="muted small">جارٍ تحميل المنشور…</span>') : (un ? '<span class="badge kind">مسودة — لم تُنشر</span>' : '<span class="badge kind">المسودة = المنشور</span>');
  const ctl = `<div class="pv-src"><div class="seg" role="group" aria-label="مصدر المعاينة"><button type="button" data-act="pv-src" data-v="draft" aria-pressed="${ui.pvSrc !== 'live'}">المسودة</button><button type="button" data-act="pv-src" data-v="live" aria-pressed="${ui.pvSrc === 'live'}">المنشور</button></div>${note}<span class="muted small">مقاس الكيوسك ${KIOSK_W}×${KIOSK_H}</span></div>`;
  return html.replace('<div class="pv-box">', '<div class="pv-box">' + ctl);
};
const _viewHome = viewHome;
VIEWS.home = () => _viewHome().replace('</p></div></div>', '</p></div><div data-region="homeActions"></div></div>');
regions.homeActions = () => (state.dirty || state.hasUnpublished) ? `<button class="btn" type="button" data-act="discard-draft">${ic('x')}تجاهل التعديلات غير المنشورة</button>` : '';

async function doDiscard() {
  if (!(await confirmDlg('سيُحذف كل ما عدّلته ولم تنشره، ويعود المحتوى كما هو منشور الآن في الكيوسكات. لا يمكن التراجع عن ذلك. متابعة؟', 'تجاهل التعديلات', true))) return;
  clearTimeout(saveTimer); saveTimer = null;
  if (state.saving && state.savePromise) { try { await state.savePromise; } catch (e) { /* */ } }
  try {
    const r = await backend.discard();
    state.catalog = normClient(r.catalog); state.dirty = false; state.hasUnpublished = false; state.failed = false; state.warnings = [];
    if (ui.edit) await closeEditor(true);
    hideErrors(); setSave('saved'); render(); toast('عاد المحتوى للنسخة المنشورة ✓');
  } catch (e) { toast(e.message || 'تعذّر التراجع عن التعديلات', 'warn'); }
}

/* ---------- فلاتر البرامج والكتالوجات ---------- */
ui.pfStatus = 'visible'; ui.pfKind = ''; ui.cfStatus = 'visible';
const STATUS_FILTERS = [['visible', 'الكل'], ['active', 'مفعّل'], ['inactive', 'موقوف'], ['archived', 'مؤرشف']];
const statusOk = (o, f) => (f === 'archived' ? !!o.archived : f === 'active' ? o.active && !o.archived : f === 'inactive' ? !o.active && !o.archived : !o.archived);
function progFilterOk(p) { return statusOk(p, ui.pfStatus) && (!ui.pfKind || p.kind === ui.pfKind); }
function catFilterOk(c) { return statusOk(c, ui.cfStatus); }
const countBy = (list, f) => list.filter((o) => statusOk(o, f)).length;
const filterSeg = (list, cur, act) => `<div class="seg" role="group" aria-label="حالة العنصر">${STATUS_FILTERS.map(([k, n]) => `<button type="button" data-act="${act}" data-v="${k}" aria-pressed="${cur === k}">${n} <span class="muted">${nf(countBy(list, k))}</span></button>`).join('')}</div>`;
const _viewPrograms = viewPrograms;
VIEWS.programs = () => _viewPrograms().replace('<div data-region="progList"></div>', '<div data-region="progFilters"></div><div data-region="progList"></div>');
regions.progFilters = () => `<div class="filters card">${filterSeg(C().programs, ui.pfStatus, 'pf-status')}<label class="sr" for="pfKind">نوع التبرع</label><select id="pfKind" class="dash-sel" data-pf-kind><option value="">كل الأنواع</option>${Object.entries(KIND_LABEL).map(([k, n]) => `<option value="${k}" ${ui.pfKind === k ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></div>`;
const _viewCatalogs = viewCatalogs;
VIEWS.catalogs = () => _viewCatalogs().replace('<div data-region="catList"></div>', '<div data-region="catFilters"></div><div data-region="catList"></div>');
regions.catFilters = () => `<div class="filters card">${filterSeg(C().catalogs, ui.cfStatus, 'cf-status')}</div>`;

/* عدد الكتالوجات المرتبطة بالبرنامج على بطاقته */
const _placementChips2 = placementChips;
placementChips = (p) => {
  const n = C().catalogs.filter((c) => c.items.some((i) => i.programId === p.id)).length;
  return (p.archived ? `<span class="chip warn">${ic('folder')}مؤرشف — لا يظهر للمتبرعين</span>` : '') + _placementChips2(p) + (n ? `<span class="chip soft">${ic('folder')}مرتبط بـ ${nf(n)} ${n === 1 ? 'كتالوج' : 'كتالوجات'}</span>` : '');
};

/* ---------- الأرشفة والحذف الآمن ---------- */
function itemUsage(type, id) {
  const c = C(); const out = [];
  if (c.home.some((h) => h.type === type && h.id === id)) out.push('الصفحة الرئيسية');
  if (c.featured.items.some((x) => x.type === type && x.id === id)) out.push('شريط «الأكثر رواجاً»');
  if (type === 'program') c.catalogs.filter((k) => k.items.some((i) => i.programId === id)).forEach((k) => out.push(`كتالوج «${tt(k)}»`));
  return out;
}
function archiveCard() {
  const o = editing(); if (!o || ui.edit.creating) return '';
  const what = ui.edit.type === 'prog' ? 'البرنامج' : 'الكتالوج';
  return `<section class="card"><h3>الأرشفة</h3>${o.archived
    ? `<p class="hint">${what} مؤرشف: لا يظهر للمتبرعين ولا في القوائم الافتراضية، وتبقى بياناته محفوظة.</p><button class="btn" type="button" data-act="arch-toggle">استعادة من الأرشيف</button>`
    : `<p class="hint">الأرشفة تُخفي ${what} من الكيوسك والقوائم <b>دون حذفه</b>، ويمكن استعادته لاحقاً. وهي البديل الآمن للحذف إذا كان مستخدماً.</p><button class="btn" type="button" data-act="arch-toggle">أرشفة ${what}</button>`}</section>`;
}
const _programEditorHtml = programEditorHtml, _catalogEditorHtml = catalogEditorHtml;
programEditorHtml = () => _programEditorHtml().replace(/<\/div>\s*$/, archiveCard() + '</div>');
catalogEditorHtml = () => _catalogEditorHtml().replace(/<\/div>\s*$/, archiveCard() + '</div>');
async function archiveCurrent(msg) {
  const o = editing(); if (!o) return;
  o.archived = !o.archived; if (o.archived) o.active = false;
  markDirty(); renderDrawer(false); refreshRegions();
  toast(o.archived ? (msg || 'تمت الأرشفة ✓ — لن يظهر للمتبرعين بعد النشر') : 'تمت الاستعادة من الأرشيف ✓ (فعّل العنصر ليظهر)');
}
const _delBase = actions.del;
actions.del = async function guardedDelete() {
  const e = ui.edit; if (!e || e.creating) return _delBase();
  const o = editing(); const type = e.type === 'prog' ? 'program' : 'catalog';
  const used = itemUsage(type, e.id);
  if (!used.length) return _delBase();
  const ok = await confirmDlg(`لا يمكن حذف «${tt(o)}» لأنه مستخدم في: ${used.join('، ')}.\nيمكنك أرشفته بدلاً من ذلك (يختفي من الكيوسك دون فقدان بياناته). هل تريد أرشفته؟`, 'أرشفة بدلاً من الحذف', false);
  if (ok) { await archiveCurrent(); await closeEditor(true); }
};

Object.assign(actions, {
  'pv-src'(el) {
    ui.pvSrc = el.dataset.v;
    const go = () => { ui.forceRegions = true; refreshRegions(); ui.forceRegions = false; };
    if (ui.pvSrc === 'live' && !ui.live) backend.fetchLive().then((l) => { ui.live = normClient(l); go(); }).catch(() => toast('تعذّر تحميل النسخة المنشورة', 'warn')); else go();
  },
  'discard-draft'() { doDiscard(); },
  'arch-toggle'() { archiveCurrent(); },
  'pf-status'(el) { ui.pfStatus = el.dataset.v; ui.forceRegions = true; refreshRegions(); ui.forceRegions = false; },
  'cf-status'(el) { ui.cfStatus = el.dataset.v; ui.forceRegions = true; refreshRegions(); ui.forceRegions = false; },
});
document.addEventListener('change', (ev) => { const el = ev.target; if (el.matches && el.matches('[data-pf-kind]')) { ui.pfKind = el.value; ui.forceRegions = true; refreshRegions(); ui.forceRegions = false; } });
