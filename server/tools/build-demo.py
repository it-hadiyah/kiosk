#!/usr/bin/env python3
"""يبني نسخة تجريبية بملف HTML واحد من لوحة التحكم (للنشر كـ Artifact):
  python3 server/tools/build-demo.py  ->  server/dist/admin-demo.html
يدمج: index.html + style.css + app.js + demo-backend.js + validate.js + البيانات التجريبية + صور مصغّرة."""
import base64, io, json, pathlib, re
from PIL import Image

root = pathlib.Path(__file__).resolve().parent.parent
admin = root / 'public/admin'
html = (admin / 'index.html').read_text(encoding='utf-8')
css = (admin / 'style.css').read_text(encoding='utf-8')
js = (admin / 'app.js').read_text(encoding='utf-8')
demo = (root / 'tools/demo-backend.js').read_text(encoding='utf-8')
validate = (root / 'validate.js').read_text(encoding='utf-8')
seed = json.loads((root / 'seed/catalog.json').read_text(encoding='utf-8'))

embed = {}
for f in sorted((root / 'seed/uploads').glob('*.jpg')):
    im = Image.open(f).convert('RGB')
    im.thumbnail((640, 640))
    buf = io.BytesIO(); im.save(buf, 'JPEG', quality=72, optimize=True)
    embed[f.stem] = 'data:image/jpeg;base64,' + base64.b64encode(buf.getvalue()).decode()

validate_wrapped = "const __validate = (function(){ const module = { exports: {} }; const exports = module.exports;\n" + validate + "\nreturn module.exports; })();"
seed_block = "const SEED = " + json.dumps(seed, ensure_ascii=False) + ";\nconst EMBED = " + json.dumps(embed) + ";"
demo = demo.replace('/* __VALIDATE__ */', validate_wrapped).replace('/* __SEED__ */', seed_block)

def inline(tag_re, repl_fn, text):
    return re.sub(tag_re, repl_fn, text, flags=re.S)

out = html
out = re.sub(r'<link[^>]+href="style\.css"[^>]*>', lambda m: '<style>\n' + css + '\n</style>', out)
scripts = '<script>\n' + demo + '\n</script>\n<script>\n' + js + '\n</script>'
if re.search(r'<script[^>]+src="app\.js"[^>]*></script>', out):
    out = re.sub(r'<script[^>]+src="app\.js"[^>]*></script>', lambda m: scripts.replace('\\', '\\\\') if False else scripts, out)
else:
    raise SystemExit('app.js script tag not found in index.html')
(root / 'dist').mkdir(exist_ok=True)
dest = root / 'dist/admin-demo.html'
dest.write_text(out, encoding='utf-8')
print('wrote', dest, round(dest.stat().st_size / 1024), 'KB')
