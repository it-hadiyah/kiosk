/* =====================================================================
   overview.js — «نظرة عامة»: مركز مراقبة وتشغيل.
   مؤشرات التشغيل (الأجهزة والمزامنة) + مؤشرات المحتوى + مركز التنبيهات القابلة للفتح.
   لا مؤشرات وهمية: ما لا تتوفر بياناته يُعرض كـ «غير متاح» مع السبب.
   يُحمَّل بعد extras.js.
   ===================================================================== */
'use strict';
TABS.push({ k: 'overview', label: 'نظرة عامة', icon: 'chart' });
VIEWS.overview = () => viewOverview();
ui.ops = null; ui.opsErr = ''; ui.alertList = []; ui.alertsAll = false;

/* ---------- تحميل بيانات التشغيل ---------- */
async function loadOps(quiet) {
  if (!feat('ops')) return;
  try { ui.ops = await backend.ops(); ui.opsErr = ''; } catch (e) { if (!ui.ops) ui.opsErr = e.message || 'تعذّر تحميل بيانات التشغيل'; }
  ui.opsAt = Date.now();
  renderNav();
  if (ui.tab === 'overview') { ui.forceRegions = !quiet; refreshRegions(); ui.forceRegions = false; }
}
async function loadOverviewData() {
  try { ui.live = normClient(await backend.fetchLive()); } catch (e) { /* يبقى */ }
  if (backend.media) { try { ui.media = await backend.media(); } catch (e) { /* يبقى */ } }
  await loadOps();
  refreshRegions();
}
/* تحديث دوري هادئ لبيانات التشغيل + شارات التنقل */
const _onBootBase = onBoot;
onBoot = async function onBootOps() {
  await _onBootBase();
  if (feat('ops')) { loadOps(true); setInterval(() => { if (document.visibilityState === 'visible') loadOps(true); }, 60000); }
};
function navBadge(k) {
  if (!ui.ops) return null;
  const al = ui.ops.alerts || [];
  if (k === 'overview') {
    const e = al.filter((a) => a.severity === 'error').length; if (e) return { text: nf(e), label: `${e} تنبيهات حرجة` };
    const w = al.filter((a) => a.severity === 'warn').length; return w ? { text: nf(w), cls: 'warn', label: `${w} تنبيهات` } : null;
  }
  if (k === 'devices') { const n = al.filter((a) => a.target && a.target.type === 'device' && a.severity !== 'info').length; return n ? { text: nf(n), label: `${n} أجهزة تحتاج متابعة` } : null; }
  return null;
}

/* ---------- التنقل من تنبيه إلى العنصر المعني ---------- */
function goTab(tab) { if (ui.edit) return; ui.tab = tab; render(); onTab(tab); }
function goTarget(t) {
  if (!t || ui.edit) return;
  if (t.type === 'device') { ui.devOpen = t.id; goTab('devices'); }
  else if (t.type === 'program') { goTab('programs'); openEditor('prog', t.id); }
  else if (t.type === 'catalog') { goTab('catalogs'); openEditor('cat', t.id); }
  else if (t.type === 'media') { ui.mf = 'all'; ui.mq = String(t.id || '').split('/').pop(); goTab('media'); }
  else if (t.type === 'media-unused') { ui.mf = 'free'; ui.mq = ''; goTab('media'); }
  else if (t.type === 'publish') { goTab('publish'); loadPublishData(); }
  else if (t.type === 'quality') { ui.ovQ = true; refreshRegions(); const d = $('#ovQualityBox'); if (d) { d.open = true; d.scrollIntoView({ behavior: 'smooth', block: 'start' }); } }
}

/* ---------- التنبيهات: تشغيلية (الخادم) + محتوى (المسودة) ---------- */
function contentAlerts() {
  const out = [];
  if (state.dirty || state.hasUnpublished) out.push({ id: 'unpublished', severity: 'info', kind: 'unpublished', title: 'توجد تغييرات لم تُنشر بعد', detail: 'المتبرعون ما زالوا يرون النسخة المنشورة السابقة.', target: { type: 'publish' } });
  const q = qualityIssues().filter((x) => x.k !== 'info');
  const tr = q.filter((x) => x.k === 'tr');
  if (tr.length) out.push({ id: 'translations', severity: 'warn', kind: 'translations', title: `${nf(tr.length)} ${tr.length === 1 ? 'عنصر ينقصه' : 'عناصر تنقصها'} ترجمة`, detail: tr.slice(0, 2).map((x) => x.text).join(' · '), target: { type: 'quality' } });
  q.filter((x) => x.k !== 'tr').forEach((x) => out.push({ id: `q:${x.k}:${x.id || ''}`, severity: x.k === 'img' || x.k === 'place' || x.k === 'empty' || x.k === 'feat' ? 'warn' : 'info', kind: 'content_' + x.k, title: x.text, detail: '', target: x.act ? { type: x.act === 'edit-cat' ? 'catalog' : 'program', id: x.id } : { type: 'quality' } }));
  const unused = (ui.media || []).filter((m) => usageOf(m).length === 0).length;
  if (unused) out.push({ id: 'media_unused', severity: 'info', kind: 'media_unused', title: `${nf(unused)} ${unused === 1 ? 'صورة غير مستخدمة' : 'صور غير مستخدمة'} في المكتبة`, detail: 'يمكن تنظيفها بأمان من تبويب الوسائط.', target: { type: 'media-unused' } });
  return out;
}
const SEV_ORDER = { error: 0, warn: 1, info: 2 };
function allAlerts() {
  const ops = ui.ops ? ui.ops.alerts : [];
  return [...ops, ...contentAlerts()].sort((a, b) => SEV_ORDER[a.severity] - SEV_ORDER[b.severity]);
}

/* ---------- العرض ---------- */
function viewOverview() {
  return `<div class="page-h"><div><h2>نظرة عامة</h2><p class="muted" id="ovStamp"></p></div>
    <div class="dash-tools">${can('stats') && feat('stats') ? `<button class="btn" type="button" data-act="tab" data-tab="dashboard">${ic('chart')}لوحة المؤشرات</button>` : ''}<button class="btn" type="button" data-act="ov-refresh">${ic('clock')}تحديث</button></div></div>
  <div class="stack"><div data-region="ovOps"></div><div data-region="ovAlerts"></div><div data-region="ovContent"></div><div data-region="ovDevices"></div><div data-region="ovQualityBox"></div></div>`;
}
const unavailable = (why) => `<div class="state">${ic('alert')}<strong>غير متاح</strong><span class="small">${esc(why)}</span></div>`;
const newestVersion = (devs) => devs.map((d) => d.version).filter(Boolean).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).pop() || '—';

regions.ovOps = () => {
  const stamp = $('#ovStamp'); if (stamp) stamp.textContent = ui.opsAt ? `آخر تحديث للبيانات ${ago(new Date(ui.opsAt).toISOString())}` : 'حالة الأجهزة والمحتوى والتنبيهات.';
  if (!feat('ops')) return `<section class="card"><h3>مؤشرات التشغيل</h3>${unavailable('بيانات الأجهزة والمزامنة تتطلب الاتصال بالخادم (غير متاحة في النسخة التجريبية).')}</section>`;
  if (!ui.ops) return `<section class="card"><h3>مؤشرات التشغيل</h3>${ui.opsErr ? `<div class="state error">${ic('alert')}<strong>تعذّر التحميل</strong><span class="small">${esc(ui.opsErr)}</span></div>` : '<div class="ovgrid"><div class="skeleton" style="height:78px"></div><div class="skeleton" style="height:78px"></div><div class="skeleton" style="height:78px"></div></div>'}</section>`;
  const O = ui.ops; const S = O.summary; const act = O.devices.filter((d) => d.status === 'active');
  const rel = O.liveRelease;
  const last = O.lastPublish ? `الإصدار المنشور ${rel} — ${ago(O.lastPublish.at)}` : 'لم يُنشر إصدار مرقّم بعد';
  return `<section class="card"><div class="card-h"><h3>مؤشرات التشغيل</h3><span class="muted small">${esc(last)}</span></div>
    ${S.total ? `<div class="ovgrid">${stat(nf(S.total), 'إجمالي الأجهزة')}${stat(nf(S.online), 'متصلة الآن', S.online === S.total ? 'ok' : '')}${stat(nf(S.offline), 'غير متصلة', S.offline ? 'bad' : '')}${stat(nf(S.attention), 'تحتاج متابعة', S.attention ? 'warn' : 'ok')}${stat(esc(newestVersion(act)), 'أحدث إصدار تطبيق')}${stat(rel ? `${nf(S.upToDate)}/${nf(S.total)}` : '—', rel ? `على الإصدار ${rel}` : 'مزامنة المحتوى', rel && S.upToDate === S.total ? 'ok' : (rel ? 'warn' : ''))}</div>
      <p class="hint">الجهاز «غير متصل» إذا لم يجلب المحتوى منذ أكثر من ${nf(O.offlineMinutes)} دقائق. التطبيق يحدّث نفسه كل دقيقة.</p>` : `<div class="state">${ic('monitor')}<strong>لا توجد أجهزة مفعّلة بعد</strong><span class="small">افتح جلسة من تبويب «الأجهزة» وأدخل معرفها في الكيوسك.</span>${can('devices') ? `<button class="btn primary" type="button" data-act="tab" data-tab="devices">${ic('monitor')}الأجهزة</button>` : ''}</div>`}</section>`;
};

regions.ovAlerts = () => {
  const list = allAlerts(); ui.alertList = list;
  const shown = ui.alertsAll ? list : list.slice(0, 6);
  const counts = { error: list.filter((a) => a.severity === 'error').length, warn: list.filter((a) => a.severity === 'warn').length };
  return `<section class="card"><div class="card-h"><h3>مركز التنبيهات <span class="count ${counts.error ? 'bad' : (counts.warn ? 'warn' : '')}">${nf(list.length)}</span></h3></div>
    ${list.length ? `<div class="alerts" role="list">${shown.map((a) => { const i = list.indexOf(a); return `<div class="alert ${a.severity}" role="listitem"><span class="sev ${a.severity}" aria-hidden="true"></span><div class="a-t"><b>${esc(a.title)}</b>${a.detail ? `<span class="muted small">${esc(a.detail)}</span>` : ''}</div><button class="btn small" type="button" data-act="alert-open" data-i="${i}">فتح</button></div>`; }).join('')}</div>
      ${list.length > 6 ? `<button class="btn ghost small" type="button" data-act="alerts-all">${ui.alertsAll ? 'عرض الأهم فقط' : `عرض الكل (${nf(list.length)})`}</button>` : ''}`
    : `<div class="state">${ic('check')}<strong>لا توجد تنبيهات</strong><span class="small">الأجهزة متصلة، والمحتوى مكتمل، والنشر سليم.</span></div>`}
    ${feat('ops') ? '' : '<p class="hint">تنبيهات الأجهزة والمزامنة تتطلب الاتصال بالخادم؛ المعروض هنا تنبيهات المحتوى فقط.</p>'}</section>`;
};

regions.ovContent = () => {
  const c = C(); const ap = c.programs.filter((p) => p.active && !p.archived).length, ac = c.catalogs.filter((k) => k.active && !k.archived).length;
  const off = c.programs.filter((p) => !p.active || p.archived).length + c.catalogs.filter((k) => !k.active || k.archived).length;
  const trN = new Set(qualityIssues().filter((x) => x.k === 'tr').map((x) => x.id)).size;
  const unused = ui.media ? ui.media.filter((m) => usageOf(m).length === 0).length : null;
  const un = state.dirty || state.hasUnpublished;
  let changes = null;
  if (ui.live) { try { changes = diffCatalogs(ui.live, c).reduce((a, g) => a + g.items.length, 0); } catch (e) { /* */ } }
  return `<section class="card"><h3>مؤشرات المحتوى</h3><div class="ovgrid">${stat(nf(ap), 'برامج نشطة')}${stat(nf(ac), 'كتالوجات نشطة')}${stat(nf(off), 'عناصر موقوفة أو مؤرشفة', off ? 'warn' : '')}${stat(nf(trN), 'عناصر بترجمة ناقصة', trN ? 'warn' : 'ok')}${stat(unused == null ? '—' : nf(unused), 'وسائط غير مستخدمة', unused ? 'warn' : '')}${stat(un ? (changes != null ? nf(changes) : 'نعم') : 'لا', 'تغييرات غير منشورة', un ? 'warn' : 'ok')}</div></section>`;
};

regions.ovDevices = () => {
  if (!feat('ops') || !ui.ops || !ui.ops.devices.length) return '';
  const devs = ui.ops.devices; const rel = ui.ops.liveRelease;
  const rows = devs.map((d) => {
    const st = d.status !== 'active' ? ['جلسته منتهية', 'off'] : (d.online ? ['متصل', 'on'] : ['غير متصل', 'bad']);
    const sync = d.status !== 'active' ? '—' : (!d.contentSyncedAt ? '<span class="muted small">لم يجلب بعد</span>' : !rel ? 'مُزامَن' : (d.contentRelease === rel ? `<span class="ok-line small">${ic('check')}الإصدار ${rel}</span>` : `<span class="warn-line small">الإصدار ${d.contentRelease || 'القديم'}${d.behind ? ' — متأخر' : ''}</span>`));
    return `<tr><td><span class="dot ${st[1]}" aria-hidden="true"></span> <button type="button" class="linkbtn" data-act="open-device" data-id="${esc(d.deviceId)}">${esc(d.name || d.deviceId)}</button>${d.label ? `<div class="muted small">${esc(d.label)}</div>` : ''}</td><td>${st[0]}</td><td>${esc(ago(d.lastSeen))}</td><td dir="ltr" class="nm">${esc(d.version || '—')}</td><td>${sync}</td><td class="nm">${d.alerts.length ? `<span class="count warn">${nf(d.alerts.length)}</span>` : ''}</td></tr>`;
  }).join('');
  return `<section class="card"><div class="card-h"><h3>الأجهزة <span class="count">${nf(devs.length)}</span></h3>${can('devices') ? `<button class="btn small" type="button" data-act="tab" data-tab="devices">إدارة الأجهزة</button>` : ''}</div>
    ${devs.length ? `<div class="trwrap"><table class="tbl"><thead><tr><th>الجهاز</th><th>الحالة</th><th>آخر اتصال</th><th>إصدار التطبيق</th><th>المحتوى</th><th class="nm">تنبيهات</th></tr></thead><tbody>${rows}</tbody></table></div>` : '<p class="muted">لا توجد أجهزة مفعّلة.</p>'}</section>`;
};

/* تفاصيل الجودة (للقراءة المفصلة): قائمة الملاحظات + جدول الترجمات */
regions.ovQualityBox = () => {
  const q = qualityIssues();
  const rows = translationRows();
  const miss = LANGS.map((l, i) => rows.filter((r) => !r.ok[i]).length);
  return `<details class="card details" id="ovQualityBox" ${ui.ovQ ? 'open' : ''}><summary><h3>تفاصيل جودة المحتوى والترجمات <span class="count">${nf(q.filter((x) => x.k !== 'info').length)}</span></h3></summary>
    ${q.length ? `<ul class="rows plain qlist">${q.map((x) => `<li class="row"><span class="qk ${x.k}">${{ img: 'صورة', tr: 'ترجمة', place: 'ظهور', empty: 'فارغ', feat: 'رواجاً', info: 'ملاحظة' }[x.k]}</span><div class="row-t">${esc(x.text)}</div>${x.act ? `<button class="btn small" type="button" data-act="${x.act}" data-id="${esc(x.id)}">فتح</button>` : ''}</li>`).join('')}</ul>` : `<p class="ok-line">${ic('check')}كل شيء مكتمل: صور وترجمات وأماكن ظهور.</p>`}
    ${rows.length ? `<h4 class="h4gap">حالة الترجمات</h4><div class="trwrap"><table class="tbl"><thead><tr><th>العنصر</th>${LANGS.map((l, i) => `<th class="nm">${l.name}${miss[i] ? ` <span class="count warn">${nf(miss[i])}</span>` : ''}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr><td>${esc(tt(r.o))}</td>${r.ok.map((ok) => `<td class="nm ${ok ? 'yes' : 'no'}">${ok ? '✓' : '✗'}</td>`).join('')}</tr>`).join('')}</tbody></table></div>` : ''}</details>`;
};

Object.assign(actions, {
  'ov-refresh'() { loadOverviewData(); },
  'alert-open'(el) { const a = ui.alertList[+el.dataset.i]; if (a) goTarget(a.target); },
  'alerts-all'() { ui.alertsAll = !ui.alertsAll; ui.forceRegions = true; refreshRegions(); ui.forceRegions = false; },
  'open-device'(el) { ui.devOpen = el.dataset.id; goTab('devices'); },
});
