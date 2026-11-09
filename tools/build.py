# Build: copy public/ -> dist/, write asset-list.json and inject version + precache list into sw.js
import os, shutil, hashlib, json
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC, DST = os.path.join(ROOT, 'public'), os.path.join(ROOT, 'dist')
shutil.rmtree(DST, ignore_errors=True); shutil.copytree(SRC, DST)
files = []
for d, _, fs in os.walk(DST):
    for f in fs:
        rel = os.path.relpath(os.path.join(d, f), DST).replace(os.sep, '/')
        if rel in ('sw.js', 'asset-list.json') or f.startswith('.'): continue
        files.append(rel)
order = lambda p: (0 if p in ('index.html', 'css/app.css', 'manifest.webmanifest') or p.startswith('js/') else 1 if p.startswith('icons/') else 2, p)
files.sort(key=order)
h = hashlib.sha256()
for f in files: h.update(f.encode()); h.update(open(os.path.join(DST, f), 'rb').read())
version = h.hexdigest()[:10]
assets = ['./'] + files
json.dump({'version': version, 'assets': assets}, open(os.path.join(DST, 'asset-list.json'), 'w'), ensure_ascii=False)
sw = open(os.path.join(DST, 'sw.js')).read().replace('__VERSION__', version).replace('__ASSETS__', json.dumps(assets))
open(os.path.join(DST, 'sw.js'), 'w').write(sw)
open(os.path.join(DST, '.nojekyll'), 'w').write('')
size = sum(os.path.getsize(os.path.join(DST, f)) for f in files)
print('version', version, 'files', len(files), 'bytes', size)
