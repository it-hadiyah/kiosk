/* =====================================================================
   devices.js — مركز إدارة أجهزة الكيوسك.
   بطاقة لكل جهاز (الاسم، الموقع، الاتصال، آخر اتصال، إصدار التطبيق والمحتوى، المزامنة، المعرّف، التنبيهات)،
   نافذة تفاصيل (معلومات، اتصال، محتوى مخصص، سجل المزامنة والتحديثات، سجل الجلسات)،
   وإدارة الجلسات (فتح/ربط/إنهاء) بتأكيدات واضحة. يُحمَّل بعد media.js.
   ما لا يتوفر من الخادم/التطبيق يُعرض «غير متاح» مع السبب.
   ===================================================================== */
'use strict';
ui.devOpen = ui.devOpen || '';

function viewDevices() {
  return `<div class="page-h"><div><h2>الأجهزة</h2><p class="muted">مراقبة الكيوسكات وإدارة جلساتها. كل كيوسك يُفعَّل بمعرف جلسة تنشئه من هنا، ويُسمّى عند التفعيل. عند نقله إلى مكان آخر أنهِ جلسته وافتح له جلسة جديدة.</p></div>
    <div class="dash-tools">${can('devices') ? `<button class="btn primary" type="button" data-act="sess-new">${ic('plus')}فتح جلسة جديدة</button>` : ''}<button class="btn" type="button" data-act="dev-refresh">${ic('clock')}تحديث</button></div></div>
  <div class="stack"><div data-region="devSummary"></div><div data-region="devList"></div><div data-region="devPending"></div><div data-region="devEnded"></div></div>`;
}
const devState = (d) => (d.status !== 'active' ? { txt: 'جلسته منتهية', cls: 'off' } : d.online ? { txt: 'متصل', cls: 'on' } : { txt: 'غير متصل', cls: 'bad' });
const syncTxt = (d, rel) => {
  if (d.status !== 'active') return '—';
  if (!d.contentSyncedAt) return '<span class="muted small">لم يجلب المحتوى بعد</span>';
  if (!rel) return 'استلم المحتوى';
  if (d.contentRelease === rel) return `<span class="ok-line small">${ic('check')}حديث — الإصدار ${rel}</span>`;
  return `<span class="warn-line small">متأخر — لديه ${d.contentRelease || 'القديم'} والمنشور ${rel}</span>`;
};

regions.devSummary = () => {
  if (!feat('ops')) return '';
  if (!ui.ops) return ui.opsErr ? `<div class="state error">${ic('alert')}<strong>تعذّر تحميل حالة الأجهزة</strong><span class="small">${esc(ui.opsErr)}</span></div>` : '<div class="skeleton" style="height:78px"></div>';
  const S = ui.ops.summary;
  return `<div class="ovgrid">${stat(nf(S.total), 'أجهزة مفعّلة')}${stat(nf(S.online), 'متصلة', S.online === S.total && S.total ? 'ok' : '')}${stat(nf(S.offline), 'غير متصلة', S.offline ? 'bad' : '')}${stat(ui.ops.liveRelease ? `${nf(S.upToDate)}/${nf(S.total)}` : '—', ui.ops.liveRelease ? `على الإصدار ${ui.ops.liveRelease}` : 'مزامنة المحتوى', ui.ops.liveRelease && S.upToDate === S.total ? 'ok' : (ui.ops.liveRelease ? 'warn' : ''))}</div>`;
};

function deviceCard(d, rel) {
  const st = devState(d);
  return `<article class="dcard ${d.alerts.some((a) => a.severity === 'error') ? 'err' : ''}"><div class="sc-h"><span class="dot ${st.cls}" aria-hidden="true"></span><strong class="sc-name">${esc(d.name || d.deviceId)}</strong><span class="badge ${st.cls === 'on' ? 'kind' : 'off'}">${st.txt}</span></div>
    <dl class="meta compact"><dt>الموقع</dt><dd>${d.label ? esc(d.label) : '<span class="muted">غير محدد</span>'}</dd><dt>آخر اتصال</dt><dd>${esc(ago(d.lastSeen))}</dd><dt>إصدار التطبيق</dt><dd dir="ltr">${esc(d.version || '—')}</dd>
      <dt>المحتوى</dt><dd>${syncTxt(d, rel)}</dd><dt>المعرّف</dt><dd dir="ltr" class="urlcell">${esc(d.deviceId)}</dd></dl>
    ${d.alerts.length ? `<div class="dalerts">${d.alerts.map((a) => `<span class="sev-chip ${a.severity}">${esc(a.title)}</span>`).join('')}</div>` : ''}
    <div class="btnrow tight"><button class="btn small" type="button" data-act="dev-open" data-id="${esc(d.deviceId)}">التفاصيل</button>${can('devices') && d.status === 'active' ? `<button class="btn small" type="button" data-act="sess-rename" data-id="${esc(d.sessionId)}">${ic('edit')}تعديل</button><button class="btn small danger-o" type="button" data-act="sess-end" data-id="${esc(d.sessionId)}">إنهاء الجلسة</button>` : ''}</div></article>`;
}
regions.devList = () => {
  if (!feat('ops')) return `<section class="card"><p class="muted">حالة الأجهزة التفصيلية تتطلب الاتصال بالخادم (غير متاحة في النسخة التجريبية).</p></section>`;
  if (!ui.ops) return '';
  const rel = ui.ops.liveRelease; const act = ui.ops.devices.filter((d) => d.status === 'active');
  if (!act.length) return `<div class="state">${ic('monitor')}<strong>لا توجد أجهزة مفعّلة</strong><span class="small">اضغط «فتح جلسة جديدة» ثم أدخل المعرف على الكيوسك.</span></div>`;
  return `<div class="section-h"><h3>الأجهزة المفعّلة <span class="count">${nf(act.length)}</span></h3></div><div class="sgrid">${act.map((d) => deviceCard(d, rel)).join('')}</div>`;
};
regions.devPending = () => {
  const pend = (ui.sessions || []).filter((x) => x.status === 'pending'); if (!pend.length) return '';
  return `<div class="section-h"><h3>جلسات بانتظار التفعيل <span class="count">${nf(pend.length)}</span></h3></div><div class="sgrid">${pend.map((x) => {
    const expired = Date.parse(x.codeExpiresAt) < Date.now();
    return `<article class="scard pending"><div class="sc-h"><strong class="sc-name">كيوسك جديد</strong><span class="badge off">${expired ? 'انتهت صلاحية المعرف' : 'بانتظار التفعيل'}</span></div>${x.label ? `<div class="muted">المكان: ${esc(x.label)}</div>` : ''}
      <div class="sc-code"><span>معرف الجلسة</span><b dir="ltr">${esc(fmtCode(x.code))}</b>${!expired ? `<button class="btn small" type="button" data-act="sess-copy" data-code="${esc(x.code)}">نسخ</button>` : ''}</div>
      <p class="hint">${expired ? 'أنشئ جلسة جديدة.' : 'أدخله في الكيوسك قبل ' + esc(fmtDate(x.codeExpiresAt))}. لا يمنح هذا المعرف أي صلاحية إدارية.</p>
      ${can('devices') ? `<div class="btnrow tight"><button class="btn small danger-o" type="button" data-act="sess-end" data-id="${esc(x.id)}">إلغاء المعرف</button></div>` : ''}</article>`;
  }).join('')}</div>`;
};
regions.devEnded = () => {
  const ended = (ui.sessions || []).filter((x) => x.status === 'ended'); if (!ended.length) return '';
  return `<details class="card details"><summary><h3>سجل الجلسات المنتهية <span class="count">${nf(ended.length)}</span></h3></summary><div class="trwrap"><table class="tbl"><thead><tr><th>الكيوسك</th><th>المكان</th><th>فُعّل</th><th>انتهت</th><th class="nm">جلسات المحاكاة</th><th></th></tr></thead><tbody>${ended.map((x) => `<tr><td>${esc(x.kioskName || '—')}</td><td>${esc(x.label || '—')}</td><td>${esc(ago(x.activatedAt))}</td><td>${esc(ago(x.endedAt))}</td><td class="nm">${nf(x.started || 0)}</td><td>${can('devices') ? `<button class="btn small danger-o" type="button" data-act="sess-del" data-id="${esc(x.id)}">${ic('trash')}حذف السجل</button>` : ''}</td></tr>`).join('')}</tbody></table></div></details>`;
};

/* ---------- نافذة تفاصيل الجهاز ---------- */
const LOG_LABEL = { created: 'فُتحت الجلسة', activated: 'تفعيل الجهاز', sync: 'مزامنة المحتوى', version: 'تحديث التطبيق', renamed: 'تعديل البيانات', ended: 'إنهاء الجلسة' };
async function openDeviceDetail(id) {
  let D;
  try { D = await backend.deviceDetail(id); } catch (e) { return toast(e.message || 'تعذّر تحميل تفاصيل الجهاز', 'warn'); }
  const d = D.device; const st = devState(d); const rel = D.liveRelease;
  const old = $('#devDlg'); if (old) old.remove();
  document.body.insertAdjacentHTML('beforeend', `<dialog id="devDlg" class="dlg wide"><div class="lib-h"><h3><span class="dot ${st.cls}" aria-hidden="true"></span> ${esc(d.name || d.deviceId)}</h3><button class="icon-btn" type="button" data-dclose aria-label="إغلاق">${ic('x')}</button></div>
    ${d.alerts.length ? `<div class="alerts">${d.alerts.map((a) => `<div class="alert ${a.severity}"><span class="sev ${a.severity}" aria-hidden="true"></span><div class="a-t"><b>${esc(a.title)}</b><span class="muted small">${esc(a.detail || '')}</span></div></div>`).join('')}</div>` : ''}
    <div class="grid2 ddet"><section><h4>المعلومات الأساسية</h4><dl class="meta"><dt>الاسم</dt><dd>${esc(d.name || '—')}</dd><dt>الموقع</dt><dd>${esc(d.label || '—')}</dd><dt>معرّف الجهاز</dt><dd dir="ltr" class="urlcell">${esc(d.deviceId)}</dd><dt>الجلسة الحالية</dt><dd dir="ltr" class="urlcell">${esc(d.sessionId)}</dd><dt>الحالة</dt><dd>${st.txt}</dd><dt>فُعّل</dt><dd>${esc(d.activatedAt ? fmtDate(d.activatedAt) : '—')}</dd></dl></section>
    <section><h4>الاتصال والتطبيق</h4><dl class="meta"><dt>آخر اتصال</dt><dd>${esc(ago(d.lastSeen))}${d.lastSeen ? ` <small class="muted">(${esc(fmtDate(d.lastSeen))})</small>` : ''}</dd><dt>إصدار التطبيق</dt><dd dir="ltr">${esc(d.version || '—')}</dd><dt>إصدار المحتوى</dt><dd>${d.contentRelease ? 'الإصدار ' + d.contentRelease : '—'}</dd><dt>المنشور حالياً</dt><dd>${rel ? 'الإصدار ' + rel : 'غير مرقّم'}</dd><dt>آخر مزامنة</dt><dd>${esc(d.contentSyncedAt ? ago(d.contentSyncedAt) : '—')}</dd><dt>الحالة</dt><dd>${syncTxt(d, rel)}</dd></dl></section></div>
    <h4>المحتوى المخصص لهذا الجهاز</h4>${D.restricted.length ? `<ul class="rows plain">${D.restricted.map((x) => `<li class="row"><span class="badge kind">${x.type === 'program' ? 'برنامج' : 'كتالوج'}</span><div class="row-t">${esc(x.label)}</div></li>`).join('')}</ul><p class="hint">هذه العناصر تظهر على هذا الجهاز فقط (حسب المسودة الحالية). أما العناصر غير المقيّدة فتظهر على كل الأجهزة.</p>` : '<p class="muted">لا عناصر مقيّدة لهذا الجهاز؛ يرى كل المحتوى المفتوح للكل.</p>'}
    <h4>سجل المزامنة والتحديثات</h4>${D.log.length ? `<ul class="rows plain alist">${D.log.map((e) => `<li class="row"><span class="ak a-${esc(e.type === 'sync' ? 'publish' : 'login')}">${esc(LOG_LABEL[e.type] || e.type)}</span><div class="row-t">${esc(e.detail || '')}<div class="muted small">${esc(fmtDate(e.at))}</div></div></li>`).join('')}</ul>` : '<p class="muted">لا أحداث بعد.</p>'}
    <h4>سجل أخطاء التطبيق</h4><p class="muted small">غير متاح: تطبيق الكيوسك لا يرسل تقارير أخطاء حالياً. يظهر هنا انقطاع الاتصال والتأخر في المزامنة فقط (أعلاه).</p>
    <h4>سجل الجلسات</h4><div class="trwrap"><table class="tbl"><thead><tr><th>الحالة</th><th>الاسم</th><th>المكان</th><th>فُعّلت</th><th>انتهت</th><th class="nm">جلسات المحاكاة</th></tr></thead><tbody>${D.sessions.map((x) => `<tr><td>${esc((SESS_STATUS[x.status] || ['—'])[0])}</td><td>${esc(x.kioskName || '—')}</td><td>${esc(x.label || '—')}</td><td>${esc(x.activatedAt ? ago(x.activatedAt) : '—')}</td><td>${esc(x.endedAt ? ago(x.endedAt) : '—')}</td><td class="nm">${nf(x.started || 0)}</td></tr>`).join('')}</tbody></table></div>
    <div class="dlg-btns"><button class="btn primary" type="button" data-dclose>إغلاق</button></div></dialog>`);
  const dlg = $('#devDlg');
  dlg.addEventListener('click', (ev) => { if (ev.target === dlg || ev.target.closest('[data-dclose]')) dlg.close(); });
  dlg.addEventListener('close', () => dlg.remove()); dlg.showModal();
}

Object.assign(actions, {
  'dev-open'(el) { openDeviceDetail(el.dataset.id); },
  'dev-refresh'() { loadSessions(true); },
});
const _onTabDev = onTab;
onTab = function onTabDevices(k) {
  _onTabDev(k);
  if (k === 'devices' && ui.devOpen) { const id = ui.devOpen; ui.devOpen = ''; setTimeout(() => openDeviceDetail(id), 50); }
};
