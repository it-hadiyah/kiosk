/* Demo backend: بديل لخادم الحقيقي يعمل داخل صفحة Artifact (بدون خادم).
 * يحفظ المسودة/المنشور/السجل/الصور في قاعدة بيانات الصفحة (capability: db).
 * لا يؤثر على أي كيوسك حقيقي — للتجربة والعرض فقط. */
(function () {
  'use strict';
  /* __VALIDATE__ */            // يُحقن: دالة normalize نفسها الموجودة في الخادم
  /* __SEED__ */                // يُحقن: const SEED, const EMBED
  const { normalize } = __validate;
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const PLACEHOLDER = 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="100%" height="100%" fill="#E6F4F2"/><text x="50%" y="50%" fill="#00A092" font-size="22" font-family="sans-serif" text-anchor="middle">app asset</text></svg>');
  const imageCache = new Map(); // '/uploads/demo-x.jpg' -> dataURL

  let dbp;
  async function db() {
    if (!dbp) dbp = (async () => {
      const d = await claude.use('db');
      if (!d) throw new Error('قاعدة بيانات الصفحة غير متاحة (سجّل الدخول لحساب claude.ai لفتح هذه النسخة التجريبية)');
      return d;
    })();
    return dbp;
  }
  const same = (a, b) => JSON.stringify({ ...a, updatedAt: 0 }) === JSON.stringify({ ...b, updatedAt: 0 });
  const getDoc = async (path) => { const s = await (await db()).doc(path).get(); return s.exists ? s.data() : null; };
  const setDoc = async (path, data) => (await db()).doc(path).set(data);

  async function ensureSeed() {
    const draft = await getDoc('catalog/draft');
    if (draft) return;
    const seeded = normalize(clone(SEED)).catalog;
    await setDoc('catalog/live', seeded);
    await setDoc('catalog/draft', seeded);
  }
  async function loadImages() {
    const snap = await (await db()).collection('images').get();
    for (const d of snap.docs) { const v = d.data(); if (v && v.url && v.data) imageCache.set(v.url, v.data); }
  }

  window.HD_BACKEND = {
    kind: 'demo',
    async login() { return true; },
    async logout() {},
    async load() {
      await ensureSeed();
      await loadImages();
      const draft = await getDoc('catalog/draft');
      const live = await getDoc('catalog/live');
      return { catalog: draft, hasUnpublished: !same(draft, live) };
    },
    async save(catalog) {
      const { catalog: n, errors, warnings } = normalize(clone(catalog));
      if (errors.length) { const e = new Error('بيانات غير صالحة'); e.errors = errors; e.warnings = warnings; throw e; }
      await setDoc('catalog/draft', n);
      const live = await getDoc('catalog/live');
      return { catalog: n, warnings, hasUnpublished: !same(n, live) };
    },
    async publish() {
      const draft = await getDoc('catalog/draft');
      const { catalog: n, errors, warnings } = normalize(clone(draft));
      if (errors.length) { const e = new Error('لا يمكن النشر'); e.errors = errors; throw e; }
      const prev = await getDoc('catalog/live');
      if (prev) {
        const id = new Date().toISOString().replace(/[:.]/g, '-');
        await setDoc('history/' + id, { at: new Date().toISOString(), catalog: prev });
        const all = await (await db()).collection('history').orderBy('at', 'desc').get();
        for (const d of all.docs.slice(30)) await (await db()).doc('history/' + d.id).delete();
      }
      await setDoc('catalog/live', n);
      await setDoc('catalog/draft', n);
      return { ok: true, warnings };
    },
    async history() {
      const snap = await (await db()).collection('history').orderBy('at', 'desc').limit(30).get();
      return snap.docs.map((d) => ({ id: d.id, at: d.data().at }));
    },
    async restore(id) {
      const h = await getDoc('history/' + id);
      if (!h) throw new Error('النسخة غير موجودة');
      const { catalog } = normalize(clone(h.catalog));
      await setDoc('catalog/draft', catalog);
      return { catalog };
    },
    async saveFile(filename, text) {
      const dl = await claude.use('downloads');
      if (!dl) throw new Error('التنزيل غير متاح');
      await dl.save({ filename, data: text });
    },
    async fetchLive() { return getDoc('catalog/live'); },
    /* يحوّل الصورة لـ JPEG مصغّر (≤ 900px) ويحفظها في db ويعيد مساراً شبيهاً بمسار الخادم */
    async upload(file) {
      const bmp = await createImageBitmap(file);
      const k = Math.min(1, 900 / Math.max(bmp.width, bmp.height));
      const c = document.createElement('canvas');
      c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
      c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
      let data = c.toDataURL('image/jpeg', 0.82);
      for (let q = 0.7; data.length > 230 * 1024 && q > 0.3; q -= 0.1) data = c.toDataURL('image/jpeg', q);
      if (data.length > 240 * 1024) throw new Error('الصورة كبيرة جداً للنسخة التجريبية');
      const id = Math.random().toString(16).slice(2, 10);
      const url = '/uploads/demo-' + id + '.jpg';
      await setDoc('images/' + id, { url, data });
      imageCache.set(url, data);
      return url;
    },
    resolveImage(url) {
      if (!url) return PLACEHOLDER;
      if (imageCache.has(url)) return imageCache.get(url);
      const m = /^\/uploads\/([\w\-]+)\.\w+$/.exec(url);
      if (m && EMBED[m[1]]) return EMBED[m[1]];
      if (/^https?:\/\//.test(url)) return url;
      return PLACEHOLDER;
    },
  };
})();
