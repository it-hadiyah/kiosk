/* =====================================================================
   media.js — مكتبة الوسائط: شبكة/قائمة، بحث، فرز، فلاتر (استخدام/نوع)، أبعاد وحجم،
   معاينة وتفاصيل، رفع متعدد بتحقق وضغط، منع حذف المستخدم، وتنظيف آمن لغير المستخدم.
   الصور تُحمَّل تدريجياً (lazy + decoding async) بأحجام مصغّرة بالعرض.
   يُحمَّل بعد content.js.
   ===================================================================== */
'use strict';
TABS.push({ k: 'media', label: 'الوسائط', icon: 'image' });
VIEWS.media = () => viewMedia();
ui.mf = 'all'; ui.mt = ''; ui.mq = ''; ui.mView = 'grid'; ui.mSort = 'date'; ui.mDir = -1; ui.mDetail = '';

/* ---------- الاستخدام: من الخادم + المسودة الحالية ---------- */
function usageOf(m) {
  const u = new Set(m.usedBy || []); const c = C();
  c.programs.forEach((p) => { if (p.image === m.url) u.add(`برنامج «${tt(p)}»`); if (p.popupImage === m.url) u.add(`نافذة «${tt(p)}»`); });
  c.catalogs.forEach((k) => { if (k.image === m.url) u.add(`كتالوج «${tt(k)}»`); });
  if (c.settings.welcomeBackground === m.url) u.add('خلفية الترحيب');
  return [...u];
}
async function loadMedia() {
  try { ui.media = await backend.media(); ui.mediaErr = ''; } catch (e) { ui.media = null; ui.mediaErr = e.message || 'تعذّر تحميل الوسائط'; }
  ui.forceRegions = true; refreshRegions(); ui.forceRegions = false;
}
const mediaRows = () => (ui.media || []).map((m) => ({ ...m, use: usageOf(m) }));
const KBs = (n) => (n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB');
const dimsTxt = (m) => (m.width && m.height ? `${nf(m.width)}×${nf(m.height)}` : '—');
const dateTxt = (m) => (m.at ? new Date(m.at).toLocaleDateString('ar-SA', { year: 'numeric', month: 'short', day: 'numeric' }) : '—');
/* ملاحظة جودة: صورة أصغر من المطلوب لشاشة الكيوسك (1080 عرضاً) أو كبيرة الحجم */
const qualityNote = (m) => (m.width && m.width < 700 ? 'منخفضة الدقة' : (m.size > 2 * 1048576 ? 'حجم كبير' : ''));

/* ---------- الصفحة ---------- */
function viewMedia() {
  return `<div class="page-h"><div><h2>الوسائط</h2><p class="muted">كل الصور المرفوعة: تصفّح، أعد الاستخدام، وتعرّف أين تُستخدم كل صورة. لا يمكن حذف صورة مستخدمة.</p></div>
    <div class="dash-tools">${can('media_delete') && feat('deleteMedia') ? '<button class="btn" type="button" data-act="media-cleanup" id="mediaCleanBtn" hidden></button>' : ''}${can('upload') ? `<button class="btn primary" type="button" data-act="media-upload">${ic('upload')}رفع صور</button><input id="mediaFile" type="file" accept="image/jpeg,image/png,image/webp" multiple hidden>` : ''}</div></div>
  <div class="filters card" role="group" aria-label="تصفية الوسائط"><div class="search">${ic('search')}<label class="sr" for="mq">بحث في الوسائط</label><input id="mq" type="search" data-mq="1" placeholder="ابحث باسم الملف…" value="${esc(ui.mq)}"></div>
    <div class="seg" role="group" aria-label="الاستخدام">${[['all', 'الكل'], ['used', 'مستخدمة'], ['free', 'غير مستخدمة']].map(([k, n]) => `<button type="button" data-act="media-filter" data-v="${k}" aria-pressed="${ui.mf === k}">${n}</button>`).join('')}</div>
    <label class="sr" for="mType">نوع الملف</label><select id="mType" class="dash-sel" data-media-type><option value="">كل الأنواع</option>${['jpg', 'png', 'webp'].map((t) => `<option value="${t}" ${ui.mt === t ? 'selected' : ''}>${t.toUpperCase()}</option>`).join('')}</select>
    <label class="sr" for="mSort">الفرز</label><select id="mSort" class="dash-sel" data-media-sort>${[['date', 'تاريخ الرفع'], ['size', 'الحجم'], ['name', 'الاسم'], ['use', 'عدد الاستخدامات']].map(([k, n]) => `<option value="${k}" ${ui.mSort === k ? 'selected' : ''}>${n}</option>`).join('')}</select>
    <button class="btn" type="button" data-act="media-sort-dir" aria-label="عكس ترتيب الفرز">${ui.mDir > 0 ? '▲ تصاعدي' : '▼ تنازلي'}</button>
    <span class="sp"></span><div class="seg" role="group" aria-label="طريقة العرض"><button type="button" data-act="media-view" data-v="grid" aria-pressed="${ui.mView === 'grid'}">شبكة</button><button type="button" data-act="media-view" data-v="list" aria-pressed="${ui.mView === 'list'}">قائمة</button></div></div>
  <p class="muted small" id="mediaSummary"></p>
  <div data-region="mediaGrid"></div>`;
}
function filteredMedia() {
  const q = ui.mq.trim().toLowerCase();
  let rows = mediaRows().filter((m) => (!q || m.name.toLowerCase().includes(q)) && (ui.mf === 'all' || (ui.mf === 'used') === (m.use.length > 0)) && (!ui.mt || m.type === ui.mt));
  const key = { date: (m) => m.at || '', size: (m) => m.size || 0, name: (m) => m.name, use: (m) => m.use.length }[ui.mSort];
  rows = rows.sort((a, b) => { const x = key(a), y = key(b); return (typeof x === 'string' ? x.localeCompare(y) : x - y) * ui.mDir; });
  return rows;
}
const mThumb = (m) => `<img src="${esc(imgSrc(m.url))}" alt="" loading="lazy" decoding="async" ${m.width ? `width="${m.width}" height="${m.height}"` : ''}>`;
regions.mediaGrid = () => {
  if (!ui.media) return ui.mediaErr ? `<div class="state error">${ic('alert')}<strong>تعذّر تحميل الوسائط</strong><span class="small">${esc(ui.mediaErr)}</span></div>` : '<div class="mgrid">' + '<div class="skeleton" style="aspect-ratio:4/3"></div>'.repeat(6) + '</div>';
  const all = mediaRows(); const rows = filteredMedia();
  const unused = all.filter((m) => !m.use.length);
  const total = all.reduce((a, m) => a + (m.size || 0), 0);
  const sum = $('#mediaSummary'); if (sum) sum.textContent = `${nf(rows.length)} من ${nf(all.length)} صورة · الحجم الكلي ${KBs(total)} · ${nf(unused.length)} غير مستخدمة`;
  const cb = $('#mediaCleanBtn'); if (cb) { cb.hidden = !unused.length; cb.innerHTML = `${ic('trash')}تنظيف غير المستخدمة (${nf(unused.length)})`; }
  if (!all.length) return `<div class="state">${ic('image')}<strong>لا توجد صور بعد</strong><span class="small">ارفع صوراً لتظهر هنا.</span></div>`;
  if (!rows.length) return `<div class="state">${ic('search')}<strong>لا صور مطابقة</strong><span class="small">غيّر البحث أو الفلاتر.</span></div>`;
  const badges = (m) => `${m.use.length ? `<span class="badge kind">مستخدمة (${nf(m.use.length)})</span>` : '<span class="badge off">غير مستخدمة</span>'}${qualityNote(m) ? `<span class="badge off">${qualityNote(m)}</span>` : ''}`;
  if (ui.mView === 'list') return `<div class="card"><div class="trwrap"><table class="tbl mtbl"><thead><tr><th></th><th>الاسم</th><th>الأبعاد</th><th class="nm">الحجم</th><th>الرفع</th><th>الاستخدام</th><th></th></tr></thead><tbody>${rows.map((m) => `<tr><td class="mt"><button type="button" class="thumbbtn" data-act="media-open" data-name="${esc(m.name)}" aria-label="تفاصيل ${esc(m.name)}">${mThumb(m)}</button></td><td dir="ltr" class="mname-c">${esc(m.name)}</td><td dir="ltr">${dimsTxt(m)}</td><td class="nm">${KBs(m.size || 0)}</td><td>${esc(dateTxt(m))}</td><td>${badges(m)}</td><td><button class="btn small" type="button" data-act="media-open" data-name="${esc(m.name)}">تفاصيل</button></td></tr>`).join('')}</tbody></table></div></div>`;
  return `<div class="mgrid">${rows.map((m) => `<article class="mcard"><button type="button" class="mimg" data-act="media-open" data-name="${esc(m.name)}" aria-label="تفاصيل ${esc(m.name)}">${mThumb(m)}</button>
    <div class="mbody"><strong dir="ltr" class="mname" title="${esc(m.name)}">${esc(m.name)}</strong><span class="muted small" dir="ltr">${dimsTxt(m)} · ${KBs(m.size || 0)}</span><div class="mbadges">${badges(m)}</div></div></article>`).join('')}</div>`;
};

/* ---------- نافذة التفاصيل ---------- */
function openMediaDetail(name) {
  const m = mediaRows().find((x) => x.name === name); if (!m) return;
  const old = $('#mediaDlg'); if (old) old.remove();
  const abs = new URL(m.url, location.href).href;
  document.body.insertAdjacentHTML('beforeend', `<dialog id="mediaDlg" class="dlg wide"><div class="lib-h"><h3 dir="ltr">${esc(m.name)}</h3><button class="icon-btn" type="button" data-mclose aria-label="إغلاق">${ic('x')}</button></div>
    <div class="mdet"><div class="mdet-img"><img src="${esc(imgSrc(m.url))}" alt="${esc(m.name)}"></div>
    <dl class="meta"><dt>الأبعاد</dt><dd dir="ltr">${dimsTxt(m)}</dd><dt>الحجم</dt><dd>${KBs(m.size || 0)}</dd><dt>النوع</dt><dd dir="ltr">${esc((m.type || '').toUpperCase())}</dd><dt>الرفع</dt><dd>${esc(dateTxt(m))}</dd>${qualityNote(m) ? `<dt>ملاحظة</dt><dd>${qualityNote(m)}</dd>` : ''}
      <dt>الرابط</dt><dd dir="ltr" class="urlcell">${esc(abs)}</dd></dl></div>
    <h4>يُستخدم في</h4>${m.use.length ? `<ul class="rows plain">${m.use.map((x) => `<li class="row"><div class="row-t">${esc(x)}</div></li>`).join('')}</ul>` : '<p class="muted">غير مستخدمة في أي مكان (مسودة أو منشور).</p>'}
    <div class="dlg-btns"><button class="btn" type="button" data-mcopy="${esc(abs)}">نسخ الرابط</button>${feat('deleteMedia') && can('media_delete') ? `<button class="btn danger-o" type="button" data-mdel="${esc(m.name)}" ${m.use.length ? 'disabled title="مستخدمة — أزل استخدامها أولاً"' : ''}>${ic('trash')}حذف الصورة</button>` : ''}<button class="btn primary" type="button" data-mclose>إغلاق</button></div></dialog>`);
  const d = $('#mediaDlg');
  d.addEventListener('click', async (ev) => {
    if (ev.target === d || ev.target.closest('[data-mclose]')) return d.close();
    const c = ev.target.closest('[data-mcopy]'); if (c) { try { await navigator.clipboard.writeText(c.dataset.mcopy); toast('تم نسخ الرابط ✓'); } catch (e) { toast(c.dataset.mcopy, 'warn'); } return; }
    const x = ev.target.closest('[data-mdel]');
    if (x && !x.disabled) { d.close(); if (await confirmDlg(`حذف الصورة ${x.dataset.mdel} نهائياً؟ لا يمكن التراجع.`, 'حذف', true)) { try { await backend.deleteMedia(x.dataset.mdel); toast('تم حذف الصورة'); loadMedia(); } catch (e) { toast(e.message || 'تعذّر الحذف', 'warn'); } } }
  });
  d.addEventListener('close', () => d.remove()); d.showModal();
}

/* ---------- الرفع المتعدد: تحقق + ضغط + ملخص ---------- */
async function uploadFiles(files) {
  const list = Array.from(files); if (!list.length) return;
  const ok = [], bad = [];
  for (let i = 0; i < list.length; i++) {
    const f = list[i];
    if (list.length > 1) announce(`رفع ${i + 1} من ${list.length}`);
    if (!/^image\/(jpeg|png|webp)$/.test(f.type)) { bad.push(`${f.name}: نوع غير مدعوم (jpg / png / webp فقط)`); continue; }
    if (f.size > 25 * 1024 * 1024) { bad.push(`${f.name}: أكبر من 25MB`); continue; }
    try {
      const small = await downscale(f);
      if (small.size > MAX_UPLOAD) { bad.push(`${f.name}: يتجاوز 6MB بعد الضغط`); continue; }
      await backend.upload(small); ok.push(f.name);
    } catch (e) {
      if (e.status === 401) { showLogin('انتهت الجلسة، أعد تسجيل الدخول.'); return; }
      bad.push(`${f.name}: ${e.message || 'تعذّر الرفع'}`);
    }
  }
  await loadMedia();
  if (ok.length) toast(`تم رفع ${nf(ok.length)} ${ok.length === 1 ? 'صورة' : 'صور'} ✓`);
  if (bad.length) showErrors(bad, `لم يُرفع ${nf(bad.length)} من الملفات`);
}

Object.assign(actions, {
  'media-upload'() { $('#mediaFile').click(); },
  'media-filter'(el) { ui.mf = el.dataset.v; $$('[data-act="media-filter"]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === ui.mf))); refreshRegions(); },
  'media-view'(el) { ui.mView = el.dataset.v; $$('[data-act="media-view"]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === ui.mView))); ui.forceRegions = true; refreshRegions(); ui.forceRegions = false; },
  'media-sort-dir'(el) { ui.mDir = -ui.mDir; el.textContent = ui.mDir > 0 ? '▲ تصاعدي' : '▼ تنازلي'; ui.forceRegions = true; refreshRegions(); ui.forceRegions = false; },
  'media-open'(el) { openMediaDetail(el.dataset.name); },
  async 'media-cleanup'() {
    const n = mediaRows().filter((m) => !m.use.length).length; if (!n) return;
    if (!(await confirmDlg(`حذف ${nf(n)} ${n === 1 ? 'صورة غير مستخدمة' : 'صور غير مستخدمة'} نهائياً؟ الصور المستخدمة في المسودة أو المنشور لن تُحذف.`, 'تنظيف', true))) return;
    try { const r = await backend.cleanupMedia(); toast(`تم حذف ${nf(r.deleted)} ${r.deleted === 1 ? 'صورة' : 'صور'}`); loadMedia(); } catch (e) { toast(e.message || 'تعذّر التنظيف', 'warn'); }
  },
});
document.addEventListener('input', (ev) => {
  const el = ev.target; if (!el.matches || !el.matches('[data-mq]')) return;
  ui.mq = el.value; const r = $('[data-region="mediaGrid"]'); if (r) r.innerHTML = regions.mediaGrid();
});
document.addEventListener('change', (ev) => {
  const el = ev.target; if (!el.matches) return;
  if (el.matches('[data-media-type]')) { ui.mt = el.value; ui.forceRegions = true; refreshRegions(); ui.forceRegions = false; }
  else if (el.matches('[data-media-sort]')) { ui.mSort = el.value; ui.forceRegions = true; refreshRegions(); ui.forceRegions = false; }
  else if (el.matches('#mediaFile')) { const files = el.files; uploadFiles(files).finally(() => { el.value = ''; }); }
});
const _onTabMedia = onTab;
onTab = function onTabMedia(k) { _onTabMedia(k); if (k === 'media') loadMedia(); };
