'use strict';
// التحقق من catalog.json وتطبيعه. يعيد { catalog, errors, warnings }.

const LANGS = ['ar', 'fr', 'en', 'ur'];
const SIZES = ['small', 'medium', 'large'];
const KINDS = ['open', 'presets', 'fixed'];
const ALIGNS = ['center', 'top', 'bottom'];
const ID_RE = /^[a-z0-9][a-z0-9_-]{0,39}$/;

const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
const str = (v, max = 300) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const int = (v, min, max, def) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def;
};

function loc(v) {
  const o = {};
  for (const l of LANGS) o[l] = isObj(v) ? str(v[l]) : '';
  return o;
}

function image(v) {
  const s = str(v, 2000);
  if (!s) return '';
  if (/^(\/uploads\/[\w.\-]+|asset:[\w./\-]+|https?:\/\/\S+)$/.test(s)) return s;
  return '';
}

function normalize(input) {
  const errors = [];
  const warnings = [];
  const src = isObj(input) ? input : {};
  const st = isObj(src.settings) ? src.settings : {};

  const settings = {
    idleSeconds: int(st.idleSeconds, 10, 600, 60),
    warnSeconds: int(st.warnSeconds, 5, 120, 15),
    maxAmount: int(st.maxAmount, 1, 9999999, 99999),
    quickAmounts: [],
    welcomeBackground: image(st.welcomeBackground),
    homeTitle: loc(st.homeTitle),
    homeSubtitle: loc(st.homeSubtitle),
  };
  const qa = Array.isArray(st.quickAmounts) ? st.quickAmounts : [];
  settings.quickAmounts = [...new Set(qa.map((n) => int(n, 1, settings.maxAmount, 0)).filter((n) => n > 0))].slice(0, 8);
  if (!settings.quickAmounts.length) {
    settings.quickAmounts = [10, 50, 100, 200];
    warnings.push('المبالغ السريعة فارغة — استُخدمت الافتراضية');
  }

  const ids = new Set();
  const programs = [];
  for (const p of Array.isArray(src.programs) ? src.programs : []) {
    if (!isObj(p)) continue;
    const id = str(p.id, 40);
    const title = loc(p.title);
    const name = title.ar || id;
    if (!ID_RE.test(id)) { errors.push(`برنامج بمعرّف غير صالح: "${id}"`); continue; }
    if (ids.has('p:' + id)) { errors.push(`معرّف برنامج مكرر: ${id}`); continue; }
    ids.add('p:' + id);
    if (!title.ar) errors.push(`البرنامج ${id}: العنوان العربي إلزامي`);
    const kind = KINDS.includes(p.kind) ? p.kind : 'open';
    const prog = {
      id,
      active: p.active !== false,
      title,
      image: image(p.image),
      imageAlign: ALIGNS.includes(p.imageAlign) ? p.imageAlign : 'center',
      kind,
      price: int(p.price, 0, 9999999, 0),
      presets: [...new Set((Array.isArray(p.presets) ? p.presets : []).map((n) => int(n, 1, 9999999, 0)).filter((n) => n > 0))].slice(0, 8),
      minAmount: int(p.minAmount, 1, 9999999, 1),
      maxAmount: int(p.maxAmount, 1, 9999999, settings.maxAmount),
      allowQuantity: kind === 'fixed' && p.allowQuantity === true,
      maxQuantity: int(p.maxQuantity, 1, 999, 99),
    };
    if (prog.maxAmount < prog.minAmount) errors.push(`البرنامج ${name}: الحد الأعلى أقل من الأدنى`);
    if (kind === 'fixed' && prog.price < 1) errors.push(`البرنامج ${name}: القيمة الثابتة يجب أن تكون 1 أو أكثر`);
    if (kind === 'presets' && !prog.presets.length) warnings.push(`البرنامج ${name}: بلا مبالغ محددة — ستُستخدم المبالغ السريعة العامة`);
    if (prog.active && !prog.image) warnings.push(`البرنامج ${name}: بلا صورة`);
    programs.push(prog);
  }
  const progIds = new Set(programs.map((p) => p.id));

  const catalogs = [];
  for (const c of Array.isArray(src.catalogs) ? src.catalogs : []) {
    if (!isObj(c)) continue;
    const id = str(c.id, 40);
    const title = loc(c.title);
    if (!ID_RE.test(id)) { errors.push(`كتالوج بمعرّف غير صالح: "${id}"`); continue; }
    if (ids.has('c:' + id)) { errors.push(`معرّف كتالوج مكرر: ${id}`); continue; }
    ids.add('c:' + id);
    if (!title.ar) errors.push(`الكتالوج ${id}: العنوان العربي إلزامي`);
    const items = [];
    const seen = new Set();
    for (const it of Array.isArray(c.items) ? c.items : []) {
      if (!isObj(it)) continue;
      const pid = str(it.programId, 40);
      if (!progIds.has(pid)) { warnings.push(`الكتالوج ${title.ar || id}: برنامج غير موجود (${pid}) أُزيل`); continue; }
      if (seen.has(pid)) continue;
      seen.add(pid);
      items.push({ programId: pid, size: SIZES.includes(it.size) ? it.size : 'medium' });
    }
    const active = c.active !== false;
    if (active && !items.length) warnings.push(`الكتالوج ${title.ar || id}: فارغ`);
    catalogs.push({
      id, active, title, subtitle: loc(c.subtitle), image: image(c.image),
      imageAlign: ALIGNS.includes(c.imageAlign) ? c.imageAlign : 'center', items,
    });
  }
  const catIds = new Set(catalogs.map((c) => c.id));

  const home = [];
  const seenHome = new Set();
  for (const h of Array.isArray(src.home) ? src.home : []) {
    if (!isObj(h)) continue;
    const type = h.type === 'catalog' ? 'catalog' : 'program';
    const id = str(h.id, 40);
    const ok = type === 'catalog' ? catIds.has(id) : progIds.has(id);
    if (!ok) { warnings.push(`عنصر في الرئيسية غير موجود (${type}:${id}) أُزيل`); continue; }
    if (seenHome.has(type + id)) continue;
    seenHome.add(type + id);
    home.push({ type, id, size: SIZES.includes(h.size) ? h.size : 'medium' });
  }

  return {
    catalog: {
      schemaVersion: 1,
      updatedAt: new Date().toISOString(),
      settings,
      programs,
      catalogs,
      home,
    },
    errors,
    warnings,
  };
}

module.exports = { normalize, LANGS, SIZES, KINDS };
