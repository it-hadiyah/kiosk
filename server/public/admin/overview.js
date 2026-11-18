/* overview.js — مؤقت: سيُستبدل بمركز التشغيل */
'use strict';
VIEWS.overview = () => viewOverview();
/* ---------- نظرة عامة ---------- */
function viewOverview() {
  return `<div class="page-h"><div><h2>نظرة عامة</h2><p class="muted">حالة المحتوى المنشور، وجودته، وأداء المحاكاة على الكيوسك.</p></div>
    <button class="btn" type="button" data-act="ov-refresh">${ic('clock')}تحديث</button></div>
  <div class="stack"><div data-region="ovCards"></div><div data-region="ovQuality"></div><div data-region="ovTr"></div>
  <div data-region="ovStats"></div><div data-region="ovDevices"></div></div>`;
}
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

