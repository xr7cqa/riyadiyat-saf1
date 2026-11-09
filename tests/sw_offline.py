"""Service-worker + spacing tests (Playwright/Chromium).
1. title spacing: a word and an isolated number never touch (and the checker does catch a glued one)
2. atomic update: a new version with ONE failing file must not activate; the old cache stays complete and in use;
   once the file is reachable again the new version installs fully and only then replaces the old one
3. cache-first under a very slow network: the app opens from the saved copy at once
usage: python3 tests/sw_offline.py   (starts tests/two_version_server.py on dist, port 8932)"""
import asyncio, json, time, re
from playwright.async_api import async_playwright

URL = 'http://127.0.0.1:8932/'
import subprocess, os, urllib.request
SRV = subprocess.Popen(['python3', os.path.join(os.path.dirname(__file__), 'two_version_server.py'), os.path.join(os.path.dirname(__file__), '..', 'dist'), '8932'])
time.sleep(1.5)
def mode(v, fail=''): return urllib.request.urlopen(f'{URL}__mode?v={v}&fail={fail}').read()
R = {'checks': [], 'fail': []}
def check(name, ok, info=''):
    R['checks'].append((name, bool(ok), info)); print('PASS' if ok else 'FAIL', name, info, flush=True)
    if not ok: R['fail'].append(name)

STATE_JS = '''async () => {
  const keys = (await caches.keys()).filter(k => k.startsWith('riyadiyat-'));
  const out = {keys, ctl: !!navigator.serviceWorker.controller, caches: {}};
  for (const k of keys) { const c = await caches.open(k); const lr = await c.match(new URL('asset-list.json', location.href).href);
    const list = lr ? await lr.json() : {assets: []}; let have = 0; for (const a of list.assets) if (await c.match(new URL(a, location.href).href)) have++;
    out.caches[k] = {have, total: list.assets.length, mark: !!(await c.match(new URL('__complete__', location.href).href))}; }
  const reg = await navigator.serviceWorker.getRegistration();
  out.active = reg && reg.active ? reg.active.scriptURL : null; out.waiting = !!(reg && reg.waiting); out.installing = !!(reg && reg.installing);
  return out; }'''
GAP_JS = '''(sel) => { const out = []; for (const b of document.querySelectorAll(sel + ' bdi.num')) { const p = b.previousSibling; if (!p || p.nodeType !== 3 || !/\\S/.test(p.textContent)) continue;
  const r = document.createRange(); const L = p.textContent.replace(/\\s+$/, '').length; r.setStart(p, L - 1); r.setEnd(p, L); out.push(Math.round((r.getBoundingClientRect().left - b.getBoundingClientRect().right) * 10) / 10); } return out; }'''

async def main():
    async with async_playwright() as p:
        br = await p.chromium.launch()
        ctx = await br.new_context(viewport={'width': 360, 'height': 640}, has_touch=True, is_mobile=True, locale='ar', service_workers='allow')
        pg = await ctx.new_page()
        await pg.goto(URL)
        # ---- 1. title spacing (the real task-bar renderer from engine.js)
        await pg.evaluate("localStorage.clear()")
        res = await pg.evaluate('''async () => { const E = await import('./js/engine.js'); const F = await import('./js/fmt.js');
           const app = document.createElement('div'); document.body.appendChild(app);
           E.mountGame(app, {onHome(){}}); E.task(`كوِّنِ العددَ ${F.num(17)}`, [], {wait: false});
           await new Promise(r => setTimeout(r, 50)); return document.querySelector('.task-text').innerText; }''')
        gaps = await pg.evaluate(GAP_JS, '.task-text')
        check('title «كوّنِ العددَ ١٧»: visible space between word and number', gaps and min(gaps) >= 3, f'{res!r} gap={gaps}px')
        await pg.evaluate('''() => { const d = document.createElement('div'); d.id = 'neg'; d.style.display = 'flex'; d.innerHTML = 'كوِّنِ العددَ<bdi class="x" dir="ltr">١٧</bdi>'; document.body.appendChild(d); d.querySelector('bdi').className = 'num'; d.querySelector('bdi').style.margin = '0'; }''')
        neg = await pg.evaluate(GAP_JS, '#neg')
        check('control: the checker detects a glued title (old bug)', neg and max(neg) < 3, f'gap={neg}px')
        # ---- 2. install v1 completely
        await pg.goto(URL)
        await pg.wait_for_function("navigator.serviceWorker.controller !== null", timeout=60000)
        await pg.wait_for_function('''async () => { const k = (await caches.keys()).filter(k => k.startsWith('riyadiyat-')); if (k.length !== 1) return false;
            return !!(await (await caches.open(k[0])).match(new URL('__complete__', location.href).href)); }''', timeout=120000, polling=500)
        s1 = await pg.evaluate(STATE_JS); v1 = s1['keys'][0]
        check('v1 installed: one complete cache', s1['caches'][v1]['have'] == s1['caches'][v1]['total'] > 100 and s1['caches'][v1]['mark'], json.dumps(s1))
        # ---- 2b. a new version appears, but one file fails to download
        hits = {'bad': 'server 503'}
        mode(2, 'audio/l5_pair.mp3')
        upd = await pg.evaluate('''async () => { const reg = await navigator.serviceWorker.getRegistration(); try { await reg.update(); } catch (e) { return 'update threw ' + e; }
            const w = reg.installing; if (!w) return 'no installing worker';
            return await new Promise(r => { w.addEventListener('statechange', () => { if (w.state === 'redundant' || w.state === 'installed' || w.state === 'activated') r(w.state); }); setTimeout(() => r('timeout ' + w.state), 120000); }); }''')
        s2 = await pg.evaluate(STATE_JS)
        check('failing file: new version is rejected (install fails -> redundant)', upd == 'redundant', f'{upd} (audio/l5_pair.mp3 -> 503)')
        check('failing file: partial new cache discarded, old cache kept complete', s2['keys'] == [v1] and s2['caches'][v1]['have'] == s2['caches'][v1]['total'] and s2['caches'][v1]['mark'], json.dumps(s2))
        await pg.reload(); await pg.wait_for_function("document.body.dataset.screen", timeout=15000)
        ver = await pg.evaluate("fetch('asset-list.json').then(r => r.json()).then(j => j.version)")
        check('failing file: page keeps running the old version', ver == v1.replace('riyadiyat-', ''), ver)
        # parent status still says ready (from the complete old cache)
        st = await pg.evaluate("import('./js/pwa.js').then(m => m.offlineStatus())")
        check('«جاهز بدون نت» reflects the complete (old) cache', st['ready'] and st['have'] == st['total'], json.dumps(st))
        # ---- 2c. next visit: the file works again -> new version installs fully, then replaces the old one
        mode(2)
        upd2 = await pg.evaluate('''async () => { const reg = await navigator.serviceWorker.getRegistration(); await reg.update().catch(() => {});
            const w = reg.installing || reg.waiting; if (!w) return 'none';
            return await new Promise(r => { const f = () => { if (w.state === 'activated' || w.state === 'redundant') r(w.state); }; w.addEventListener('statechange', f); f(); setTimeout(() => r('timeout ' + w.state), 120000); }); }''')
        await pg.wait_for_timeout(1000)
        s3 = await pg.evaluate(STATE_JS)
        ok3 = s3['keys'] == ['riyadiyat-testv2'] and s3['caches']['riyadiyat-testv2']['have'] == s3['caches']['riyadiyat-testv2']['total'] and s3['caches']['riyadiyat-testv2']['mark']
        check('retry: complete new version activates and only then the old cache is deleted', upd2 == 'activated' and ok3, f'{upd2} {json.dumps(s3)}')
        # ---- 3. cache-first on a very slow network
        await pg.goto(URL); await pg.wait_for_function("navigator.serviceWorker.controller !== null", timeout=30000)
        cdp = await ctx.new_cdp_session(pg)
        await cdp.send('Network.enable')
        await cdp.send('Network.emulateNetworkConditions', {'offline': False, 'latency': 8000, 'downloadThroughput': 2000, 'uploadThroughput': 2000})
        t0 = time.time(); await pg.reload(wait_until='commit')
        await pg.locator('.lindex, .comp-card').first.wait_for(timeout=30000); dt = time.time() - t0
        check('very slow network (8 s latency, 2 KB/s): app opens from the saved copy at once', dt < 3.0, f'{dt:.2f}s')
        await cdp.send('Network.emulateNetworkConditions', {'offline': False, 'latency': 0, 'downloadThroughput': -1, 'uploadThroughput': -1})
        # control: without the service worker the same network takes far longer
        ctx2 = await br.new_context(viewport={'width': 360, 'height': 640}, service_workers='block'); pg2 = await ctx2.new_page()
        cdp2 = await ctx2.new_cdp_session(pg2); await cdp2.send('Network.enable')
        await cdp2.send('Network.emulateNetworkConditions', {'offline': False, 'latency': 8000, 'downloadThroughput': 2000, 'uploadThroughput': 2000})
        t0 = time.time()
        try: await pg2.goto(URL, wait_until='commit', timeout=60000); await pg2.locator('.lindex, .comp-card').first.wait_for(timeout=60000); dt2 = time.time() - t0
        except Exception: dt2 = 99
        check('control: same slow network without the saved copy is slow', dt2 > dt + 5, f'{dt2:.1f}s')
        await br.close()
    json.dump(R, open('/tmp/sw-test.json', 'w'), ensure_ascii=False, indent=1)
    SRV.kill()
    print(json.dumps({'checks': len(R['checks']), 'fail': R['fail']}, ensure_ascii=False))
asyncio.run(main())
