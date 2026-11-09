// Shared game engine: screen frame, task bar, companion, drag-or-tap pieces, cards, ten boards, comparison rows, digit slots.
import { ar, num, sleep } from './fmt.js';
import { say, stop, sfx, praiseId, nextPraise, log as audioLog } from './audio.js';
import { S, save } from './store.js';
import * as A from './art.js';

export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export function h(html) { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; }

// ---------------------------------------------------------------- game frame
export const G = { root: null, play: null, replay: [], busy: false };
export function mountGame(app, { onHome } = {}) {
  app.innerHTML = '';
  const root = h(`<div class="screen game">
    <header class="taskbar"><button class="icon replay" aria-label="أعد الاستماع">🔊</button><div class="task-text" aria-live="polite"></div><button class="icon home" aria-label="الرئيسية">🏠</button></header>
    <main class="play"></main>
    <footer class="compbar"><div class="comp-avatar"><img class="comp-img" alt="" src="${poseSrc('wave')}"></div><div class="stars-mini">${A.star()}<span class="stars-n">${ar(S().stars)}</span></div></footer>
  </div>`);
  app.appendChild(root);
  G.root = root; G.play = $('.play', root);
  $('.replay', root).onclick = () => { if (G.replay.length) say(G.replay); };
  $('.home', root).onclick = () => { stop(); onHome && onHome(); };
  return root;
}
export function clearPlay() { G.play.innerHTML = ''; comeBack(); return G.play; }
// ---------------------------------------------------------------- companion poses (generated art) and scenes
export const COMP_KEY = { 1: 'cat', 2: 'bird', 3: 'bee' };
export const poseSrc = (p, k = S().settings.companion || 1) => `img/${COMP_KEY[k] || 'cat'}_${p}.webp`;
export const v2log = []; window.__v2log = v2log;
export function pose(p) {
  const im = G.root && $('.comp-img', G.root); if (!im) return;
  if (im.dataset.pose !== p) { im.src = poseSrc(p); im.dataset.pose = p; im.parentElement.classList.remove('bob'); void im.offsetWidth; im.parentElement.classList.add('bob'); }
}
export function setScene(name) { if (G.root) { if (name) G.root.dataset.scene = name; else delete G.root.dataset.scene; } }
/** the companion flies next to `el`, faces it and points (used after a mistake) */
export async function pointAt(el, clips, p = 'point') {
  const av = G.root && $('.comp-avatar', G.root); if (!av || !el) { if (clips) await speak(clips); return; }
  const r = el.getBoundingClientRect(), a = av.getBoundingClientRect();
  const side = r.left > innerWidth / 2 ? 'left' : 'right';           // stand on the free side of the target
  const w = a.width, x = side === 'left' ? Math.max(4, r.left - w * 0.9) : Math.min(innerWidth - w - 4, r.right - w * 0.1);
  const y = Math.min(innerHeight - a.height - 4, Math.max(70, r.top + r.height / 2 - a.height / 2));
  av.classList.add('pointing'); av.classList.toggle('flip', side === 'right' ? false : true);
  av.style.setProperty('--px', (x - a.left) + 'px'); av.style.setProperty('--py', (y - a.top) + 'px');
  el.classList.add('pointed'); pose(p); v2log.push('point');
  if (clips) await speak(clips); else await sleep(900);
  el.classList.remove('pointed');
}
export function comeBack() { const av = G.root && $('.comp-avatar', G.root); if (av) { av.classList.remove('pointing', 'flip'); av.style.removeProperty('--px'); av.style.removeProperty('--py'); } pose('wave'); }
export async function task(text, clips = [], { wait = true } = {}) {
  $('.task-text', G.root).innerHTML = `<span class="tt">${text}</span>`; // inline span: keeps the real space between a word and an isolated number
  G.replay = clips;
  talking(true);
  const p = say(clips).finally(() => talking(false));
  if (wait) await p;
}
export async function speak(clips) { talking(true); await say(clips); talking(false); }
export function talking(on) { G.root && G.root.classList.toggle('talking', on); }
export function updateStars() { const e = G.root && $('.stars-n', G.root); if (e) e.textContent = ar(S().stars); }
export async function praise() { sfx('ok'); pose('cheer'); G.root && G.root.classList.add('cheer'); await speak([nextPraise()]); G.root && G.root.classList.remove('cheer'); pose('wave'); }
export function setBusy(b) { G.busy = b; G.root && G.root.classList.toggle('busy', b); }

// ---------------------------------------------------------------- drag or tap
let missCount = 0; window.__touchMisses = () => missCount;
function zoneAt(x, y) {
  for (const e of document.elementsFromPoint(x, y)) { const z = e.closest && e.closest('[data-zone]'); if (z) return z; }
  return null;
}
/** Every draggable also works with a single tap (onTap). A drop outside any accepting zone returns the
 * piece gently and is NOT counted as a maths error (only as a touch miss). */
export function draggable(el, { onTap, onDrop }) {
  el.style.touchAction = 'none';
  el.addEventListener('pointerdown', (e) => {
    if (G.busy || e.button > 0) return;
    e.preventDefault();
    const sx = e.clientX, sy = e.clientY; const rect = el.getBoundingClientRect();
    let ghost = null, over = null;
    try { el.setPointerCapture(e.pointerId); } catch (_) { }
    const move = (ev) => {
      const dx = ev.clientX - sx, dy = ev.clientY - sy;
      if (!ghost && Math.hypot(dx, dy) > 10) {
        ghost = el.cloneNode(true); ghost.classList.add('ghost');
        Object.assign(ghost.style, { position: 'fixed', left: rect.left + 'px', top: rect.top + 'px', width: rect.width + 'px', height: rect.height + 'px', margin: 0, pointerEvents: 'none', zIndex: 1000 });
        document.body.appendChild(ghost); el.classList.add('dragging');
      }
      if (ghost) {
        ghost.style.transform = `translate(${dx}px,${dy}px) scale(1.12)`;
        const z = zoneAt(ev.clientX, ev.clientY);
        if (z !== over) { over && over.classList.remove('over'); over = z; over && over.classList.add('over'); }
      }
    };
    const up = (ev) => {
      el.removeEventListener('pointermove', move); el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up);
      over && over.classList.remove('over');
      if (!ghost) { if (ev.type === 'pointerup' && onTap) onTap(); return; }
      const z = zoneAt(ev.clientX, ev.clientY);
      const ok = z && onDrop ? onDrop(z, { x: ev.clientX, y: ev.clientY }) : false;
      if (ok) { ghost.remove(); el.classList.remove('dragging'); return; }
      missCount++; S().misses++; sfx('soft');
      ghost.style.transition = 'transform .35s ease'; ghost.style.transform = 'translate(0,0)';
      setTimeout(() => { ghost.remove(); el.classList.remove('dragging'); }, 380);
    };
    el.addEventListener('pointermove', move); el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
  });
}

// ---------------------------------------------------------------- cards
/** Shows cards and resolves with the chosen value. items: [{v, html}] */
export function cards(parent, items, { cls = '' } = {}) {
  const row = h(`<div class="cards ${cls}"></div>`);
  items.forEach((it) => {
    const b = h(`<button class="card" data-v="${it.v}">${it.html}</button>`);
    row.appendChild(b);
  });
  parent.appendChild(row);
  const q = tapQueue(row, '.card', 'v');
  return {
    el: row,
    next: q,
    mark: (v, ok) => { const b = row.querySelector(`[data-v="${v}"]`); if (b) { b.classList.add(ok ? 'right' : 'wrong'); if (!ok) setTimeout(() => b.classList.remove('wrong'), 900); } },
    disable: () => $$('.card', row).forEach((b) => (b.disabled = true)),
  };
}
/** buffered taps: a tap that arrives before the game asks for it is kept, not lost */
export function tapQueue(root, sel, attr) {
  let resolver = null, pending = null;
  root.addEventListener('click', (e) => {
    const b = e.target.closest(sel); if (!b || G.busy || b.disabled) return;
    const v = b.dataset[attr];
    if (resolver) { const r = resolver; resolver = null; r(v); } else pending = v;
  });
  return () => new Promise((r) => { if (pending !== null) { const v = pending; pending = null; r(v); } else resolver = r; });
}
export const numCards = (parent, values) => cards(parent, values.map((v) => ({ v, html: num(v) })), { cls: 'num-cards' });

// ---------------------------------------------------------------- ten board (pencils / beads / eggs / balloons)
const SKIN = {
  pencil: { mode: 'bundle', piece: A.pencil, bundle: A.pencilBundle, name: 'قلم' },
  balloon: { mode: 'bundle', piece: A.balloon, bundle: A.balloonBundle, name: 'بالون' },
  bead: { mode: 'frame', piece: A.bead, name: 'خرزة' },
  egg: { mode: 'frame', piece: A.egg, name: 'بيضة' },
};
export class TensBoard {
  constructor(parent, o) {
    this.o = Object.assign({ skin: 'pencil', start: 0, bundled: null, pile: 12, showPV: true, interactive: true, max: 20, autoTie: false, done: true, tieBtn: true, onChange: null }, o);
    this.sk = SKIN[this.o.skin]; this.mode = this.sk.mode;
    this.n = this.o.start;
    this.bundled = this.mode === 'bundle' ? (this.o.bundled ?? Math.floor(this.n / 10)) : 0;
    this.pile = this.o.pile;
    this.el = h(`<div class="tb skin-${this.o.skin} mode-${this.mode} ${this.o.interactive ? '' : 'static'}">
      <div class="tb-board" data-zone="board" dir="ltr"><div class="tb-tens"></div><div class="tb-ones"></div></div>
      ${this.o.showPV ? `<div class="tb-pv" dir="ltr"><div class="pv tens"><b class="pv-d"></b><small>عشرات</small></div><div class="pv ones"><b class="pv-d"></b><small>آحاد</small></div></div>` : ''}
      ${this.o.interactive ? `<div class="tb-tray" data-zone="tray"></div><div class="tb-actions">${this.mode === 'bundle' && this.o.tieBtn ? '<button class="btn tie">🎀 اربط</button>' : ''}${this.o.done ? '<button class="btn done">تمّ ✓</button>' : ''}</div>` : ''}
    </div>`);
    parent.appendChild(this.el);
    if (this.o.interactive) {
      const tie = $('.tie', this.el); if (tie) tie.onclick = () => { if (!G.busy) this.tie(); };
      const d = $('.done', this.el); if (d) d.onclick = () => { if (G.busy) return; if (this._done) { const r = this._done; this._done = null; r(this.n); } else this._donePending = true; };
    }
    this.render();
  }
  get loose() { return this.n - 10 * this.bundled; }
  get tens() { return this.mode === 'bundle' ? this.bundled : Math.floor(this.n / 10); }
  get ones() { return this.n - 10 * this.tens; }
  render() {
    const T = $('.tb-tens', this.el), O = $('.tb-ones', this.el); T.innerHTML = ''; O.innerHTML = '';
    this.el.dataset.n = this.n; this.el.dataset.tens = this.tens;
    if (this.mode === 'bundle') {
      for (let i = 0; i < this.bundled; i++) {
        const b = h(`<div class="bundle" title="عشرة">${this.sk.bundle()}<span class="ten-label">${num(10)}</span></div>`);
        if (this.o.interactive) b.onclick = () => { if (!G.busy) this.untie(i); };
        T.appendChild(b);
      }
      for (let i = 0; i < this.loose; i++) {
        const p = h(`<div class="piece placed">${this.sk.piece(i)}</div>`);
        if (this.o.interactive) draggable(p, { onTap: () => this.remove(), onDrop: (z) => z.dataset.zone === 'tray' && (this.remove(), true) });
        O.appendChild(p);
      }
      if (!this.bundled && !this.loose) T.appendChild(h('<div class="empty-hint"></div>'));
    } else {
      for (let f = 0; f < 2; f++) {
        const filled = Math.max(0, Math.min(10, this.n - 10 * f));
        const fr = h(`<div class="frame ${filled === 10 ? 'full' : ''}"></div>`);
        for (let c = 0; c < 10; c++) {
          const cell = h(`<div class="cell">${c < filled ? `<div class="piece placed">${this.sk.piece(f)}</div>` : ''}</div>`);
          fr.appendChild(cell);
        }
        if (filled === 10) fr.appendChild(h(`<span class="ten-label">${num(10)}</span>`));
        (f === 0 ? T : O).appendChild(fr);
      }
      if (this.o.interactive) $$('.piece.placed', this.el).forEach((p) => draggable(p, { onTap: () => this.remove(), onDrop: (z) => z.dataset.zone === 'tray' && (this.remove(), true) }));
    }
    if (this.o.showPV) {
      const [t, o] = $$('.pv-d', this.el);
      t.innerHTML = ar(this.tens);
      o.innerHTML = this.mode === 'bundle' && this.loose >= 10 ? '…' : ar(this.ones);
    }
    if (this.o.interactive) {
      const tray = $('.tb-tray', this.el); tray.innerHTML = '';
      for (let i = 0; i < this.pile; i++) {
        const p = h(`<div class="piece">${this.sk.piece(i + 2)}</div>`);
        draggable(p, { onTap: () => this.add(), onDrop: (z) => z.dataset.zone === 'board' && (this.add(), true) });
        tray.appendChild(p);
      }
      const tie = $('.tie', this.el); if (tie) { tie.classList.toggle('glow', this.loose >= 10); tie.disabled = this.loose < 10; }
    }
    this.o.onChange && this.o.onChange(this);
  }
  add() {
    if (this.pile <= 0 || this.n >= this.o.max) { sfx('soft'); return false; }
    this.n++; this.pile--; sfx('pop'); this.render();
    if (this.mode === 'bundle' && this.o.autoTie && this.loose >= 10) setTimeout(() => this.tie(), 450);
    return true;
  }
  remove() {
    if (this.mode === 'bundle' ? this.loose <= 0 : this.n <= 0) return false;
    if (this.n <= (this.o.minN ?? 0)) { sfx('soft'); return false; }
    this.n--; this.pile++; sfx('soft'); this.render(); return true;
  }
  tie() {
    if (this.mode !== 'bundle' || this.loose < 10) return false;
    this.bundled++; sfx('tie'); this.render();
    const b = $$('.bundle', this.el).pop(); b && b.classList.add('pop-in');
    this._tied && this._tied(); return true;
  }
  untie(i) { if (this.o.noUntie) return; this.bundled--; sfx('soft'); this.render(); this._untied && this._untied(); }
  waitDone() { return new Promise((r) => { if (this._donePending) { this._donePending = false; r(this.n); } else this._done = r; }); }
  waitTie() { return new Promise((r) => { if (this.bundled > 0) r(); else this._tied = () => { this._tied = null; r(); }; }); }
  waitChange(pred) { return new Promise((r) => { const prev = this.o.onChange; this.o.onChange = (b) => { prev && prev(b); if (pred(b)) { this.o.onChange = prev; r(b); } }; }); }
  highlight(part) {
    this.el.classList.remove('hl-tens', 'hl-ones');
    if (part) this.el.classList.add('hl-' + part);
  }
  async demoAdd(k, gap = 650) {
    for (let i = 0; i < k; i++) {
      const p = $('.tb-tray .piece', this.el); p && p.classList.add('demo-hand');
      await sleep(gap / 2); this.add(); await sleep(gap / 2);
    }
  }
}
/** static picture of a quantity (ten + ones) */
export function quantityPic(parent, n, skin, opts = {}) {
  return new TensBoard(parent, Object.assign({ skin, start: n, interactive: false, showPV: false }, opts));
}

// ---------------------------------------------------------------- comparison: two bead columns, pair one to one
export class CompareRows {
  constructor(parent, a, b, o = {}) {
    this.a = a; this.b = b; this.o = o; this.pairsTen = false; this.pairs = 0;
    this.el = h(`<div class="cmp" dir="ltr">
       <div class="col colB"><div class="lab">${num(b)}</div><div class="strings"></div><div class="loose"></div></div>
       <div class="links"><div class="ten-link"></div><div class="loose-links"></div></div>
       <div class="col colA"><div class="lab">${num(a)}</div><div class="strings"></div><div class="loose"></div></div>
     </div>`);
    parent.appendChild(this.el); this.render();
  }
  render() {
    const side = (sel, n, ci) => {
      const col = $(sel, this.el); const st = $('.strings', col), lo = $('.loose', col);
      st.innerHTML = n >= 10 ? `<div class="tstring ${this.pairsTen ? 'paired' : ''}">${A.tenString(ci)}</div>` : '';
      lo.innerHTML = '';
      for (let i = 0; i < n % 10; i++) lo.appendChild(h(`<div class="lb ${i < this.pairs ? 'paired' : ''} ${this.finished && i >= this.pairs ? 'left' : ''}" data-i="${i}">${A.bead(ci)}</div>`));
    };
    side('.colA', this.a, 1); side('.colB', this.b, 0);
    $('.ten-link', this.el).classList.toggle('on', this.pairsTen);
    const L = $('.loose-links', this.el); L.innerHTML = '';
    for (let i = 0; i < this.pairs; i++) L.appendChild(h('<div class="ll"></div>'));
    this.el.dataset.pairs = this.pairs;
  }
  get maxPairs() { return Math.min(this.a % 10, this.b % 10); }
  /** child pairs: tap the ten string, then each loose bead of column A (right). */
  play({ guided }) {
    return new Promise((resolve) => {
      const step = () => {
        if (!this.pairsTen && this.a >= 10 && this.b >= 10) return;
        if (this.pairs >= this.maxPairs) { this.finished = true; this.render(); this.el.onclick = null; resolve(); }
      };
      this.el.onclick = (e) => {
        if (G.busy) return;
        if (e.target.closest('.colA .tstring') || e.target.closest('.colB .tstring')) { if (!this.pairsTen) { this.pairsTen = true; sfx('tie'); this.render(); if (this.maxPairs === 0) step(); else this.mark(); } return; }
        if (e.target.closest('.colA .lb') || e.target.closest('.colB .lb')) {
          if (!this.pairsTen) { this.mark(); return; }
          if (this.pairs < this.maxPairs) { this.pairs++; sfx('pop'); this.render(); this.mark(); }
          step();
        }
      };
      this.mark(); if (this.pairsTen && this.pairs >= this.maxPairs) step();
    });
  }
  mark() { $$('.next', this.el).forEach((x) => x.classList.remove('next')); if (!this.pairsTen) $$('.tstring', this.el).forEach((x) => x.classList.add('next')); else { const x = $(`.colA .lb[data-i="${this.pairs}"]`, this.el); x && x.classList.add('next'); } }
  async demo() { await sleep(500); this.pairsTen = true; sfx('tie'); this.render(); for (let i = 0; i < this.maxPairs; i++) { await sleep(600); this.pairs++; sfx('pop'); this.render(); } this.finished = true; this.render(); }
  showLeft() { this.finished = true; this.render(); }
}
/** comparison symbol drawn as SVG so bidi mirroring can never flip it. open: 'right' | 'left' | 'eq' */
export const symSVG = (open) => open === 'eq'
  ? `<svg viewBox="0 0 40 40" class="sym" data-open="eq"><path d="M8 14 H32 M8 26 H32" stroke="currentColor" stroke-width="5" stroke-linecap="round"/></svg>`
  : `<svg viewBox="0 0 40 40" class="sym" data-open="${open}"><path d="${open === 'right' ? 'M32 6 L8 20 L32 34' : 'M8 6 L32 20 L8 34'}" stroke="currentColor" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
/** a (first, on the right) ? b (on the left), like the book: «١٤ أكبر من ١٢» */
export function compareLine(parent, a, b, mid = '<span class="blank"></span>') {
  const el = h(`<div class="cmp-line" dir="rtl"><span class="opA">${num(a)}</span><span class="mid">${mid}</span><span class="opB">${num(b)}</span></div>`);
  parent.appendChild(el); return el;
}
export const correctOpen = (a, b) => (a === b ? 'eq' : a > b ? 'right' : 'left'); // opening faces the bigger number (a is on the right)

// ---------------------------------------------------------------- digit slots (compose the written number)
export class DigitSlots {
  constructor(parent, n, tiles) {
    this.n = n; this.vals = [null, null]; this.active = 0;  // 0 = tens (left), 1 = ones (right)
    this.el = h(`<div class="dslots"><div class="slots" dir="ltr"><div class="slot s-tens" data-zone="slot0" data-i="0"></div><div class="slot s-ones" data-zone="slot1" data-i="1"></div></div>
      <div class="slot-labels" dir="ltr"><small>عشرات</small><small>آحاد</small></div><div class="tiles"></div></div>`);
    parent.appendChild(this.el);
    const T = $('.tiles', this.el);
    tiles.forEach((d) => {
      const t = h(`<button class="tile" data-d="${d}">${ar(d)}</button>`);
      draggable(t, { onTap: () => this.put(this.active, d), onDrop: (z) => (z.dataset.zone || '').startsWith('slot') ? (this.put(+z.dataset.i, d), true) : false });
      T.appendChild(t);
    });
    $$('.slot', this.el).forEach((s) => (s.onclick = () => { if (G.busy) return; const i = +s.dataset.i; this.vals[i] = null; this.active = i; this.render(); }));
    this.render();
  }
  put(i, d) { this.vals[i] = d; sfx('pop'); this.active = this.vals[0] === null ? 0 : this.vals[1] === null ? 1 : i; this.render(); if (this.vals.every((v) => v !== null) && this._full) { const r = this._full; this._full = null; r(this.value); } }
  get value() { return this.vals[0] * 10 + this.vals[1]; }
  render() { $$('.slot', this.el).forEach((s, i) => { s.innerHTML = this.vals[i] === null ? '' : `<span>${ar(this.vals[i])}</span>`; s.classList.toggle('active', i === this.active); }); }
  clear() { this.vals = [null, null]; this.active = 0; this.render(); }
  waitFull() { return new Promise((r) => { if (this.vals.every((v) => v !== null)) r(this.value); else this._full = r; }); }
  highlight(on) { this.el.classList.toggle('hl', on); }
}

// ---------------------------------------------------------------- story scene
export async function storyScene(parent, cast, lines) {
  const sc = h(`<div class="story"><div class="cast">${cast.map((c) => `<div class="actor" data-k="${c.k}">${A.chars[c.art]}<span>${c.name}</span></div>`).join('')}</div></div>`);
  parent.appendChild(sc);
  for (const [who, clip] of lines) {
    $$('.actor', sc).forEach((a) => a.classList.toggle('speaking', a.dataset.k === who));
    await speak([clip]);
  }
  $$('.actor', sc).forEach((a) => a.classList.remove('speaking'));
  return sc;
}

// ---------------------------------------------------------------- celebration
export async function celebrate(clips, big = false) {
  const ov = h(`<div class="celebrate ${big ? 'big' : ''}">${Array.from({ length: big ? 28 : 14 }, (_, i) => `<i style="--x:${(i * 37) % 100}vw;--d:${(i % 7) * 0.12}s;--c:${A.color(i)}"></i>`).join('')}<div class="cel-star">${A.star()}</div></div>`);
  document.body.appendChild(ov); sfx('party');
  await speak(clips);
  await sleep(400); ov.remove();
}
export { audioLog };
