// Service worker: precache everything (lessons + audio) for offline play; new versions install by themselves.
const VERSION = '__VERSION__';
const ASSETS = __ASSETS__;
const CACHE = 'riyadiyat-' + VERSION;
self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    // shell first (fast first open), then the rest; retry each file so a weak connection still completes
    for (const a of ASSETS) {
      for (let i = 0; i < 3; i++) { try { const r = await fetch(a, { cache: 'reload' }); if (r.ok) { await c.put(new URL(a, self.registration.scope).href, r); break; } } catch (err) { } }
    }
    await self.skipWaiting();
  })());
});
self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith('riyadiyat-') && k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith((async () => {
    const c = await caches.open(CACHE);
    if (req.mode === 'navigate') {
      try { const r = await fetch(req); return r; } catch (err) { return (await c.match(new URL('index.html', self.registration.scope).href)) || Response.error(); }
    }
    const url = req.url.split('?')[0].split('#')[0];
    if (url.endsWith('/asset-list.json')) { try { return await fetch(req); } catch (err) { return (await c.match(url)) || Response.error(); } }
    const hit = await c.match(url);
    if (hit) return hit;
    try { const r = await fetch(req); if (r.ok) c.put(url, r.clone()); return r; } catch (err) { return Response.error(); }
  })());
});
