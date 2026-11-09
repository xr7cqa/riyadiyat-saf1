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

export async function offlineStatus() {
  try {
    const list = await (await fetch('asset-list.json', { cache: 'no-store' }).catch(() => caches.match('asset-list.json'))).json();
    const keys = await caches.keys(); const name = keys.find((k) => k === 'riyadiyat-' + list.version);
    if (!name) return { ready: false, have: 0, total: list.assets.length };
    const c = await caches.open(name); let have = 0;
    for (const a of list.assets) if (await c.match(new URL(a, location.href).href)) have++;
    return { ready: have === list.assets.length, have, total: list.assets.length, version: list.version };
  } catch (e) { return { ready: false, have: 0, total: 0 }; }
}
