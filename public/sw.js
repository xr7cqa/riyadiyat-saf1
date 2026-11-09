// Service worker: the whole app (lessons + audio) is precached for offline play.
// - Cache-first: pages and files open instantly from the saved copy; a new version is looked for in the background.
// - Atomic update: a new version becomes active (and the old copy is deleted) only after EVERY file is in the new cache.
//   If one file fails, the install fails, the partial cache is thrown away, the old version keeps working,
//   and the browser tries again on the next visit.
const VERSION = '__VERSION__';
const ASSETS = __ASSETS__;
const CACHE = 'riyadiyat-' + VERSION;
const MARK = '__complete__';
const abs = (a) => new URL(a, self.registration.scope).href;

async function fetchOne(a) {
  let last;
  for (let i = 0; i < 3; i++) {
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 45000);
    try {
      const r = await fetch(a, { cache: 'reload', signal: ctl.signal });
      if (r.ok && r.status === 200) { const b = await r.blob(); clearTimeout(t); return new Response(b, { headers: r.headers }); }
      last = new Error(a + ' ' + r.status);
    } catch (err) { last = err; }
    clearTimeout(t);
    await new Promise((ok) => setTimeout(ok, 500 * (i + 1)));
  }
  throw last || new Error('failed ' + a);
}

async function isComplete(c) {
  if (!(await c.match(abs(MARK)))) return false;
  for (const a of ASSETS) if (!(await c.match(abs(a)))) return false;
  return true;
}

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    if (await isComplete(c)) { await self.skipWaiting(); return; }
    try {
      for (const a of ASSETS) if (!(await c.match(abs(a)))) await c.put(abs(a), await fetchOne(a));
      await c.put(abs('asset-list.json'), new Response(JSON.stringify({ version: VERSION, assets: ASSETS }), { headers: { 'content-type': 'application/json' } }));
      // verify every single file before declaring the version complete
      for (const a of ASSETS) if (!(await c.match(abs(a)))) throw new Error('missing ' + a);
      await c.put(abs(MARK), new Response(JSON.stringify({ version: VERSION, total: ASSETS.length, at: Date.now() })));
    } catch (err) {
      await caches.delete(CACHE);   // discard the partial copy; the old version stays active
      throw err;                     // install fails -> retried on the next visit
    }
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const mine = await caches.open(CACHE);
    if (await isComplete(mine)) for (const k of await caches.keys()) if (k.startsWith('riyadiyat-') && k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('message', (e) => { if (e.data === 'update') self.registration.update().catch(() => { }); });

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  const url = req.url.split('#')[0].split('?')[0];
  if (url.endsWith('/sw.js')) return;
  e.respondWith((async () => {
    const c = await caches.open(CACHE);
    if (req.mode === 'navigate') {
      const hit = (await c.match(abs('index.html'))) || (await c.match(abs('./')));
      if (hit) {
        // instant open from the saved copy; look for a new version in the background (never blocks the page)
        e.waitUntil(self.registration.update().catch(() => { }));
        return hit;
      }
      try { return await fetch(req); } catch (err) { return (await caches.match(abs('index.html'))) || Response.error(); }
    }
    const hit = await c.match(url);
    if (hit) return hit;
    try { return await fetch(req); } catch (err) { return (await caches.match(url)) || Response.error(); }
  })());
});
