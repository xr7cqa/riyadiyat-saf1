import { S, save, tickUsage } from './store.js';
import { ar, num, todayKey } from './fmt.js';
import { say, unlock, loadPersonal, hasPersonal, log, stop, nameGreet } from './audio.js';
import { h, $, $$ } from './engine.js';
import * as A from './art.js';
import { runSession, todaysLesson } from './session.js';
import { poseSrc } from './engine.js';
import * as P2 from './art2.js';
import { openParent, holdToOpen, askLock } from './parent.js';
import { UNITS, INDEX_STATUS } from './units.js';
import { registerSW, setReloadGuard, maybeReload } from './pwa.js';
import { LESSONS } from './content-u6.js';
import { lesson as L } from './store.js';

const app = document.getElementById('app');
let screen = 'home', greeted = false;
setReloadGuard(() => screen === 'home' || screen === 'parent');

// places on the world map (percent of the 720x1280 picture; same boxes as the index thumbnails, tools/art_prep.py)
const PLACE_BOX = { workshop: [45.1, 3.1, 49.3, 26.2], beadshop: [4.9, 10.5, 33.3, 18.8], farm: [63.2, 30.9, 34.7, 21.1], station: [3.5, 31.3, 38.2, 27.3], jars: [36, 47, 26, 12] };
const rnd = (i) => { const x = Math.sin(i * 12.9898 + 4.1) * 43758.5453; return x - Math.floor(x); };
// the meadow grows with his stars: one flower per star, a tree for every ten, butterflies, and the stickers he won
function garden() {
  const st = S(), n = st.stars, out = [];
  const trees = Math.floor(n / 10), flowers = Math.min(n, 48);
  for (let i = 0; i < trees && i < 6; i++) out.push(`<div class="g-it tree" style="left:${[1, 82, 12, 70, 40, 56][i]}%;top:${[64, 63, 70, 70, 72, 66][i]}%">${P2.tree()}</div>`);
  for (let i = 0; i < flowers; i++) out.push(`<div class="g-it fl" style="left:${4 + ((i * 37) % 90) + rnd(i) * 3}%;top:${73 + ((i * 7) % 4) * 2.6 + rnd(i + 9) * 1.5}%;--d:${(i % 9) * 0.2}s">${P2.flower(i)}</div>`);
  (st.stickers || []).slice(-12).forEach((k, i) => out.push(`<img class="g-it stk" alt="" src="img/st_${k}.webp" style="left:${6 + ((i * 29) % 82)}%;top:${70 + (i % 3) * 3.5}%">`));
  if (n >= 15) for (let i = 0; i < Math.min(4, Math.floor(n / 15)); i++) out.push(`<img class="g-it bfly" alt="" src="img/st_butterfly.webp" style="left:${20 + i * 18}%;top:${60 + (i % 2) * 4}%;--d:${i * 0.7}s">`);
  return `<div class="garden2" aria-label="حديقة النجوم">${out.join('')}${n === 0 ? '<div class="g-it seed" style="left:46%;top:74%">🌱</div>' : ''}</div>`;
}
function worldMap(locked, st) {
  const cur = todaysLesson();
  const spots = UNITS.flatMap((u) => u.lessons).filter((l) => PLACE_BOX[l.place]).map((l) => { const [x, y, w, hh] = PLACE_BOX[l.place]; const s = L(l.id).stage; return `<button class="place st-${s} ${cur && cur.id === l.id ? 'current' : ''}" data-id="${l.id}" style="left:${x}%;top:${y}%;width:${w}%;height:${hh}%" aria-label="ص ${ar(l.page)} ${l.title}"><span class="pl-tag">${s === 'mastered' ? '★' : s === 'new' ? '' : '●'} ص ${num(l.page)}</span></button>`; }).join('');
  return `<div class="world"><img class="map" src="img/world_map.webp" alt="عالم الأرقام">${spots}${garden()}
    <img class="w-comp" alt="" src="${poseSrc('wave')}"><div class="w-stars">${A.star()}<span>${ar(st.stars)}</span></div>
    ${locked ? `<div class="bye">انتهينا اليوم 🌙 نلتقي غدًا</div>` : `<button class="btn start">${st.session ? 'نكمل اللعب ▶' : 'ابدأ اللعب ▶'}</button>`}</div>`;
}

// Lesson index, grouped by unit (data-driven from units.js). The child can look; only a parent (lock question) can jump.
function lessonIndex() {
  return `<section class="lindex" aria-label="فهرس الدروس"><h2>فهرس الدروس</h2>${UNITS.map((u) => `<div class="unit" data-unit="${u.id}"><h3>الوحدة ${num(u.id)}: ${u.title}</h3>${u.lessons.length ? `<ul>${u.lessons.map((l) => { const s = L(l.id).stage; return `<li><button class="idx-lesson st-${s}" data-id="${l.id}">${l.place ? `<img class="idx-img" alt="" src="img/pl_${l.place}.webp">` : ''}<span class="idx-t">ص ${num(l.page)} ${l.title}</span><em class="idx-s" data-stage="${s}">${INDEX_STATUS[s]}${s === 'mastered' ? ' ★' : ''}</em></button></li>`; }).join('')}</ul>` : '<p class="soon">قريبًا</p>'}</div>`).join('')}</section>`;
}
function home() {
  screen = 'home'; document.body.dataset.screen = 'home';
  const st = S();
  if (!st.settings.companion) return pickCompanion();
  const comp = A.companions[st.settings.companion];
  const today = todayKey();
  const locked = st.sessions.doneDay === today && st.sessions.extraDay !== today && !st.session;
  app.innerHTML = '';
  const el = h(`<div class="screen home v2home">
    <header class="htop"><h1>عالم الأرقام</h1><button class="parent-btn" aria-label="ولي الأمر (اضغط مطوّلًا)">⚙️</button></header>
    ${worldMap(locked, st)}
    ${lessonIndex()}
  </div>`);
  app.appendChild(el);
  const jump = (e) => {
    const b = e.target.closest('.idx-lesson, .place'); if (!b) return;
    const l = UNITS.flatMap((u) => u.lessons).find((x) => x.id === b.dataset.id); if (!l) return;
    // a child tap only opens the parent question; without the right answer nothing changes
    askLock(async () => {
      unlock(); stop();
      screen = 'game'; document.body.dataset.screen = 'game';
      await runSession(app, { forceLesson: l.id, onExit: () => { stop(); home(); maybeReload(); } });
    }, `تشغيل درس ص ${num(l.page)} ${l.title}`);
  };
  $('.lindex', el).onclick = jump; $('.world', el).addEventListener('click', jump);
  $('.w-comp', el).onclick = () => { unlock(); say(A.companions[st.settings.companion].clip); $('.w-comp', el).classList.remove('hop'); void $('.w-comp', el).offsetWidth; $('.w-comp', el).classList.add('hop'); };
  holdToOpen($('.parent-btn', el), () => { screen = 'parent'; document.body.dataset.screen = 'parent'; openParent(app, { onClose: home }); });
  const start = $('.start', el);
  if (start) start.onclick = async () => {
    unlock();
    start.disabled = true;
    if (!greeted) { greeted = true; await say(nameGreet()); }
    if (st.sessions.doneDay === today && st.sessions.extraDay === today && !st.session) st.sessions.extraDay = null;
    screen = 'game'; document.body.dataset.screen = 'game';
    await runSession(app, { resume: !!st.session, onExit: () => { stop(); home(); maybeReload(); } });
  };
  // greeting on entry if the browser allows sound without a tap
  if (!greeted && !locked) {
    const before = log.length;
    say(nameGreet()).then(() => { if (!log.slice(before).some((x) => String(x).startsWith('blocked'))) greeted = true; });
  }
  maybeReload();
}

function pickCompanion() {
  screen = 'pick'; document.body.dataset.screen = 'pick';
  app.innerHTML = '';
  const el = h(`<div class="screen pick"><h2>اختر صديقًا يلعب معك</h2><div class="comps">${Object.entries(A.companions).map(([k, c]) => `<button class="comp-card" data-k="${k}"><img alt="" src="${poseSrc('wave', +k)}"><span>${c.name}</span></button>`).join('')}</div><button class="btn listen">🔊</button></div>`);
  app.appendChild(el);
  $('.listen', el).onclick = () => { unlock(); say('t_pick_companion'); };
  say('t_pick_companion');
  $('.comps', el).onclick = async (e) => {
    const b = e.target.closest('.comp-card'); if (!b) return;
    unlock();
    $$('.comp-card', el).forEach((x) => x.classList.toggle('chosen', x === b)); $('img', b).src = poseSrc('cheer', +b.dataset.k);
    await say(A.companions[b.dataset.k].clip);
    S().settings.companion = +b.dataset.k; save();
    home();
  };
}

// usage minutes (only while the page is visible)
setInterval(() => { if (!document.hidden && screen === 'game') tickUsage(10); }, 10000);

(async () => {
  // never block the first screen on the network: the version label is filled in when it arrives
  fetch('asset-list.json').then((r) => r.json()).then((j) => { window.__VERSION__ = j.version; }).catch(() => { });
  await loadPersonal().catch(() => { });
  registerSW();
  home();
})();
