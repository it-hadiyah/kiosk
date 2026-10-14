'use strict';
// اختبار شامل للوحة التحكم (Playwright). يشغّل خادماً مؤقتاً بنفسه.
//   NODE_PATH=/opt/node22/lib/node_modules node server/test/panel.e2e.js
// متغيرات اختيارية: SHOTS=<مجلد لقطات الشاشة>  CHROME=<مسار chromium>
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { chromium } = require('playwright');
const { normalize } = require('../validate');

const PASS = 'e2e-pass';
const PORT = 20000 + Math.floor(Math.random() * 20000);
const BASE = `http://127.0.0.1:${PORT}`;
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'hd-e2e-'));
const SHOTS = process.env.SHOTS || path.join(DATA, 'shots');
fs.mkdirSync(SHOTS, { recursive: true });
const CHROME = process.env.CHROME || (() => {
  const root = '/opt/pw-browsers'; try { const d = fs.readdirSync(root).find((x) => /^chromium-\d+$/.test(x)); return d ? path.join(root, d, 'chrome-linux/chrome') : undefined; } catch (e) { return undefined; }
})();

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✓', m); } else { fail++; console.log('  ✗ FAIL:', m); } };
const eq = (a, b, m) => ok(JSON.stringify(a) === JSON.stringify(b), `${m}${JSON.stringify(a) === JSON.stringify(b) ? '' : `  (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`}`);
const getJson = (url, headers = {}) => new Promise((res, rej) => http.get(url, { headers }, (r) => { let b = ''; r.on('data', (c) => (b += c)); r.on('end', () => { try { res(JSON.parse(b)); } catch (e) { rej(e); } }); }).on('error', rej));

async function main() {
  const srv = spawn('node', [path.join(__dirname, '../server.js')], { env: { ...process.env, PORT, DATA_DIR: DATA, ADMIN_PASSWORD: PASS, EDITOR_PASSWORD: 'e2e-editor', VIEWER_PASSWORD: 'e2e-viewer' }, stdio: 'pipe' });
  srv.stderr.on('data', (d) => process.stderr.write(d));
  for (let i = 0; i < 50; i++) { try { await getJson(BASE + '/api/health'); break; } catch (e) { await new Promise((r) => setTimeout(r, 100)); } }

  const browser = await chromium.launch({ executablePath: CHROME });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ar-SA' });
  const page = await ctx.newPage();
  const jsErrors = [];
  page.on('pageerror', (e) => jsErrors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.g|net::ERR|Failed to load resource/.test(m.text())) jsErrors.push(m.text()); });

  const saved = () => page.waitForFunction(() => !state.dirty && !state.saving && state.saveStatus === 'saved', null, { timeout: 8000 });
  const tab = (k) => page.click(`[data-act=tab][data-tab=${k}]`);
  const confirmYes = async () => { await page.waitForSelector('#dlg[open]'); await page.click('#dlgYes'); };
  const rowsOf = (sel = '#pvHomeGrid') => page.$$eval(`${sel} .pv-row`, (rows) => rows.map((r) => Array.from(r.querySelectorAll('.tile')).map((t) => t.className.match(/s-(small|medium|large)/)[1])));
  const shot = (n, o = {}) => page.screenshot({ path: path.join(SHOTS, n + '.png'), fullPage: true, ...o });

  try {
    /* ---------- الدخول ---------- */
    console.log('== login');
    await page.goto(BASE + '/admin/');
    await page.waitForSelector('#loginPw');
    await shot('00-login-desktop');
    await page.fill('#loginPw', 'wrong');
    await page.click('#loginBtn');
    await page.waitForFunction(() => document.querySelector('#loginErr').textContent.length > 0);
    ok((await page.textContent('#loginErr')).includes('غير صحيحة'), 'wrong password shows Arabic error');
    await page.fill('#loginPw', PASS); await page.click('#loginBtn');
    await page.waitForSelector('#app:not([hidden])');
    ok(await page.isHidden('#login'), 'login hidden after success');
    ok((await page.textContent('#pill')).includes('منشور'), 'status pill = منشور initially');
    ok(await page.isHidden('#demoBadge'), 'no demo badge in server mode');

    /* ---------- برنامج جديد (قيمة ثابتة) + رفع صورة ---------- */
    console.log('== create program (fixed 15 + quantity + upload)');
    await tab('programs');
    const nSeed = await page.$$eval('.pcard', (a) => a.length);
    ok(nSeed >= 5, `seed programs listed (${nSeed})`);
    await page.click('[data-act=new-prog] >> nth=0');
    await page.waitForSelector('#drawer.open');
    await page.fill('[data-ctx=prog][data-f="title.ar"]', 'كسوة الشتاء');
    await page.fill('[data-ctx=prog][data-f="title.en"]', 'Winter Clothes');
    ok((await page.inputValue('[data-ctx=prog][data-f=id]')) === 'winter-clothes', 'id auto-slug from English title');
    await page.click('label.rcard:has(input[value=fixed])');
    await page.fill('[data-ctx=prog][data-f=price]', '15');
    await page.check('[data-ctx=prog][data-f=allowQuantity]');
    await page.fill('[data-ctx=prog][data-f=maxQuantity]', '20');
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
    await page.setInputFiles('.imgp[data-pk=prog] [data-img-file]', { name: 'tiny.png', mimeType: 'image/png', buffer: png });
    await page.waitForFunction(() => /^\/uploads\//.test(ui.edit.obj.image), null, { timeout: 8000 });
    ok(true, 'image uploaded and url set (/uploads/…)');
    // أخطاء مضمّنة
    await page.fill('[data-ctx=prog][data-f=price]', '0');
    await page.click('[data-act=create]');
    ok((await page.textContent('[data-err=price]')).includes('1 أو أكثر'), 'inline error for fixed price 0');
    ok(await page.$('#drawer.open') !== null, 'drawer stays open on invalid');
    await page.fill('[data-ctx=prog][data-f=price]', '15');
    // مكان الظهور: الرئيسية صغير
    await page.check('[data-place=home]');
    await page.click('[data-act=pl-size][data-key=home][data-v=small]');
    await shot('10-program-editor-desktop', { fullPage: false });
    await page.click('[data-act=create]');
    await saved();
    ok(await page.$('.pcard[data-id=winter-clothes]') !== null, 'new program card appears');
    await page.click('[data-act=close-editor] >> nth=-1');
    await page.waitForSelector('#drawer', { state: 'hidden' });

    // برنامج مفتوح ثانٍ (صدقة) بمبالغ خاصة
    await page.click('[data-act=new-prog] >> nth=0');
    await page.fill('[data-ctx=prog][data-f="title.ar"]', 'صدقة جارية');
    await page.fill('[data-ctx=prog][data-f="title.en"]', 'Sadaqah Jariyah');
    await page.fill('[data-chipin="prog:presets"]', '30'); await page.press('[data-chipin="prog:presets"]', 'Enter');
    await page.fill('[data-chipin="prog:presets"]', '75'); await page.click('[data-act=chip-add]');
    ok((await page.$$('[data-chips="prog:presets"] .chip')).length === 2, 'preset chips added (2)');
    await page.click('[data-act=create]'); await saved();
    await page.click('[data-act=close-editor] >> nth=-1'); await page.waitForSelector('#drawer', { state: 'hidden' });
    ok(await page.$('.pcard[data-id=sadaqah-jariyah]') !== null, 'second program created');

    /* ---------- كتالوج بعنصرين، على الرئيسية بحجم كبير ---------- */
    console.log('== create catalog');
    await tab('catalogs');
    await page.click('[data-act=new-cat] >> nth=0');
    await page.fill('[data-ctx=cat][data-f="title.ar"]', 'حملة الشتاء');
    await page.fill('[data-ctx=cat][data-f="title.en"]', 'Winter Campaign');
    await page.fill('[data-ctx=cat][data-f="subtitle.ar"]', 'ادعم المحتاجين');
    await page.selectOption('#itemAdd', 'winter-clothes'); await page.click('[data-act=item-add]');
    await page.selectOption('#itemAdd', 'sadaqah-jariyah'); await page.click('[data-act=item-add]');
    ok((await page.$$('[data-dnd-list=items] .row')).length === 2, 'catalog has 2 items');
    await page.click('[data-act=size][data-list=items][data-i="0"][data-v=large]');
    await page.check('[data-place=home]');
    await page.click('[data-act=pl-size][data-key=home][data-v=large]');
    ok((await rowsOf('.pv-box:has(.pv-banner)')).length >= 1, 'catalog preview renders');
    await shot('11-catalog-editor-desktop', { fullPage: false });
    await page.click('[data-act=create]'); await saved();
    await page.click('[data-act=close-editor] >> nth=-1'); await page.waitForSelector('#drawer', { state: 'hidden' });
    await shot('04-catalogs-desktop');

    /* ---------- الرئيسية: تركيب وترتيب وأحجام ---------- */
    console.log('== home layout');
    await tab('home');
    // نفرّغ الرئيسية ثم نبني ترتيباً معروفاً
    while (await page.$('[data-dnd-list=home] .row')) await page.click('[data-dnd-list=home] [data-act=remove-entry] >> nth=0');
    ok(await page.$('.empty') !== null, 'empty-state when home empty');
    for (const id of ['program:water', 'program:iftar', 'program:meal', 'program:quran', 'program:kaffarat', 'catalog:winter-campaign']) {
      await page.selectOption('#homeAdd', id); await page.click('[data-act=home-add]');
    }
    const setSize = (i, s) => page.click(`[data-act=size][data-list=home][data-i="${i}"][data-v=${s}]`);
    await setSize(0, 'medium'); await setSize(1, 'medium'); await setSize(2, 'small'); await setSize(3, 'small'); await setSize(4, 'small'); await setSize(5, 'large');
    eq(await rowsOf(), [['medium', 'medium'], ['small', 'small', 'small'], ['large']], 'packing 3+3 | 2+2+2 | 6');
    // إعادة الترتيب بالأزرار: انقل الكتالوج (الأخير) إلى الأول
    for (let i = 5; i > 0; i--) await page.click(`[data-act=move][data-list=home][data-i="${i}"][data-d="-1"]`);
    eq(await rowsOf(), [['large'], ['medium', 'medium'], ['small', 'small', 'small']], 'after moving catalog first: 6 | 3+3 | 2+2+2');
    const first = await page.$eval('[data-dnd-list=home] .row', (r) => r.dataset.key);
    eq(first, 'catalog:winter-campaign', 'first row is the catalog');
    // حالة أخرى: small + medium + small -> 2+3 | 2
    await setSize(1, 'small'); await setSize(2, 'medium'); await setSize(3, 'small');
    await page.click('[data-act=size][data-list=home][data-i="0"][data-v=small]');
    // الترتيب الحالي: cat small, water small, iftar medium, meal small ... 2+2+... => [2,2] 2+3=... تحقق عام فقط
    const rowsMix = await rowsOf();
    const caps = rowsMix.map((r) => r.reduce((a, s) => a + { small: 2, medium: 3, large: 6 }[s], 0));
    ok(caps.every((c) => c <= 6), `no row exceeds 6 units (${JSON.stringify(rowsMix)})`);
    // رجّع الأحجام لحالة معروفة للقطات
    await setSize(0, 'large'); await setSize(1, 'medium'); await setSize(2, 'medium'); await setSize(3, 'small'); await setSize(4, 'small'); await setSize(5, 'small');
    eq(await rowsOf(), [['large'], ['medium', 'medium'], ['small', 'small', 'small']], 'final home packing');
    // السحب والإفلات (محاكاة) — نقل الصف 4 إلى الأول
    const keyAt = (i) => page.$eval(`[data-dnd-list=home] .row[data-i="${i}"]`, (r) => r.dataset.key);
    const k4 = await keyAt(4);
    await page.dragAndDrop('[data-dnd-list=home] .row[data-i="4"] .thumb', '[data-dnd-list=home] .row[data-i="1"] .thumb');
    eq(await keyAt(1), k4, 'drag & drop moved row 4 to position 1');
    // لغة المعاينة
    await page.click('[data-act=pv-lang][data-v=en]');
    eq(await page.$eval('.phone', (p) => p.getAttribute('dir')), 'ltr', 'preview dir=ltr for English');
    await page.click('[data-act=pv-lang][data-v=ur]');
    eq(await page.$eval('.phone', (p) => p.getAttribute('dir')), 'rtl', 'preview dir=rtl for Urdu');
    await page.click('[data-act=pv-lang][data-v=ar]');
    // قيد تحذير "مخفي في كل مكان"
    ok(await page.$('.warnbox .chip-act') !== null, '"hidden everywhere" warning chips shown');
    /* ---------- الأكثر رواجاً ---------- */
    console.log('== featured');
    ok((await page.$('.pv-feat')) !== null, 'featured slide shown in preview (seed has it enabled)');
    while (await page.$('[data-dnd-list=feat] .row')) await page.click('[data-dnd-list=feat] [data-act=remove-entry] >> nth=0');
    for (const l of ['ar', 'fr', 'en', 'ur']) await page.fill(`[data-ctx=feat][data-f="title.${l}"]`, '');
    ok((await page.textContent('[data-region=featWarn]')).includes('بلا عناصر'), 'warning when enabled but empty');
    ok((await page.$('.pv-feat')) === null, 'featured hidden in preview when empty');
    await page.click('.switch:has([data-ctx=feat][data-f=enabled])');
    ok((await page.textContent('[data-region=featWarn]')) === '', 'no warning when disabled');
    await page.click('.switch:has([data-ctx=feat][data-f=enabled])');
    for (const id of ['program:water', 'program:iftar']) { await page.selectOption('#featAdd', id); await page.click('[data-act=feat-add]'); }
    ok((await page.$$('[data-dnd-list=feat] .row')).length === 2, 'two featured items added');
    await page.click('[data-dnd-list=feat] [data-act=move][data-i="1"][data-d="-1"]');
    eq(await page.$$eval('[data-dnd-list=feat] .row', (r) => r.map((x) => x.dataset.key)), ['program:iftar', 'program:water'], 'featured reorder via buttons');
    await page.fill('[data-ctx=feat][data-f=intervalSeconds]', '1');
    ok((await page.textContent('[data-err=intervalSeconds]')).length > 0, 'inline error for interval 1');
    await page.fill('[data-ctx=feat][data-f=intervalSeconds]', '7');
    await page.fill('[data-ctx=feat][data-f="title.ar"]', 'الأكثر طلباً');
    ok((await page.textContent('.pv-fbadge')).includes('الأكثر طلباً'), 'preview badge uses custom title');
    ok((await page.textContent('.pv-ftxt h4')).includes('إفطار'), 'preview shows first featured item');
    eq(await page.$$eval('.pv-dots button', (b) => b.length), 2, 'two dots');
    await page.click('.pv-dots button >> nth=1');
    ok((await page.textContent('.pv-ftxt h4')).includes('سقيا'), 'dot click cycles to 2nd slide');
    await page.click('[data-act=feat-step][data-d="1"]');
    ok((await page.textContent('.pv-ftxt h4')).includes('إفطار'), 'next button wraps to first slide');
    await page.click('[data-act=pv-lang][data-v=en]');
    ok((await page.textContent('.pv-fbadge')).trim() === 'Most popular', 'badge falls to default text in English');
    await page.click('[data-act=pv-lang][data-v=ar]');
    await saved();
    await shot('06-home-featured-desktop');
    await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(200); await shot('06-home-featured-phone'); await page.setViewportSize({ width: 1440, height: 900 });
    await saved();
    await shot('01-home-desktop');

    /* ---------- الإعدادات ---------- */
    console.log('== settings');
    await tab('settings');
    await page.fill('[data-ctx=set][data-f=idleSeconds]', '90');
    await page.fill('[data-ctx=set][data-f=warnSeconds]', '20');
    await page.fill('[data-chipin="set:quickAmounts"]', '25'); await page.click('[data-act=chip-add]');
    await page.fill('[data-ctx=set][data-f="homeTitle.en"]', 'Give with joy');
    await saved();
    // رفع صورة كبيرة لتجربة التصغير
    const big = await page.evaluate(async () => {
      const cv = document.createElement('canvas'); cv.width = 3200; cv.height = 2000; const g = cv.getContext('2d');
      const gr = g.createLinearGradient(0, 0, 3200, 2000); gr.addColorStop(0, '#00A092'); gr.addColorStop(1, '#1F4A47'); g.fillStyle = gr; g.fillRect(0, 0, 3200, 2000);
      const blob = await new Promise((r) => cv.toBlob(r, 'image/png'));
      await handleFile('welcome', new File([blob], 'huge.png', { type: 'image/png' }));
      const url = C().settings.welcomeBackground; const im = new Image(); im.src = url; await im.decode();
      return { url, w: im.naturalWidth, h: im.naturalHeight };
    });
    ok(/^\/uploads\/.*\.jpg$/.test(big.url) && Math.max(big.w, big.h) === 1600, `big image downscaled to 1600 JPEG (${big.url} ${big.w}x${big.h})`);
    // خطأ نوع الملف
    await page.evaluate(() => handleFile('welcome', new File(['x'], 'a.gif', { type: 'image/gif' })));
    ok((await page.textContent('.imgp-err')).includes('غير مدعوم'), 'unsupported file type error');
    await saved();
    await page.fill('[data-ctx=set][data-f=idleSeconds]', '5');
    ok((await page.textContent('[data-err=idleSeconds]')).length > 0, 'inline error on idleSeconds out of range');
    await page.fill('[data-ctx=set][data-f=idleSeconds]', '90');
    await saved();
    await shot('03-settings-desktop');

    /* ---------- النشر ---------- */
    console.log('== publish');
    await tab('programs'); await shot('02-programs-desktop');
    await tab('publish');
    await page.waitForSelector('[data-region=history] .btnrow');
    await page.waitForFunction(() => document.querySelector('[data-region=diff]').textContent.includes('كسوة الشتاء'));
    const diffTxt = await page.textContent('[data-region=diff]');
    ok(diffTxt.includes('إضافة برنامج «كسوة الشتاء»') && diffTxt.includes('إضافة كتالوج «حملة الشتاء»') && diffTxt.includes('مهلة الخمول'), 'diff summary lists added program/catalog/settings change');
    ok((await page.textContent('#pill')).includes('مسودة محفوظة'), 'pill = مسودة محفوظة before publish');
    await shot('05-publish-desktop');
    await page.click('[data-act=publish]'); await confirmYes();
    await page.waitForFunction(() => state.hasUnpublished === false && !ui.pubBusy);
    ok((await page.textContent('#pill')).includes('منشور'), 'pill = منشور after publish');
    const live = await getJson(BASE + '/api/catalog');
    const v = normalize(live);
    ok(v.errors.length === 0, 'published JSON passes normalize() with 0 errors');
    const wc = live.programs.find((p) => p.id === 'winter-clothes');
    ok(wc && wc.kind === 'fixed' && wc.price === 15 && wc.allowQuantity === true && wc.maxQuantity === 20 && /^\/uploads\//.test(wc.image), 'published fixed program has price 15 + quantity + image');
    const wcat = live.catalogs.find((c) => c.id === 'winter-campaign');
    ok(wcat && wcat.items.length === 2 && wcat.items[0].size === 'large' && wcat.subtitle.ar === 'ادعم المحتاجين', 'published catalog has 2 items (first large) + subtitle');
    ok(live.home[0].type === 'catalog' && live.home[0].id === 'winter-campaign' && live.home[0].size === 'large', 'catalog first on home, large');
    ok(live.home.length === 6, 'home has 6 entries');
    ok(live.settings.idleSeconds === 90 && live.settings.warnSeconds === 20 && live.settings.quickAmounts.includes(25) && live.settings.homeTitle.en === 'Give with joy' && /\.jpg$/.test(live.settings.welcomeBackground), 'published settings reflect edits');
    ok(live.featured && live.featured.enabled === true && live.featured.intervalSeconds === 7 && live.featured.title.ar === 'الأكثر طلباً', 'published featured: enabled, interval 7, badge');
    eq(live.featured.items, [{ type: 'program', id: 'iftar' }, { type: 'program', id: 'water' }], 'published featured items in order');
    await page.waitForSelector('[data-region=history] .hist', { timeout: 8000 });
    ok((await page.$$('[data-region=history] .hist')).length >= 1, 'backup history listed after publish');
    await shot('05-publish-desktop-after');

    /* ---------- استرجاع نسخة ---------- */
    console.log('== restore');
    await page.click('[data-act=restore] >> nth=0'); await confirmYes();
    await page.waitForFunction(() => !state.catalog.programs.some((p) => p.id === 'winter-clothes'), null, { timeout: 8000 });
    ok(true, 'restore loads backup into draft (new program gone)');
    ok((await page.textContent('#pill')).includes('مسودة محفوظة'), 'after restore: draft differs from live');
    const tk = await page.evaluate(() => sessionStorage.getItem('hd_token'));
    const draft = await getJson(BASE + '/api/admin/catalog', { Authorization: 'Bearer ' + tk });
    ok(!draft.catalog.programs.some((p) => p.id === 'winter-clothes') && draft.hasUnpublished === true, 'server draft restored (hasUnpublished true)');

    /* ---------- تصدير/استيراد ---------- */
    console.log('== export / import');
    const [dl] = await Promise.all([page.waitForEvent('download'), page.click('[data-act=export]')]);
    const exp = JSON.parse(fs.readFileSync(await dl.path(), 'utf8'));
    ok(normalize(exp).errors.length === 0 && /\.json$/.test(dl.suggestedFilename()), 'exported JSON valid');
    exp.programs[0].title.ar = 'مستورد';
    const f = path.join(DATA, 'imp.json'); fs.writeFileSync(f, JSON.stringify(exp));
    await page.setInputFiles('#importFile', f); await confirmYes(); await page.waitForFunction(() => C().programs[0].title.ar === 'مستورد' && !state.dirty && !state.saving);
    ok((await getJson(BASE + '/api/admin/catalog', { Authorization: 'Bearer ' + tk })).catalog.programs[0].title.ar === 'مستورد', 'import goes through save() and persists');
    fs.writeFileSync(f, '{"hello":1}');
    await page.setInputFiles('#importFile', f);
    await page.waitForSelector('.errpanel');
    ok((await page.textContent('.errpanel')).includes('لا يشبه'), 'import of wrong shape rejected with message');
    await page.click('[data-act=dismiss-err]');

    /* ---------- أخطاء 422 وتحقق العميل ---------- */
    console.log('== errors');
    await tab('programs');
    await page.click('.pcard[data-id=meal] [data-act=edit-prog] >> nth=-1');
    await page.click('label.rcard:has(input[value=fixed])');
    await page.waitForSelector('[data-ctx=prog][data-f=price]');
    await page.fill('[data-ctx=prog][data-f=price]', '0');
    await page.waitForSelector('.errpanel');
    ok((await page.textContent('.errpanel')).includes('القيمة الثابتة'), 'client-side block: error panel lists fixed price rule');
    ok((await page.textContent('#saveInd')).includes('تعذّر الحفظ'), 'save indicator = تعذّر الحفظ');
    const draft2 = await getJson(BASE + '/api/admin/catalog', { Authorization: 'Bearer ' + tk });
    ok(draft2.catalog.programs.find((p) => p.id === 'meal').kind !== 'fixed', 'invalid edit not sent to server');
    // beforeunload نشط أثناء الفشل
    ok(await page.evaluate(() => state.dirty && state.saveStatus === 'failed'), 'unsaved edits retained locally');
    await page.fill('[data-ctx=prog][data-f=price]', '12'); await saved();
    ok((await page.$('.errpanel')) === null, 'error panel cleared after fix');
    // 422 من الخادم (نعترض الطلب)
    await page.route('**/api/admin/catalog', (r) => (r.request().method() === 'PUT' ? r.fulfill({ status: 422, contentType: 'application/json', body: JSON.stringify({ error: 'بيانات غير صالحة', errors: ['البرنامج meal: خطأ تجريبي من الخادم'] }) }) : r.continue()));
    await page.fill('[data-ctx=prog][data-f=price]', '13');
    await page.waitForSelector('.errpanel');
    ok((await page.textContent('.errpanel')).includes('خطأ تجريبي من الخادم'), 'server 422 errors shown in dismissible panel');
    ok(await page.evaluate(() => C().programs.find((p) => p.id === 'meal').price === 13), 'local edits kept after 422');
    await page.click('[data-act=dismiss-err]'); ok((await page.$('.errpanel')) === null, 'panel dismissible');
    await page.unroute('**/api/admin/catalog');
    await page.fill('[data-ctx=prog][data-f=price]', '14'); await saved();
    await page.click('[data-act=close-editor] >> nth=-1');

    /* ---------- XSS ---------- */
    console.log('== xss');
    await page.click('.pcard[data-id=meal] [data-act=edit-prog] >> nth=-1');
    await page.fill('[data-ctx=prog][data-f="title.ar"]', '<img src=x onerror="window.__xss=1">"><script>window.__xss=2</script>');
    await saved();
    await page.click('[data-act=close-editor] >> nth=-1'); await page.waitForSelector('#drawer', { state: 'hidden' });
    await tab('home'); await tab('programs'); await tab('publish'); await tab('home');
    ok(!(await page.evaluate(() => window.__xss)), 'titles with HTML/script are escaped (no XSS)');
    ok((await page.textContent('body')).includes('<img src=x'), 'malicious title shown as plain text');
    // نعيد العنوان
    await tab('programs'); await page.click('.pcard[data-id=meal] [data-act=edit-prog] >> nth=-1');
    await page.fill('[data-ctx=prog][data-f="title.ar"]', 'وجبة إطعام'); await saved(); await page.click('[data-act=close-editor] >> nth=-1');

    /* ---------- حذف برنامج يزيل أماكنه ---------- */
    console.log('== delete program');
    await tab('home');
    const hadQuran = await page.evaluate(() => C().home.some((h) => h.id === 'quran'));
    await tab('programs'); await page.click('.pcard[data-id=quran] [data-act=edit-prog] >> nth=-1');
    await page.check('[data-feat-place]');
    ok(await page.evaluate(() => C().featured.items.some((x) => x.id === 'quran')), 'program editor checkbox adds to featured');
    await page.click('[data-act=del]'); await confirmYes(); await page.waitForFunction(() => !C().programs.some((p) => p.id === 'quran') && !state.dirty && !state.saving);
    ok(await page.evaluate(() => !C().featured.items.some((x) => x.id === 'quran')), 'deleting a program removes it from featured.items');
    ok(await page.evaluate(() => !C().home.some((h) => h.id === 'quran') && !C().catalogs.some((c) => c.items.some((i) => i.programId === 'quran'))), `deleting program removes placements (was on home: ${hadQuran})`);

    /* ---------- لقطات الهاتف + الوضع الداكن ---------- */
    console.log('== screenshots');
    await page.setViewportSize({ width: 390, height: 844 });
    for (const [k, n] of [['home', '1-home'], ['programs', '2-programs'], ['catalogs', '4-catalogs'], ['settings', '3-settings'], ['publish', '5-publish']]) { await tab(k); await page.waitForTimeout(250); await shot(`phone-${n}`); }
    await tab('programs'); await page.click('.pcard >> nth=0 >> [data-act=edit-prog] >> nth=-1'); await page.waitForTimeout(400); await shot('phone-6-editor', { fullPage: false });
    await page.evaluate(() => { document.getElementById('drawerBody').scrollTop = 900; }); await page.waitForTimeout(100); await shot('phone-7-editor-scrolled', { fullPage: false });
    await page.click('[data-act=close-editor] >> nth=-1');
    ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'no horizontal overflow at 390px');
    await page.setViewportSize({ width: 360, height: 740 });
    for (const k of ['home', 'programs', 'catalogs', 'settings', 'publish']) { await tab(k); ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), `no horizontal overflow at 360px (${k})`); }
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.emulateMedia({ colorScheme: 'dark' });
    for (const [k, n] of [['home', '1-home'], ['programs', '2-programs'], ['publish', '5-publish']]) { await tab(k); await page.waitForTimeout(200); await shot(`dark-${n}`); }
    await page.emulateMedia({ colorScheme: 'light' });

    /* ---------- منصّة الإدارة: نظرة عامة، وسائط، تدقيق، أجهزة المعاينة، المحرر المباشر، الأدوار ---------- */
    console.log('== platform: overview / media / audit / devices / live editor / roles');
    // إحصائية تجريبية من «كيوسك» لتظهر في النظرة العامة
    await fetch(BASE + '/api/events', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'session_start', deviceId: 'e2e-kiosk', appVersion: '9.9.9' }) });
    await fetch(BASE + '/api/events', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'payment_completed', programId: 'zakat', durationMs: 12000, deviceId: 'e2e-kiosk' }) });
    await tab('overview');
    await page.waitForFunction(() => ui.stats && document.querySelector('[data-region=ovStats]').textContent.includes('محاكاة مكتملة'), null, { timeout: 8000 });
    ok((await page.textContent('[data-region=ovStats]')).includes('بيانات تجريبية'), 'overview stats labelled as demo data');
    ok((await page.textContent('[data-region=ovDevices]')).includes('e2e-kiosk') && (await page.textContent('[data-region=ovDevices]')).includes('9.9.9'), 'overview lists kiosk device with version');
    ok((await page.$$('[data-region=ovCards] .stat')).length === 6, 'overview shows 6 summary cards');
    ok((await page.textContent('[data-region=ovTr]')).includes('العربية'), 'translations table rendered');
    await shot('08-overview');
    await tab('media');
    await page.waitForSelector('.mcard');
    const nMedia = await page.$$eval('.mcard', (a) => a.length);
    ok(nMedia >= 8, `media library lists uploads (${nMedia})`);
    ok((await page.$$('.mcard .badge.kind')).length >= 1, 'media shows usage badges');
    ok(await page.$$eval('.mcard .badge.kind', (a) => a.length) > 0 && (await page.$$('[data-act=media-del][disabled]')).length > 0, 'used images cannot be deleted');
    const delBtn = await page.$('[data-act=media-del]:not([disabled])');
    if (delBtn) { const before = nMedia; await delBtn.click(); await confirmYes(); await page.waitForFunction((n) => document.querySelectorAll('.mcard').length < n, before, { timeout: 8000 }); ok(true, 'unused image deleted from library'); }
    await shot('09-media');
    await tab('publish');
    await page.waitForSelector('[data-region=audit] .ak', { timeout: 8000 });
    const auditTxt = await page.textContent('[data-region=audit]');
    ok(auditTxt.includes('نشر') && auditTxt.includes('رفع صورة') && auditTxt.includes('دخول'), 'audit log shows publish, upload, login');
    // أجهزة المعاينة + المحرر المباشر
    await tab('home');
    for (const d of ['tablet', 'kiosk', 'landscape', 'mobile']) { await page.click(`[data-act=pv-dev][data-v=${d}]`); ok(await page.$eval('.phone', (e, k) => e.classList.contains('dev-' + k), d), `preview device: ${d}`); }
    await page.click('#pvHomeGrid [data-tile]');
    await page.waitForSelector('#drawer.open');
    ok((await page.$eval('#drawerTitle', (e) => e.textContent)).includes('تعديل'), 'clicking a preview tile opens its editor (live editor)');
    await page.click('#drawer [data-act=close-editor]'); await page.waitForFunction(() => !ui.edit);
    // الأدوار: مشاهد = قراءة فقط
    await page.click('[data-act=logout]');
    await page.waitForSelector('#loginPw');
    await page.fill('#loginPw', 'e2e-viewer'); await page.click('#loginBtn');
    await page.waitForSelector('#app:not([hidden])');
    await page.waitForFunction(() => document.body.dataset.role === 'viewer');
    ok(await page.isHidden('#btnPublish'), 'viewer: publish button hidden');
    await tab('programs');
    ok(await page.$$eval('[data-act=new-prog]', (a) => a.every((b) => b.disabled)), 'viewer: cannot create programs');
    await page.click('[data-act=edit-prog] >> nth=0'); await page.waitForSelector('#drawer.open');
    ok(await page.$$eval('#drawerBody input[data-ctx]', (a) => a.length > 0 && a.every((i) => i.disabled)), 'viewer: editor fields are read-only');
    await page.click('#drawer [data-act=close-editor]');
    await page.waitForFunction(() => !ui.edit);
    await page.click('[data-act=logout]'); await page.waitForSelector('#loginPw');
    await page.fill('#loginPw', 'e2e-editor'); await page.click('#loginBtn');
    await page.waitForFunction(() => document.body.dataset.role === 'editor');
    await tab('settings');
    await page.waitForSelector('#view .rolebar');
    ok(await page.$$eval('#view input', (a) => a.length > 0 && a.every((i) => i.disabled)), 'editor: general settings locked');
    ok(await page.isHidden('#btnPublish'), 'editor: publish hidden');

    /* ---------- الهوية البصرية ---------- */
    console.log('== theme manager');
    await page.click('[data-act=logout]'); await page.waitForSelector('#loginPw');
    await page.fill('#loginPw', PASS); await page.click('#loginBtn');
    await page.waitForFunction(() => document.body.dataset.role === 'super');
    await tab('settings');
    await page.waitForSelector('#thPrimary');
    await page.$eval('#thPrimary', (el) => { el.value = '#C0392B'; el.dispatchEvent(new Event('input', { bubbles: true })); });
    await page.click('[data-act=theme-radius][data-v=round]');
    await saved();
    eq(await page.evaluate(() => C().settings.theme), { primary: '#C0392B', ink: '#1F4A47', radius: 'round' }, 'theme edited in draft');
    await page.locator('[data-region=themeCard]').screenshot({ path: path.join(SHOTS, '10-theme.png') });
    await page.$eval('#thPrimary', (el) => { el.value = '#FFEEAA'; el.dispatchEvent(new Event('input', { bubbles: true })); });
    await page.waitForFunction(() => document.querySelector('#themeInfo .badc'));
    ok((await page.textContent('#themeInfo')).includes('لن تُحفظ'), 'low-contrast primary is flagged and blocked');
    await page.click('[data-act=theme-reset]'); await saved();
    eq(await page.evaluate(() => C().settings.theme), { primary: '#00A092', ink: '#1F4A47', radius: 'normal' }, 'theme reset to defaults');

    ok(jsErrors.length === 0, 'no JS console/page errors' + (jsErrors.length ? ': ' + jsErrors.join(' | ') : ''));
  } catch (e) {
    fail++; console.log('  ✗ EXCEPTION:', e.stack || e);
    try { await page.screenshot({ path: path.join(SHOTS, 'failure.png'), fullPage: true }); } catch (x) { /* */ }
  } finally {
    await browser.close(); srv.kill();
    console.log(`\nRESULT: ${pass} passed, ${fail} failed   (shots: ${SHOTS})`);
    process.exit(fail ? 1 : 0);
  }
}
main();
