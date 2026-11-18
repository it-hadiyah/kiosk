/* =====================================================================
   dashboard.js — لوحة المؤشرات والتحليلات.
   فصل صريح بين «المحاكاة» و«الفعلي»: المتاح الآن محاكاة فقط (لا يوجد نظام دفع فعلي).
   فلاتر: الفترة · الجهاز · البرنامج · الكتالوج. مقارنة بالفترة السابقة، قمع رحلة المتبرع،
   جدول تفصيلي قابل للفرز والبحث، وتصدير CSV. يُحمَّل بعد extras.js.
   ===================================================================== */
'use strict';
if (feat('stats')) TABS.push({ k: 'dashboard', label: 'لوحة المؤشرات', icon: 'chart' });
VIEWS.dashboard = () => viewDashboard();
ui.dMode = 'simulation'; ui.dRange = '7'; ui.dDev = ''; ui.dProg = ''; ui.dCat = ''; ui.dDim = 'devices'; ui.dQ = ''; ui.dSort = { key: 'completed', dir: -1 };

const RANGES = [['today', 'اليوم'], ['7', '7 أيام'], ['30', '30 يوماً'], ['all', 'الكل']];
const SAR = (n) => nf(n) + ' ر.س';
const progName = (id) => { const p = findProg(id); return p ? tt(p) : id + ' (محذوف)'; };
const catName = (id) => { const c = findCat(id); return c ? tt(c) : id + ' (محذوف)'; };

function viewDashboard() {
  const sim = ui.dMode === 'simulation';
  return `<div class="page-h"><div><h2>لوحة المؤشرات</h2><p class="muted">أداء الكيوسكات: التبرعات، البرامج والكتالوجات الأكثر اختياراً، ورحلة المتبرع.</p></div>
    <div class="dash-tools"><div class="seg" role="group" aria-label="نوع البيانات"><button type="button" data-act="dash-mode" data-v="simulation" aria-pressed="${sim}">محاكاة</button><button type="button" data-act="dash-mode" data-v="production" aria-pressed="${!sim}">فعلي</button></div></div></div>
  <div class="filters card" role="group" aria-label="الفلاتر">
    <div class="seg" role="group" aria-label="الفترة">${RANGES.map(([k, n]) => `<button type="button" data-act="dash-range" data-v="${k}" aria-pressed="${ui.dRange === k}">${n}</button>`).join('')}</div>
    <label class="sr" for="dashDev">الجهاز</label><select id="dashDev" class="dash-sel" data-dash-filter="dDev"></select>
    <label class="sr" for="dashProg">البرنامج</label><select id="dashProg" class="dash-sel" data-dash-filter="dProg"></select>
    <label class="sr" for="dashCat">الكتالوج</label><select id="dashCat" class="dash-sel" data-dash-filter="dCat"></select>
    <span class="sp"></span>
    <button class="btn" type="button" data-act="dash-refresh">${ic('clock')}تحديث</button>
    <button class="btn" type="button" data-act="dash-export">${ic('download')}تصدير CSV</button>
    ${can('publish') ? `<button class="btn danger-o" type="button" data-act="stats-reset-dash">تصفير</button>` : ''}</div>
  <div class="stack" data-region="dashBody"></div>`;
}

/* ---------- حسابات ---------- */
const dscope = () => { const D = ui.dash; if (!D || !D.available) return null; return ui.dDev ? (D.devices.find((d) => d.deviceId === ui.dDev) || D) : D; };
function delta(cur, prev, lowerIsBetter) {
  if (!prev || prev.hasData === false) return { txt: 'لا بيانات للمقارنة', cls: 'na' };
  if (!prev.v && !cur) return { txt: 'بلا تغيير', cls: 'na' };
  if (!prev.v) return { txt: 'جديد', cls: lowerIsBetter ? 'down' : 'up' };
  const ch = Math.round(((cur - prev.v) / prev.v) * 100);
  if (ch === 0) return { txt: 'بلا تغيير', cls: 'na' };
  const good = lowerIsBetter ? ch < 0 : ch > 0;
  return { txt: `${ch > 0 ? '▲' : '▼'} ${nf(Math.abs(ch))}% عن الفترة السابقة`, cls: good ? 'up' : 'down' };
}
const kpi = (value, label, d, cls = '') => `<div class="stat ${cls}"><strong>${value}</strong><span>${esc(label)}</span>${d ? `<small class="delta ${d.cls}">${esc(d.txt)}</small>` : ''}</div>`;
const prevOf = (sc, k) => { const D = ui.dash; const p = sc === D ? D.prev : sc.prev; return p ? { v: p[k] || 0, hasData: p.hasData } : null; };

/* مؤشرات النطاق الحالي: عام / برنامج / كتالوج */
function kpisHtml(sc) {
  if (ui.dProg) {
    const p = sc.programs.find((x) => x.id === ui.dProg) || { selected: 0, completed: 0, amount: 0 };
    return `<div class="ovgrid kpis">${kpi(nf(p.selected), 'مرات الاختيار')}${kpi(nf(p.completed), 'تبرعات مكتملة (محاكاة)', null, 'ok')}${kpi(SAR(p.amount), 'المبالغ (محاكاة)')}${kpi(pct(p.completed, p.selected), 'نسبة إتمام الاختيار')}</div>`;
  }
  if (ui.dCat) {
    const c = sc.catalogs.find((x) => x.id === ui.dCat) || { visits: 0, completed: 0, amount: 0 };
    return `<div class="ovgrid kpis">${kpi(nf(c.visits), 'زيارات الكتالوج')}${kpi(nf(c.completed), 'تبرعات مكتملة (محاكاة)', null, 'ok')}${kpi(SAR(c.amount), 'المبالغ (محاكاة)')}${kpi(pct(c.completed, c.visits), 'نسبة التحويل إلى تبرع')}</div>`;
  }
  const ab = pct(sc.abandoned, sc.sessions);
  const abPrev = (() => { const p = prevOf(sc, 'sessions'); const a = prevOf(sc, 'abandoned'); return p && a && p.v ? { v: Math.round((a.v / p.v) * 100), hasData: p.hasData } : (p ? { v: 0, hasData: p.hasData } : null); })();
  const abCur = sc.sessions ? Math.round((sc.abandoned / sc.sessions) * 100) : 0;
  return `<div class="ovgrid kpis">${kpi(nf(sc.completed), 'إجمالي التبرعات (محاكاة)', delta(sc.completed, prevOf(sc, 'completed')), 'ok')}${kpi(SAR(sc.amount), 'إجمالي المبالغ (محاكاة)', delta(sc.amount, prevOf(sc, 'amount')))}${kpi(nf(sc.sessions), 'جلسات المتبرعين', delta(sc.sessions, prevOf(sc, 'sessions')))}${kpi(pct(sc.completed, sc.sessions), 'معدل إكمال الجلسات')}${kpi(ab, 'معدل التخلي عن العملية', abPrev && ui.dash.prev ? delta(abCur, abPrev, true) : null, sc.abandoned ? 'warn' : '')}${kpi(sc.avgDurationSec ? nf(sc.avgDurationSec) + ' ث' : '—', 'متوسط مدة التبرع')}</div>`;
}

/* قمع رحلة المتبرع */
function funnelHtml(sc) {
  const st = [['بدأ الجلسة', sc.sessions], ['اختار برنامجاً', sc.selected], ['حدّد مبلغاً', sc.amountChosen], ['بدأ الدفع', sc.started], ['أكمل التبرع', sc.completed]];
  const top = Math.max(1, ...st.map((x) => x[1]));
  if (!sc.sessions && !sc.selected) return '<div class="state"><strong>لا بيانات بعد</strong><span class="small">تظهر الرحلة بعد أن يبدأ المتبرعون جلسات على الكيوسك.</span></div>';
  return `<ol class="funnel">${st.map(([n, v], i) => { const prev = i ? st[i - 1][1] : null; const conv = prev ? (prev > 0 && v <= prev ? Math.round((v / prev) * 100) + '% من السابق' : '—') : ''; return `<li><span class="fn">${esc(n)}</span><span class="fbar"><i style="width:${Math.round((v / top) * 100)}%"></i></span><b>${nf(v)}</b><small class="muted">${conv}</small></li>`; }).join('')}</ol>
    <p class="hint">تُحسب كل مرحلة من أحداث الكيوسك؛ «اختار برنامجاً» قد يتكرر في الجلسة الواحدة.</p>`;
}

/* رسم يومي بلا تمرير داخلي */
function chartHtml(days) {
  if (!days.length) return '<div class="state"><strong>لا بيانات في هذه الفترة</strong></div>';
  const max = Math.max(1, ...days.map((d) => d.sessions));
  const every = Math.max(1, Math.ceil(days.length / 8));
  return `<div class="chartwrap"><span class="chmax" aria-hidden="true">${nf(max)}</span><div class="chart" role="img" aria-label="الجلسات والتبرعات المكتملة حسب اليوم">${days.map((d, i) => `<div class="chcol" title="${esc(d.date)} — جلسات ${d.sessions} · تبرعات ${d.completed}${d.amount ? ' · ' + d.amount + ' ر.س (محاكاة)' : ''}"><div class="chbars"><i class="b-s" style="height:${Math.round((d.sessions / max) * 100)}%"></i><i class="b-c" style="height:${Math.round((d.completed / max) * 100)}%"></i></div><span class="chl">${i % every === 0 ? esc(d.date.slice(5)) : ''}</span></div>`).join('')}</div></div>
    <p class="hint"><i class="lg b-s"></i> جلسات &nbsp; <i class="lg b-c"></i> تبرعات مكتملة</p>`;
}
function rankList(items, valueFn, subFn, nameFn) {
  const max = Math.max(1, ...items.map(valueFn));
  return items.length ? `<ol class="rank">${items.map((x, i) => `<li><span class="rk">${i + 1}</span><div class="rk-t"><b>${esc(nameFn(x.id))}</b><span class="muted small">${subFn(x)}</span></div>${bar(valueFn(x), max)}<span class="num">${nf(valueFn(x))}</span></li>`).join('')}</ol>` : '<p class="muted">لا بيانات بعد.</p>';
}

/* ---------- الجدول التفصيلي ---------- */
function tableModel(sc) {
  const D = ui.dash;
  if (ui.dDim === 'programs') {
    return { cols: [['name', 'البرنامج', 'txt'], ['selected', 'مرات الاختيار', 'nm'], ['completed', 'التبرعات (محاكاة)', 'nm'], ['amount', 'المبالغ (محاكاة)', 'nm'], ['rate', 'نسبة الإتمام', 'nm']],
      rows: sc.programs.map((p) => ({ id: p.id, name: progName(p.id), selected: p.selected, completed: p.completed, amount: p.amount, rate: p.selected ? p.completed / p.selected : 0, fmt: { amount: SAR(p.amount), rate: pct(p.completed, p.selected) } })) };
  }
  if (ui.dDim === 'catalogs') {
    return { cols: [['name', 'الكتالوج', 'txt'], ['visits', 'الزيارات', 'nm'], ['completed', 'التبرعات (محاكاة)', 'nm'], ['amount', 'المبالغ (محاكاة)', 'nm'], ['rate', 'التحويل', 'nm']],
      rows: sc.catalogs.map((c) => ({ id: c.id, name: catName(c.id), visits: c.visits, completed: c.completed, amount: c.amount, rate: c.visits ? c.completed / c.visits : 0, fmt: { amount: SAR(c.amount), rate: pct(c.completed, c.visits) } })) };
  }
  return { cols: [['name', 'الجهاز', 'txt'], ['status', 'الحالة', 'txt'], ['sessions', 'الجلسات', 'nm'], ['completed', 'التبرعات (محاكاة)', 'nm'], ['amount', 'المبالغ (محاكاة)', 'nm'], ['rate', 'الإكمال', 'nm'], ['abandon', 'التخلي', 'nm'], ['avg', 'متوسط المدة', 'nm'], ['chg', 'التغير', 'nm']],
    rows: D.devices.map((d) => { const pc = d.prev ? d.prev.completed : null; const chg = pc == null ? null : (pc ? Math.round(((d.completed - pc) / pc) * 100) : (d.completed ? 100 : 0)); return { id: d.deviceId, deviceId: d.deviceId, name: d.name, status: d.status === 'active' ? 'نشط' : 'منتهية', sessions: d.sessions, completed: d.completed, amount: d.amount, rate: d.sessions ? d.completed / d.sessions : 0, abandon: d.sessions ? d.abandoned / d.sessions : 0, avg: d.avgDurationSec, chg: chg == null ? -999 : chg, fmt: { amount: SAR(d.amount), rate: pct(d.completed, d.sessions), abandon: pct(d.abandoned, d.sessions), avg: d.avgDurationSec ? nf(d.avgDurationSec) + ' ث' : '—', chg: chg == null ? '—' : (chg > 0 ? '▲ ' : chg < 0 ? '▼ ' : '') + nf(Math.abs(chg)) + '%' } }; }) };
}
function sortedRows(model) {
  const q = ui.dQ.trim().toLowerCase(); const { key, dir } = ui.dSort;
  let rows = model.rows.filter((r) => !q || String(r.name).toLowerCase().includes(q));
  rows = rows.sort((a, b) => { const x = a[key], y = b[key]; return (typeof x === 'string' ? x.localeCompare(y, 'ar') : (x - y)) * dir || a.name.localeCompare(b.name, 'ar'); });
  return rows;
}
function tableHtml(sc) {
  const model = tableModel(sc); const rows = sortedRows(model);
  const th = model.cols.map(([k, n, cls]) => `<th class="sortable ${cls}" data-act="dash-sort" data-k="${k}" ${ui.dSort.key === k ? `aria-sort="${ui.dSort.dir > 0 ? 'ascending' : 'descending'}"` : ''} tabindex="0" role="columnheader">${esc(n)}${ui.dSort.key === k ? (ui.dSort.dir > 0 ? ' ▲' : ' ▼') : ''}</th>`).join('');
  const body = rows.map((r) => `<tr>${model.cols.map(([k, , cls]) => `<td class="${cls}">${k === 'name' && ui.dDim === 'devices' ? `<button type="button" class="linkbtn" data-act="dash-dev" data-id="${esc(r.deviceId)}">${esc(r.name)}</button>` : esc(r.fmt && r.fmt[k] != null ? r.fmt[k] : r[k])}</td>`).join('')}</tr>`).join('');
  return `<div class="trwrap"><table class="tbl"><thead><tr>${th}</tr></thead><tbody>${body || `<tr><td colspan="${model.cols.length}" class="muted">لا نتائج.</td></tr>`}</tbody></table></div>`;
}
/* ---------- المنطقة الرئيسية ---------- */
regions.dashBody = () => {
  if (!ui.dash) return ui.dashErr ? `<div class="state error">${ic('alert')}<strong>تعذّر تحميل المؤشرات</strong><span class="small">${esc(ui.dashErr)}</span></div>` : '<div class="ovgrid"><div class="skeleton" style="height:84px"></div><div class="skeleton" style="height:84px"></div><div class="skeleton" style="height:84px"></div></div>';
  const D = ui.dash;
  if (!D.available) return `<section class="card"><div class="state">${ic('alert')}<strong>البيانات الفعلية غير متاحة</strong><span class="small">${esc(D.reason || '')}</span><span class="small">هذا الفصل يمنع اعتبار أي عملية محاكاة تبرعاً مالياً حقيقياً.</span></div></section>`;
  const sc = dscope(); const isDev = sc !== D;
  const scopeName = isDev ? `«${sc.name}»` : 'كل الأجهزة';
  const rangeName = (RANGES.find((r) => r[0] === ui.dRange) || [])[1] || '';
  const topProg = [...sc.programs].sort((a, b) => b.completed - a.completed || b.selected - a.selected).filter((p) => !ui.dProg || p.id === ui.dProg).slice(0, 8);
  const catsByVisit = [...sc.catalogs].sort((a, b) => b.visits - a.visits || b.completed - a.completed).filter((c) => !ui.dCat || c.id === ui.dCat).slice(0, 6);
  const catsByDon = [...sc.catalogs].sort((a, b) => b.completed - a.completed || b.visits - a.visits).filter((c) => !ui.dCat || c.id === ui.dCat).slice(0, 6);
  const dims = [['devices', 'حسب الجهاز'], ['programs', 'حسب البرنامج'], ['catalogs', 'حسب الكتالوج']];
  return `<div class="demo-note" role="note"><b>بيانات محاكاة:</b> «التبرعات» والمبالغ ناتجة عن محاكاة الدفع على الكيوسك، وليست عمليات مالية حقيقية، ولا تدخل في أي تقرير مالي. لا تُخزَّن بيانات شخصية أو مالية.</div>
  <section class="card"><div class="card-h"><h3>الملخص — ${esc(scopeName)} <span class="count">${esc(rangeName)}</span></h3></div>${kpisHtml(sc)}</section>
  <div class="grid2 dash2"><section class="card"><h3>رحلة المتبرع</h3>${funnelHtml(sc)}</section><section class="card"><h3>التبرعات حسب اليوم</h3>${chartHtml(sc.byDay)}</section></div>
  <div class="grid2 dash2"><section class="card"><h3>البرامج الأكثر اختياراً وتبرعاً</h3>${rankList(topProg, (x) => x.completed, (x) => `اختير ${nf(x.selected)} مرة · ${SAR(x.amount)}`, progName)}</section>
  <section class="card"><h3>الكتالوجات</h3><h4>الأكثر زيارة</h4>${rankList(catsByVisit, (x) => x.visits, (x) => `${nf(x.completed)} تبرع · ${x.visits ? pct(x.completed, x.visits) : '—'} تحويل`, catName)}<h4 class="h4gap">الأكثر تبرعاً</h4>${rankList(catsByDon, (x) => x.completed, (x) => `${SAR(x.amount)} · ${nf(x.visits)} زيارة`, catName)}</section></div>
  <section class="card"><div class="card-h"><h3>الجدول التفصيلي</h3><div class="dash-tools"><div class="seg" role="group" aria-label="بُعد الجدول">${dims.map(([k, n]) => `<button type="button" data-act="dash-dim" data-v="${k}" aria-pressed="${ui.dDim === k}">${n}</button>`).join('')}</div><label class="sr" for="dashQ">بحث</label><input id="dashQ" type="search" placeholder="بحث بالاسم…" value="${esc(ui.dQ)}" data-dash-q></div></div>${tableHtml(sc)}</section>`;
};

/* ---------- التحميل والمزامنة مع الفلاتر ---------- */
async function loadDashboard(quiet) {
  if (!feat('stats') || !can('stats')) return;
  try { ui.dash = await backend.dashboard(ui.dRange, ui.dMode); ui.dashErr = ''; } catch (e) { if (!ui.dash) ui.dashErr = e.message || 'تعذّر تحميل المؤشرات'; }
  syncDashFilters(); ui.forceRegions = !quiet; refreshRegions(); ui.forceRegions = false;
}
function fillSel(id, first, items, cur) {
  const sel = $('#' + id); if (!sel) return;
  sel.innerHTML = `<option value="">${esc(first)}</option>` + items.map(([v, n]) => `<option value="${esc(v)}" ${cur === v ? 'selected' : ''}>${esc(n)}</option>`).join('');
}
function syncDashFilters() {
  const D = ui.dash; if (!D || !D.available) { ['dashDev', 'dashProg', 'dashCat'].forEach((i) => { const s = $('#' + i); if (s) { s.innerHTML = '<option value="">—</option>'; s.disabled = true; } }); return; }
  ['dashDev', 'dashProg', 'dashCat'].forEach((i) => { const s = $('#' + i); if (s) s.disabled = false; });
  if (ui.dDev && !D.devices.some((d) => d.deviceId === ui.dDev)) ui.dDev = '';
  fillSel('dashDev', 'كل الأجهزة', D.devices.map((d) => [d.deviceId, d.name]), ui.dDev);
  const sc = dscope() || D;
  const pids = [...new Set([...sc.programs.map((p) => p.id), ...C().programs.map((p) => p.id)])];
  const cids = [...new Set([...sc.catalogs.map((c) => c.id), ...C().catalogs.map((c) => c.id)])];
  fillSel('dashProg', 'كل البرامج', pids.map((id) => [id, progName(id)]), ui.dProg);
  fillSel('dashCat', 'كل الكتالوجات', cids.map((id) => [id, catName(id)]), ui.dCat);
}
const redraw = () => { ui.forceRegions = true; refreshRegions(); ui.forceRegions = false; };

/* ---------- تصدير CSV (الجدول الظاهر) ---------- */
function csvCell(v) { const t = String(v ?? ''); return /[",\n]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t; }
function exportDashboardCsv() {
  const D = ui.dash; if (!D || !D.available) return toast('لا بيانات لتصديرها', 'warn');
  const sc = dscope(); const model = tableModel(sc); const rows = sortedRows(model);
  const head = [['# بيانات محاكاة — ليست مبالغ مالية حقيقية'], [`# الفترة: ${(RANGES.find((r) => r[0] === ui.dRange) || [])[1]} — النطاق: ${sc === D ? 'كل الأجهزة' : sc.name}`], model.cols.map((c) => c[1])];
  const lines = [...head, ...rows.map((r) => model.cols.map(([k]) => (r.fmt && r.fmt[k] != null ? r.fmt[k] : r[k])))].map((l) => l.map(csvCell).join(','));
  const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = `hadiyah-simulation-${ui.dDim}-${ui.dRange}.csv`; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000); toast('تم تصدير الجدول ✓');
}

Object.assign(actions, {
  'dash-mode'(el) { ui.dMode = el.dataset.v; ui.dash = null; $$('[data-act="dash-mode"]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === ui.dMode))); redraw(); loadDashboard(); },
  'dash-range'(el) { ui.dRange = el.dataset.v; $$('[data-act="dash-range"]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === ui.dRange))); loadDashboard(); },
  'dash-refresh'() { loadDashboard(); },
  'dash-dev'(el) { ui.dDev = el.dataset.id; const sel = $('#dashDev'); if (sel) sel.value = ui.dDev; syncDashFilters(); redraw(); },
  'dash-dim'(el) { ui.dDim = el.dataset.v; ui.dSort = { key: ui.dDim === 'devices' ? 'completed' : 'completed', dir: -1 }; redraw(); },
  'dash-sort'(el) { const k = el.dataset.k; ui.dSort = ui.dSort.key === k ? { key: k, dir: -ui.dSort.dir } : { key: k, dir: k === 'name' ? 1 : -1 }; redraw(); },
  'dash-export'() { exportDashboardCsv(); },
  async 'stats-reset-dash'() {
    if (!(await confirmDlg('تصفير كل إحصائيات المحاكاة؟ لا يمكن التراجع. (لا يمس أي بيانات حقيقية.)', 'تصفير', true))) return;
    try { await backend.resetStats(); toast('تم التصفير'); loadDashboard(); } catch (e) { toast(e.message || 'تعذّر التصفير', 'warn'); }
  },
});
document.addEventListener('change', (ev) => {
  const el = ev.target; if (!el.matches || !el.matches('[data-dash-filter]')) return;
  const k = el.dataset.dashFilter; ui[k] = el.value;
  if (k === 'dProg' && el.value) { ui.dCat = ''; const c = $('#dashCat'); if (c) c.value = ''; }
  if (k === 'dCat' && el.value) { ui.dProg = ''; const c = $('#dashProg'); if (c) c.value = ''; }
  if (k === 'dDev') syncDashFilters();
  redraw();
});
document.addEventListener('input', (ev) => { const el = ev.target; if (el.matches && el.matches('[data-dash-q]')) { ui.dQ = el.value; const r = $('[data-region="dashBody"]'); if (r) { const pos = el.selectionStart; r.innerHTML = regions.dashBody(); const n = $('#dashQ'); if (n) { n.focus(); n.setSelectionRange(pos, pos); } } } });
document.addEventListener('keydown', (ev) => { const el = ev.target; if (ev.key === 'Enter' && el.matches && el.matches('th[data-act="dash-sort"]')) actions['dash-sort'](el); });
