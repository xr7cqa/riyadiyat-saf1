// Service worker: the whole app (lessons + audio) is precached for offline play.
// - Cache-first: pages and files open instantly from the saved copy; a new version is looked for in the background.
// - Atomic update: a new version becomes active (and the old copy is deleted) only after EVERY file is in the new cache.
//   If one file fails, the install fails, the partial cache is thrown away, the old version keeps working,
//   and the browser tries again on the next visit.
const VERSION = '87c17f56a9';
const ASSETS = ["./", "css/app.css", "index.html", "js/art.js", "js/audio.js", "js/content-u6.js", "js/engine.js", "js/fmt.js", "js/games.js", "js/main.js", "js/parent.js", "js/pwa.js", "js/session.js", "js/store.js", "js/units.js", "manifest.webmanifest", "icons/icon-192.png", "icons/icon-512.png", "icons/maskable-512.png", "audio/c_bye.mp3", "audio/c_help_tap.mp3", "audio/c_hi_1.mp3", "audio/c_hi_2.mp3", "audio/c_hi_3.mp3", "audio/c_its_ok.mp3", "audio/c_look.mp3", "audio/c_party.mp3", "audio/c_praise_1.mp3", "audio/c_praise_2.mp3", "audio/c_praise_3.mp3", "audio/c_praise_4.mp3", "audio/c_praise_5.mp3", "audio/c_praise_6.mp3", "audio/c_star.mp3", "audio/c_together.mp3", "audio/f_add.mp3", "audio/f_already.mp3", "audio/f_count_tap.mp3", "audio/f_how_many.mp3", "audio/f_make_ten.mp3", "audio/f_sub.mp3", "audio/f_which_more.mp3", "audio/h_cmp.mp3", "audio/h_count_again.mp3", "audio/h_count_on.mp3", "audio/h_flown.mp3", "audio/h_listen_again.mp3", "audio/h_more_less.mp3", "audio/h_pv.mp3", "audio/h_sym.mp3", "audio/h_ten.mp3", "audio/h_tie_first.mp3", "audio/h_too_few.mp3", "audio/h_too_many.mp3", "audio/l1_add1.mp3", "audio/l1_add2.mp3", "audio/l1_demo1.mp3", "audio/l1_demo2.mp3", "audio/l1_put10.mp3", "audio/l1_untie.mp3", "audio/l2_add.mp3", "audio/l2_demo.mp3", "audio/l2_fill.mp3", "audio/l3_demo.mp3", "audio/l3_fill.mp3", "audio/l3_see.mp3", "audio/l4_add.mp3", "audio/l4_demo.mp3", "audio/l4_twenty.mp3", "audio/l5_cmp_q.mp3", "audio/l5_count_dots.mp3", "audio/l5_demo.mp3", "audio/l5_equal.mp3", "audio/l5_left.mp3", "audio/l5_pair.mp3", "audio/l5_pair_tens.mp3", "audio/l5_pick_big.mp3", "audio/l5_pick_small.mp3", "audio/l5_symbol.mp3", "audio/l5_word.mp3", "audio/n_0.mp3", "audio/n_1.mp3", "audio/n_10.mp3", "audio/n_11.mp3", "audio/n_12.mp3", "audio/n_12g.mp3", "audio/n_13.mp3", "audio/n_14.mp3", "audio/n_15.mp3", "audio/n_16.mp3", "audio/n_17.mp3", "audio/n_18.mp3", "audio/n_19.mp3", "audio/n_2.mp3", "audio/n_20.mp3", "audio/n_20g.mp3", "audio/n_2g.mp3", "audio/n_3.mp3", "audio/n_4.mp3", "audio/n_5.mp3", "audio/n_6.mp3", "audio/n_7.mp3", "audio/n_8.mp3", "audio/n_9.mp3", "audio/s1_father.mp3", "audio/s1_n.mp3", "audio/s1_q.mp3", "audio/s1_sami.mp3", "audio/s2_bilqis.mp3", "audio/s2_mom.mp3", "audio/s2_n.mp3", "audio/s2_q.mp3", "audio/s3_grandma.mp3", "audio/s3_n.mp3", "audio/s3_q.mp3", "audio/s4_ammar.mp3", "audio/s4_n.mp3", "audio/s4_q.mp3", "audio/s4_seller.mp3", "audio/s5_ahmad.mp3", "audio/s5_fatima.mp3", "audio/s5_n.mp3", "audio/s5_q.mp3", "audio/t_alone.mp3", "audio/t_build.mp3", "audio/t_bye.mp3", "audio/t_choose_number.mp3", "audio/t_digits.mp3", "audio/t_done_btn.mp3", "audio/t_done_game.mp3", "audio/t_how_many_pic.mp3", "audio/t_intro_round.mp3", "audio/t_last_task.mp3", "audio/t_listen_choose.mp3", "audio/t_mastered.mp3", "audio/t_new_try.mp3", "audio/t_next.mp3", "audio/t_pick_companion.mp3", "audio/t_resume.mp3", "audio/t_review.mp3", "audio/t_story.mp3", "audio/t_today.mp3", "audio/t_together.mp3", "audio/t_try_again.mp3", "audio/t_warmup.mp3", "audio/t_watch.mp3", "audio/t_welcome.mp3", "audio/t_which_pic.mp3", "audio/w_eq.mp3", "audio/w_gt.mp3", "audio/w_lt.mp3"];
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
