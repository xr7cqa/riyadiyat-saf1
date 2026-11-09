import { S, save, tickUsage } from './store.js';
import { ar, num, todayKey } from './fmt.js';
import { say, unlock, loadPersonal, hasPersonal, log, stop } from './audio.js';
import { h, $, $$ } from './engine.js';
import * as A from './art.js';
import { runSession } from './session.js';
import { openParent, holdToOpen } from './parent.js';
import { registerSW, setReloadGuard, maybeReload } from './pwa.js';
import { LESSONS } from './content-u6.js';
import { lesson as L } from './store.js';

const app = document.getElementById('app');
let screen = 'home', greeted = false;
setReloadGuard(() => screen === 'home' || screen === 'parent');

function garden() {
  const n = S().stars; const trees = Math.floor(n / 10), flowers = n % 10;
  return `<div class="garden" aria-label="حديقة النجوم">${Array.from({ length: trees }, () => A.tree()).join('')}${Array.from({ length: flowers }, (_, i) => A.flower(i)).join('')}${n === 0 ? '<span class="seed">🌱</span>' : ''}</div>`;
}
function lessonPath() {
  return `<ol class="path">${LESSONS.map((l) => { const s = L(l.id).stage; return `<li class="st-${s}"><span class="dot">${s === 'mastered' ? '★' : s === 'confirm' ? '☆' : ''}</span><small>ص ${ar(l.page)}</small></li>`; }).join('')}</ol>`;
}

function home() {
  screen = 'home'; document.body.dataset.screen = 'home';
  const st = S();
  if (!st.settings.companion) return pickCompanion();
  const comp = A.companions[st.settings.companion];
  const today = todayKey();
  const locked = st.sessions.doneDay === today && st.sessions.extraDay !== today && !st.session;
  app.innerHTML = '';
  const el = h(`<div class="screen home">
    <header class="htop"><h1>رياضيات الصف الأول</h1><button class="parent-btn" aria-label="ولي الأمر (اضغط مطوّلًا)">⚙️</button></header>
    <div class="hero"><div class="comp-big">${comp.svg}</div><div class="stars-mini">${A.star()}<span>${ar(st.stars)}</span></div></div>
    ${garden()}
    ${lessonPath()}
    ${locked ? `<div class="bye">انتهينا اليوم 🌙 نلتقي غدًا</div>` : `<button class="btn start">${st.session ? 'نكمل اللعب ▶' : 'ابدأ اللعب ▶'}</button>`}
  </div>`);
  app.appendChild(el);
  holdToOpen($('.parent-btn', el), () => { screen = 'parent'; document.body.dataset.screen = 'parent'; openParent(app, { onClose: home }); });
  const start = $('.start', el);
  if (start) start.onclick = async () => {
    unlock();
    start.disabled = true;
    if (!greeted) { greeted = true; await say(hasPersonal('p_greet') ? 'p_greet' : 't_welcome'); }
    if (st.sessions.doneDay === today && st.sessions.extraDay === today && !st.session) st.sessions.extraDay = null;
    screen = 'game'; document.body.dataset.screen = 'game';
    await runSession(app, { resume: !!st.session, onExit: () => { stop(); home(); maybeReload(); } });
  };
  // greeting on entry if the browser allows sound without a tap
  if (!greeted && !locked) {
    const before = log.length;
    say(hasPersonal('p_greet') ? 'p_greet' : 't_welcome').then(() => { if (!log.slice(before).some((x) => String(x).startsWith('blocked'))) greeted = true; });
  }
  maybeReload();
}

function pickCompanion() {
  screen = 'pick'; document.body.dataset.screen = 'pick';
  app.innerHTML = '';
  const el = h(`<div class="screen pick"><h2>اختر صديقًا يلعب معك</h2><div class="comps">${Object.entries(A.companions).map(([k, c]) => `<button class="comp-card" data-k="${k}">${c.svg}<span>${c.name}</span></button>`).join('')}</div><button class="btn listen">🔊</button></div>`);
  app.appendChild(el);
  $('.listen', el).onclick = () => { unlock(); say('t_pick_companion'); };
  say('t_pick_companion');
  $('.comps', el).onclick = async (e) => {
    const b = e.target.closest('.comp-card'); if (!b) return;
    unlock();
    $$('.comp-card', el).forEach((x) => x.classList.toggle('chosen', x === b));
    await say(A.companions[b.dataset.k].clip);
    S().settings.companion = +b.dataset.k; save();
    home();
  };
}

// usage minutes (only while the page is visible)
setInterval(() => { if (!document.hidden && screen === 'game') tickUsage(10); }, 10000);

(async () => {
  try { window.__VERSION__ = (await (await fetch('asset-list.json')).json()).version; } catch (e) { }
  await loadPersonal().catch(() => { });
  registerSW();
  home();
})();
