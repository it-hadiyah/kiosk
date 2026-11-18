/* =====================================================================
   settings.js — الإعدادات مقسّمة إلى أقسام واضحة:
   عام · شاشة الكيوسك · المبالغ · الجلسات · اللغة والترجمة · النشر · الأجهزة · الأمان والصلاحيات.
   تحقق فوري، وعلاقة مهلتي الخمول والتنبيه موضّحة ومحميّة من القيم غير المنطقية.
   يُحمَّل بعد devices.js.
   ===================================================================== */
'use strict';
ui.setSec = 'general';
const SET_SECTIONS = [['general', 'عام'], ['screen', 'شاشة الكيوسك'], ['amounts', 'المبالغ'], ['sessions', 'الجلسات'], ['lang', 'اللغة والترجمة'], ['publish', 'النشر'], ['devices', 'الأجهزة'], ['security', 'الأمان والصلاحيات']];
const PERM_LABEL = { read: 'عرض لوحة التحكم', edit: 'تعديل المسودة', upload: 'رفع الصور', publish: 'النشر والاسترجاع', settings: 'تغيير الإعدادات العامة', media_delete: 'حذف الصور', audit: 'سجل التدقيق', stats: 'المؤشرات والإحصاءات', devices: 'إدارة الأجهزة والجلسات' };
const ROLE_NAMES = ['viewer', 'editor', 'manager', 'super'];

VIEWS.settings = () => `<div class="page-h"><div><h2>الإعدادات</h2><p class="muted">إعدادات الكيوسك والنظام مرتبة في أقسام. تُحفظ تلقائياً كمسودة، ولا تصل للكيوسكات إلا بعد «نشر التغييرات».</p></div></div>
  <div class="seg setnav" role="tablist" aria-label="أقسام الإعدادات">${SET_SECTIONS.map(([k, n]) => `<button type="button" role="tab" data-act="set-sec" data-v="${k}" aria-pressed="${ui.setSec === k}">${n}</button>`).join('')}</div>
  <div class="stack" data-region="setBody"></div>`;

function secGeneral() {
  return `<section class="card"><h3>عنوان صفحة البرامج</h3><p class="hint">اختياري — إن تركته فارغاً يُستخدم العنوان الافتراضي في التطبيق.</p>${locFields('set', 'homeTitle', 'العنوان الرئيسي')}${locFields('set', 'homeSubtitle', 'العنوان الفرعي')}</section>`;
}
function secScreen() {
  return `<section class="card"><h3>صورة شاشة الترحيب</h3>${imagePicker('welcome', { label: 'خلفية شاشة الترحيب' })}</section><div data-region="themeCard"></div>
    <section class="card"><h3>مقاس الشاشة</h3><p class="muted">تصميم التطبيق مبني على شاشة عمودية <b>1080×1920</b> ويتكيّف مع الأجهزة اللوحية؛ وعلى الشاشات العريضة يُحصر المحتوى في عمود بنفس النسبة. المعاينة في «الصفحة الرئيسية» تعرض هذا المقاس.</p></section>`;
}
function secAmounts() {
  const S = C().settings;
  return `<section class="card"><h3>المبالغ</h3>${numField('set', 'maxAmount', 'أقصى مبلغ عام', S.maxAmount, { min: 1, hint: 'أعلى مبلغ يمكن للمتبرع إدخاله في البرامج ذات المبالغ المحددة أو الحرة. (البرامج من نوع «يكتب المبلغ مباشرة» لا تتقيّد به.)' })}
    ${chipsEditor('set:quickAmounts', 'المبالغ السريعة الافتراضية (من 1 إلى 8)', 'تظهر كأزرار سريعة في البرامج التي لا تحدد مبالغها الخاصة.')}</section>
    <section class="card"><h3>قواعد المبالغ</h3><p class="muted">لا تتغير قواعد احتساب المبالغ من هنا: الحد الأدنى والأعلى والقيمة الثابتة والكمية تُضبط لكل برنامج في تعديله. المبالغ في هذه النسخة <b>محاكاة</b> ولا تُحصَّل فعلياً.</p></section>`;
}
function secSessions() {
  const S = C().settings;
  return `<section class="card"><h3>الخمول والمهلات</h3><div class="grid2">
    ${numField('set', 'idleSeconds', 'مهلة الخمول (ثانية)', S.idleSeconds, { min: 10, hint: 'المدة دون لمس قبل ظهور «هل ما زلت هنا؟» (10 إلى 600).' })}
    ${numField('set', 'warnSeconds', 'مهلة التنبيه (ثانية)', S.warnSeconds, { min: 5, hint: 'مدة عرض التنبيه قبل مسح الجلسة والعودة للبداية (5 إلى 120).' })}</div><div data-region="setRelation"></div></section>`;
}
regions.setRelation = () => {
  const S = C().settings; const i = Number(S.idleSeconds), w = Number(S.warnSeconds);
  if (!(i >= 10) || !(w >= 5)) return '';
  const bad = w > i; const tot = i + w;
  return `<div class="relation ${bad ? 'bad' : ''}" role="status"><div class="rl-bar" aria-hidden="true"><i class="rl-i" style="flex:${i}"></i><i class="rl-w" style="flex:${w}"></i></div>
    <p>${bad ? `<b>غير منطقي:</b> مهلة التنبيه (${nf(w)} ث) أطول من مهلة الخمول (${nf(i)} ث). خفّض مهلة التنبيه أو ارفع مهلة الخمول.` : `بعد <b>${nf(i)}</b> ثانية دون لمس يظهر التنبيه لمدة <b>${nf(w)}</b> ثانية، ثم يعود الكيوسك للشاشة الأولى. الإجمالي <b>${nf(tot)}</b> ثانية (${nf(Math.round(tot / 6) / 10)} دقيقة).`}</p></div>`;
};
function secLang() {
  const q = qualityIssues().filter((x) => x.k === 'tr'); const miss = LANGS.map((l, i) => translationRows().filter((r) => !r.ok[i]).length);
  return `<section class="card"><h3>اللغات</h3><ul class="rows plain">${LANGS.map((l, i) => `<li class="row"><span class="badge kind">${l.k}</span><div class="row-t"><b>${l.name}</b><span class="muted small">${l.dir === 'rtl' ? 'من اليمين لليسار' : 'من اليسار لليمين'} ${l.k === 'ar' ? '· إلزامية' : ''}</span></div>${l.k === 'ar' ? '<span class="badge kind">مطلوبة</span>' : (miss[i] ? `<span class="count warn">${nf(miss[i])} ناقصة</span>` : '<span class="ok-line small">مكتملة</span>')}</li>`).join('')}</ul>
    <p class="hint">العنصر الناقصة ترجمته يظهر بالعربية في اللغة الأخرى. العنوان العربي إلزامي لكل برنامج وكتالوج.</p>
    ${q.length ? `<button class="btn small" type="button" id="goTr">عرض العناصر الناقصة (${nf(q.length)})</button>` : ''}</section>`;
}
function secPublish() {
  const O = ui.ops;
  return `<section class="card"><h3>النشر والنسخ</h3><ul class="plainlist"><li>كل تعديل يُحفظ <b>كمسودة</b> ولا يراه المتبرعون.</li><li>«نشر التغييرات» يفحص المحتوى أولاً، ثم ينشر إصداراً مرقّماً${O && O.liveRelease ? ` (الحالي: <b>${O.liveRelease}</b>)` : ''}.</li><li>تُحفظ <b>30</b> نسخة سابقة للاسترجاع، ولا يُنشر الاسترجاع تلقائياً.</li><li>النشر والاسترجاع لمدير المحتوى فأعلى، ويُسجَّلان في سجل التدقيق.</li></ul><button class="btn" type="button" data-act="tab" data-tab="publish">${ic('cloud')}النشر والنسخ</button></section>`;
}
function secDevices() {
  const O = ui.ops; const sec = ui.security;
  return `<section class="card"><h3>الأجهزة والجلسات</h3><dl class="meta"><dt>اعتبار الجهاز غير متصل بعد</dt><dd>${O ? nf(O.offlineMinutes) : (sec ? nf(sec.offlineMinutes) : '—')} دقائق دون جلب المحتوى</dd><dt>صلاحية معرف الجلسة</dt><dd>${sec ? nf(sec.codeValidityHours) : '24'} ساعة، ويُستخدم مرة واحدة</dd><dt>دورة تحديث التطبيق</dt><dd>كل دقيقة، وبعد كل جلسة متبرع</dd></dl>
    <p class="hint">تُضبط عتبة عدم الاتصال في الخادم بالمتغير <code dir="ltr">OFFLINE_MINUTES</code>.</p>${can('devices') ? `<button class="btn" type="button" data-act="tab" data-tab="devices">${ic('monitor')}إدارة الأجهزة</button>` : ''}</section>`;
}
function secSecurity() {
  const sec = ui.security;
  if (!sec) return `<section class="card"><h3>الأمان والصلاحيات</h3><p class="muted">تفاصيل الأمان والصلاحيات تظهر لمدير النظام عند الاتصال بالخادم.</p></section>`;
  const weak = sec.weakPasswordRoles;
  const matrix = sec.roleMatrix;
  return `<section class="card"><h3>حالة الأمان</h3><ul class="rows plain">
    <li class="row"><span class="sev ${weak.length ? 'error' : 'info'}" aria-hidden="true"></span><div class="row-t"><b>كلمات المرور</b><span class="muted small">${weak.length ? `ضعيفة للأدوار: ${weak.map((r) => esc(ROLE_LABEL[r] || r)).join('، ')} — استخدم 8 خانات فأكثر وليست أرقاماً فقط.` : 'كلها قوية (8 خانات فأكثر).'}</span></div></li>
    <li class="row"><span class="sev ${sec.https ? 'info' : 'warn'}" aria-hidden="true"></span><div class="row-t"><b>الاتصال المشفّر (HTTPS)</b><span class="muted small">${sec.https ? 'مفعّل.' : 'غير مفعّل: الاتصال بين اللوحة والخادم والكيوسكات غير مشفّر. يُنصح بتشغيل الخادم خلف HTTPS في الإنتاج.'}</span></div></li>
    <li class="row"><span class="sev info" aria-hidden="true"></span><div class="row-t"><b>الأدوار المضبوطة</b><span class="muted small">${sec.rolesConfigured.map((r) => esc(ROLE_LABEL[r] || r)).join('، ')} — تُضبط كلمات المرور بمتغيرات البيئة على الخادم، ولا تُعرض هنا.</span></div></li>
    <li class="row"><span class="sev info" aria-hidden="true"></span><div class="row-t"><b>الجلسة</b><span class="muted small">رمز الدخول يصلح ${nf(sec.tokenHours)} ساعة، وتُحدَّد المحاولات الفاشلة بـ 5 في الدقيقة. سجل التدقيق يُدوَّر عند ${nf(sec.auditMaxMB)}MB.</span></div></li></ul></section>
    <section class="card"><h3>مصفوفة الصلاحيات</h3><div class="trwrap"><table class="tbl"><thead><tr><th>الصلاحية</th>${ROLE_NAMES.map((r) => `<th class="nm">${esc(ROLE_LABEL[r])}</th>`).join('')}</tr></thead><tbody>${Object.entries(PERM_LABEL).map(([p, n]) => `<tr><td>${esc(n)}</td>${ROLE_NAMES.map((r) => `<td class="nm ${(matrix[r] || []).includes(p) ? 'yes' : 'no'}">${(matrix[r] || []).includes(p) ? '✓' : '—'}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
    <p class="hint">تُطبَّق الصلاحيات في الخادم وليس في الواجهة فقط، وتُسجَّل محاولات الرفض في سجل التدقيق. الأدوار هي أدوار مشتركة (كلمة مرور لكل دور) وليست حسابات فردية.</p></section>`;
}
regions.setBody = () => {
  const f = { general: secGeneral, screen: secScreen, amounts: secAmounts, sessions: secSessions, lang: secLang, publish: secPublish, devices: secDevices, security: secSecurity }[ui.setSec] || secGeneral;
  return f();
};

/* تغيير القسم: نرسم القسم ثم نتحقق ونملأ المناطق الداخلية */
function showSetSection(k) {
  ui.setSec = k; $$('[data-act="set-sec"]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === k)));
  const r = $('[data-region="setBody"]'); if (r) r.innerHTML = regions.setBody();
  $$('[data-region="setBody"] [data-region]').forEach((n) => { const f = regions[n.dataset.region]; if (f) n.innerHTML = f(); });
  updateChrome(); validateSettingsUI();
}
Object.assign(actions, { 'set-sec'(el) { showSetSection(el.dataset.v); } });
document.addEventListener('click', (ev) => { const b = ev.target.closest('#goTr'); if (b) { ev.preventDefault(); goTarget({ type: 'quality' }); goTab('overview'); goTarget({ type: 'quality' }); } });
