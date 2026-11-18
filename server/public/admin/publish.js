/* =====================================================================
   النشر والنسخ (v2): فحص ما قبل النشر، رقم الإصدار، حال الأجهزة،
   سجل الإصدارات مع المقارنة والاسترجاع (إلى المسودة فقط).
   يُحمَّل بعد app.js ويستبدل viewPublish/regions/doPublish.
   ===================================================================== */
ui.pf = null; ui.pfErr = ''; ui.rels = null; ui.cmp = null; ui.cmpBusy = '';

viewPublish = function () {
  return `<div class="page-h"><div><h2>النشر والنسخ</h2><p class="muted">ما تعدّله يُحفظ كمسودة، ولا يراه المتبرعون إلا بعد «نشر التغييرات». كل نشر يحمل رقم إصدار ويُحفظ له نسخة للرجوع.</p></div></div>
  <div class="stack"><div data-region="pubStatus"></div><div data-region="pubChecks"></div><div data-region="diff"></div><div data-region="pubDevices"></div><div data-region="history"></div><div data-region="audit"></div></div>`;
};

const PF_ICON = { ok: 'check', warn: 'alert', error: 'x' };
const PF_LABEL = { ok: 'سليم', warn: 'تنبيه', error: 'يمنع النشر' };

regions.pubStatus = () => {
  const un = state.dirty || state.hasUnpublished; const pf = ui.pf;
  const cur = pf ? pf.currentRelease : (ui.ops ? ui.ops.liveRelease : 0);
  const blocked = pf && !pf.ok;
  const nxt = pf && un && pf.hasChanges ? `<span class="chipx">الإصدار التالي: ${pf.nextRelease}</span>` : '';
  return `<section class="card pub ${un ? 'has' : 'none'}"><div class="pub-s">${ic(un ? 'alert' : 'check')}<div><strong>${un ? 'توجد تغييرات لم تُنشر بعد' : 'كل شيء منشور'}</strong>
    <p class="muted">${un ? 'المتبرعون ما زالوا يرون النسخة المنشورة السابقة.' : 'المسودة مطابقة للنسخة المنشورة حالياً في الكيوسك.'}${cur ? ` الإصدار المنشور الحالي: <b>${cur}</b>.` : ''} ${nxt}</p></div></div>
    ${blocked ? `<div class="alert error" role="alert">${ic('x')}<div><strong>لا يمكن النشر الآن</strong><p>صحّح البنود الحمراء في «فحص ما قبل النشر» أدناه.</p></div></div>` : ''}
    <div class="btnrow"><button class="btn primary big" type="button" data-act="publish" ${ui.pubBusy || blocked ? 'disabled' : ''}>${ic('cloud')}${ui.pubBusy ? 'جارٍ النشر…' : 'نشر التغييرات'}</button>
    ${un ? `<button class="btn" type="button" data-act="discard-draft" ${ui.pubBusy ? 'disabled' : ''}>${ic('x')}تجاهل التعديلات غير المنشورة</button>` : ''}</div>
    ${state.warnings.length ? `<div class="warnbox slim"><div class="wb-h">${ic('alert')}<strong>تنبيهات (لا تمنع النشر)</strong></div><ul>${state.warnings.map((w) => `<li>${esc(w)}</li>`).join('')}</ul></div>` : ''}</section>`;
};

regions.pubChecks = () => {
  if (!backend.preflight) return '';
  if (!ui.pf) return `<section class="card"><h3>فحص ما قبل النشر</h3>${ui.pfErr ? `<div class="state error">${esc(ui.pfErr)}</div>` : '<div class="state"><span class="skeleton" style="width:60%;height:14px"></span></div>'}</section>`;
  const cs = ui.pf.checks; const bad = cs.filter((c) => c.status !== 'ok');
  const row = (c) => `<li class="pfc ${c.status}"><div class="pfc-h">${ic(PF_ICON[c.status])}<strong>${esc(c.title)}</strong><span class="tagx ${c.status}">${PF_LABEL[c.status]}</span></div>
    ${c.detail && c.status !== 'ok' ? `<p class="muted">${esc(c.detail)}</p>` : ''}
    ${c.items.length && c.status !== 'ok' ? `<ul class="pfi">${c.items.slice(0, 12).map((i, k) => i.id ? `<li><button class="linkbtn" type="button" data-act="pf-go" data-c="${esc(c.id)}" data-i="${k}">${esc(i.label)}</button></li>` : `<li>${esc(i.label)}</li>`).join('')}${c.items.length > 12 ? `<li class="muted">و${c.items.length - 12} أخرى…</li>` : ''}</ul>` : ''}</li>`;
  return `<section class="card"><h3>فحص ما قبل النشر <span class="count">${bad.length ? bad.length + ' ملاحظة' : 'سليم'}</span></h3>
    <p class="hint">يُجرى على المسودة المحفوظة. البنود الحمراء تمنع النشر، والصفراء تنبيهات لا تمنعه.</p>
    <ul class="pfl">${[...cs].sort((a, b) => (a.status === 'ok') - (b.status === 'ok')).map(row).join('')}</ul></section>`;
};

regions.pubDevices = () => {
  const o = ui.ops; if (!o || !o.devices) return '';
  const act = o.devices.filter((d) => d.status === 'active'); const rel = o.liveRelease;
  if (!act.length) return `<section class="card"><h3>وصول الإصدار إلى الأجهزة</h3><p class="muted">لا توجد أجهزة مفعّلة بعد.</p></section>`;
  const st = (d) => !rel ? 'بلا ترقيم' : d.contentRelease === rel ? 'محدّث' : d.online ? 'لم يستلم بعد' : 'غير متصل';
  return `<section class="card"><h3>وصول الإصدار ${rel || ''} إلى الأجهزة <span class="count">${o.summary.upToDate} من ${o.summary.total}</span></h3>
    <p class="hint">الكيوسك يجلب المحتوى الجديد تلقائياً خلال دقائق من النشر؛ الجهاز غير المتصل يستلمه عند عودته.</p>
    <ul class="rows plain">${act.map((d) => `<li class="row"><div class="row-t"><strong>${esc(d.name || d.label || d.deviceId)}</strong><span class="muted">الإصدار لديه: ${d.contentRelease || '—'}</span></div><span class="tagx ${st(d) === 'محدّث' ? 'ok' : 'warn'}">${st(d)}</span></li>`).join('')}</ul></section>`;
};

regions.history = () => {
  const relLog = ui.rels ? ui.rels.releases : [];
  const list = ui.hist;
  const item = (h) => {
    const by = h.replacedBy; const open = ui.cmp && ui.cmp.id === h.id;
    return `<li class="hist2"><div class="row hist"><span class="hic">${ic('clock')}</span><div class="row-t"><strong>${h.release ? 'الإصدار ' + h.release : 'نسخة قديمة'} <span class="muted">· ${esc(fmtDate(h.at))}</span></strong>
      <span class="muted">${by ? `استُبدلت بالإصدار ${by.version} (${by.changesCount} تغيير)` : 'نسخة احتياطية قبل النشر'}</span></div>
      <button class="btn small" type="button" data-act="hist-cmp" data-id="${esc(h.id)}" ${ui.cmpBusy ? 'disabled' : ''}>${open ? 'إخفاء المقارنة' : 'مقارنة بالمسودة'}</button>
      <button class="btn small" type="button" data-act="restore" data-id="${esc(h.id)}" data-rel="${h.release || ''}" ${ui.restoreBusy ? 'disabled' : ''}>استرجاع</button></div>
      ${open ? `<div class="cmpbox">${ui.cmp.groups ? (ui.cmp.n ? ui.cmp.groups.filter((g) => g.items.length).map((g) => `<div class="dg"><h4>${esc(g.title)}</h4><ul>${g.items.map((i) => `<li class="${i.k}">${esc(i.t)}</li>`).join('')}</ul></div>`).join('') : '<p class="muted">لا فروق بين هذه النسخة والمسودة الحالية.</p>') : '<p class="muted">جارٍ المقارنة…</p>'}<p class="hint">«+» ما سيُضاف و«−» ما سيُحذف لو تحوّلت المسودة إلى هذه النسخة.</p></div>` : ''}</li>`;
  };
  return `<section class="card"><h3>النسخ السابقة</h3>
  ${list == null ? '<div class="state"><span class="skeleton" style="width:50%;height:14px"></span></div>' : list.length ? `<ul class="rows plain">${list.map(item).join('')}</ul>` : '<p class="muted">لا توجد نسخ سابقة بعد — تُحفظ نسخة تلقائياً عند كل نشر.</p>'}
  <p class="hint">الاسترجاع يحمّل النسخة القديمة إلى المسودة فقط، ولا ينشرها حتى تراجعها وتضغط «نشر».</p>
  ${relLog.length ? `<details class="relog"><summary>سجل الإصدارات المنشورة (${relLog.length})</summary><table class="tbl"><thead><tr><th>الإصدار</th><th>التاريخ</th><th>الدور</th><th>التغييرات</th></tr></thead><tbody>${relLog.map((r) => `<tr><td>${r.version}</td><td>${esc(fmtDate(r.at))}</td><td>${esc(r.role || '')}</td><td>${r.changesCount ? esc((r.changes || []).slice(0, 3).join('، ')) + (r.changesCount > 3 ? ` … (+${r.changesCount - 3})` : '') : 'بلا تغييرات في المحتوى'}</td></tr>`).join('')}</tbody></table></details>` : ''}
  <div class="btnrow"><button class="btn" type="button" data-act="export">${ic('download')}تصدير المسودة (JSON)</button>
  <button class="btn" type="button" data-act="import">${ic('upload')}استيراد ملف JSON</button><input type="file" id="importFile" accept="application/json,.json" hidden></div></section>`;
};

loadPublishData = async function () {
  ui.hist = null; ui.histErr = ''; ui.cmp = null;
  try { ui.live = normClient(await backend.fetchLive()); } catch (e) { ui.live = null; ui.histErr = 'تعذّر قراءة النسخة المنشورة للمقارنة'; }
  refreshRegions();
  const jobs = [];
  if (backend.preflight) jobs.push(backend.preflight().then((d) => { ui.pf = d; ui.pfErr = ''; }).catch((e) => { ui.pf = null; ui.pfErr = e.message || 'تعذّر الفحص'; }));
  if (backend.releases) jobs.push(backend.releases().then((d) => { ui.rels = d; }).catch(() => {}));
  if (typeof loadOps === 'function') jobs.push(loadOps(true).catch(() => {}));
  jobs.push(backend.history().then((h) => { ui.hist = h; }).catch(() => { ui.hist = []; }));
  await Promise.all(jobs);
  ui.forceRegions = true; refreshRegions(); ui.forceRegions = false;
  if (typeof loadAudit === 'function') loadAudit();
};

doPublish = async function () {
  if (ui.pubBusy) return;
  const errs = validateCatalog(C());
  if (errs.length) { showErrors(errs.map((e) => e.msg), 'لا يمكن النشر قبل تصحيح الأخطاء التالية'); return; }
  let msg = 'سيظهر هذا المحتوى لجميع المتبرعين في الكيوسك. هل تريد النشر الآن؟';
  if (backend.preflight) {
    try {
      await settleSaves();
      const pf = ui.pf = await backend.preflight();
      if (!pf.ok) { refreshRegions(); showErrors(pf.checks.filter((c) => c.status === 'error').flatMap((c) => c.items.length ? c.items.map((i) => `${c.title}: ${i.label}`) : [c.title]).concat(pf.errors || []), 'لا يمكن النشر — فحص ما قبل النشر'); return; }
      const warns = pf.checks.filter((c) => c.status === 'warn').length;
      msg = `سيُنشر الإصدار ${pf.nextRelease} ويظهر لجميع المتبرعين (${pf.changes.length} تغيير).` +
        ` الأجهزة المتصلة الآن: ${pf.devicesOnline} من ${pf.devicesTotal}، وتستلم المحتوى تلقائياً.` +
        (warns ? ` تنبيه: يوجد ${warns} بند تنبيه في الفحص لا يمنع النشر.` : '') + ' هل تريد النشر الآن؟';
    } catch (e) { /* نكمل بالتأكيد العادي؛ الخادم سيفحص من جديد */ }
  }
  if (!(await confirmDlg(msg, 'نشر الآن'))) return;
  ui.pubBusy = true; refreshRegions();
  try {
    if (!(await settleSaves())) throw Object.assign(new Error('تعذّر حفظ المسودة قبل النشر'), { shown: true });
    const r = await backend.publish();
    state.hasUnpublished = false; state.dirty = false; state.warnings = r.warnings || state.warnings;
    toast(r.unchanged ? 'لا تغييرات جديدة — المنشور كما هو' : (backend.kind === 'demo' ? 'تم النشر ✓ (نسخة تجريبية — لا تصل لأي كيوسك)' : `تم نشر الإصدار ${r.release || ''} ✓ — التغييرات ظاهرة الآن في الكيوسك`)); hideErrors();
    ui.pubBusy = false; updateChrome(); await loadPublishData();
  } catch (e) {
    if (e.status === 401) showLogin('انتهت الجلسة، أعد تسجيل الدخول.');
    else if (e.errors) showErrors(e.errors, 'رفض الخادم النشر');
    else if (!e.shown) showErrors([e.message || 'تعذّر النشر'], 'تعذّر النشر');
  } finally { ui.pubBusy = false; ui.forceRegions = true; refreshRegions(); ui.forceRegions = false; updateChrome(); }
};

doRestore = async function (id, rel) {
  const label = rel ? `الإصدار ${rel}` : 'هذه النسخة';
  if (!(await confirmDlg(`سيتم استبدال المسودة الحالية بـ${label}. لن تظهر للمتبرعين إلا بعد مراجعتها وضغط «نشر». التعديلات غير المنشورة في المسودة ستُفقد. متابعة؟`, 'استرجاع إلى المسودة', true))) return;
  ui.restoreBusy = true; refreshRegions();
  try {
    await settleSaves();
    const r = await backend.restore(id); state.catalog = normClient(r.catalog); state.dirty = false;
    const l = await backend.load(); state.catalog = normClient(l.catalog); state.hasUnpublished = l.hasUnpublished;
    hideErrors(); setSave('saved'); toast(`تم تحميل ${label} إلى المسودة ✓ — راجعها ثم انشر`);
  } catch (e) { showErrors([e.message || 'تعذّر الاسترجاع'], 'تعذّر الاسترجاع'); }
  ui.restoreBusy = false; ui.forceRegions = true; refreshRegions(); ui.forceRegions = false;
  if (backend.preflight) { try { ui.pf = await backend.preflight(); refreshRegions(); } catch (e) { /* */ } }
};

Object.assign(actions, {
  restore(el) { doRestore(el.dataset.id, el.dataset.rel); },
  async 'hist-cmp'(el) {
    const id = el.dataset.id;
    if (ui.cmp && ui.cmp.id === id) { ui.cmp = null; ui.forceRegions = true; refreshRegions(); ui.forceRegions = false; return; }
    ui.cmp = { id, groups: null, n: 0 }; ui.forceRegions = true; refreshRegions();
    try {
      const snap = normClient(await backend.historyItem(id));
      const groups = diffCatalogs(C(), snap);      // من المسودة الحالية إلى النسخة القديمة
      if (ui.cmp && ui.cmp.id === id) ui.cmp = { id, groups, n: groups.reduce((a, g) => a + g.items.length, 0) };
    } catch (e) { ui.cmp = null; toast('تعذّرت المقارنة', 'warn'); }
    refreshRegions(); ui.forceRegions = false;
  },
  'pf-go'(el) {
    const c = ui.pf && ui.pf.checks.find((x) => x.id === el.dataset.c); const it = c && c.items[+el.dataset.i];
    if (it && it.id) goTarget({ type: it.type, id: it.id });
  },
});
