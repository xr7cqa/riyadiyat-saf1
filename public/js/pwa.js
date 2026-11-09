// Install / offline / auto-update
let reloadWanted = false;
export let canReloadNow = () => true;
export function setReloadGuard(fn) { canReloadNow = fn; }
export function registerSW() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('sw.js').then((reg) => {
    // look for a new version whenever we come back online or the app is reopened
    const check = () => reg.update().catch(() => { });
    addEventListener('online', check);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) check(); });
  }).catch(() => { });
  let had = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!had) { had = true; return; }            // first install: nothing to reload
    reloadWanted = true; maybeReload();
  });
}
export function maybeReload() { if (reloadWanted && canReloadNow()) location.reload(); }

// "Ready offline" only when the version this page runs on has a COMPLETE cache (marker + every file verified).
export async function offlineStatus() {
  try {
    const keys = (await caches.keys()).filter((k) => k.startsWith('riyadiyat-'));
    const want = window.__VERSION__ ? 'riyadiyat-' + window.__VERSION__ : null;
    const order = want ? [want, ...keys.filter((k) => k !== want)] : keys;
    let best = { ready: false, have: 0, total: 0 };
    for (const name of order) {
      if (!keys.includes(name)) continue;
      const c = await caches.open(name);
      const lr = await c.match(new URL('asset-list.json', location.href).href); if (!lr) continue;
      const list = await lr.json(); let have = 0;
      for (const a of list.assets) if (await c.match(new URL(a, location.href).href)) have++;
      const mark = !!(await c.match(new URL('__complete__', location.href).href));
      const r = { ready: mark && have === list.assets.length && !!navigator.serviceWorker?.controller, have, total: list.assets.length, version: list.version };
      if (r.ready) return r; if (r.have > best.have) best = r;
    }
    return best;
  } catch (e) { return { ready: false, have: 0, total: 0 }; }
}
