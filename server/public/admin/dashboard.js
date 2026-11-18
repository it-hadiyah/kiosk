/* =====================================================================
   dashboard.js — لوحة المؤشرات (محاكاة): تبرعات تجريبية لكل جهاز وبرنامج وكتالوج.
   يُحمَّل بعد extras.js. الفصل بين المحاكاة والفعلي: الواجهة تعرض «المحاكاة» فقط حالياً.
   ===================================================================== */
'use strict';
if (feat('stats')) TABS.push({ k: 'dashboard', label: 'لوحة المؤشرات', icon: 'chart' });
VIEWS.dashboard = () => viewDashboard();

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
