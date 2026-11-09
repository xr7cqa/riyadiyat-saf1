// New design (trial: lesson ص ٢٠ «العددان ١٩ و٢٠»): scenes, big animated manipulatives, predict-before-adding,
// drag with a landing preview + snap, undo, unbundle, mistakes replayed as animations, surprise after the game.
// Same teaching method and result contract as games.js: step -> {ok, hinted, err, retry}.
import { ar, num, sleep, numberChoices, reversed, shuffle } from './fmt.js';
import { n as N, sfx, namePraise } from './audio.js';
import { S, save } from './store.js';
import { G, $, $$, h, clearPlay, task, speak, praise, setBusy, cards, numCards, DigitSlots, draggable, pose, setScene, pointAt, comeBack, v2log } from './engine.js';
import * as P2 from './art2.js';

const isSolo = (s) => ['solo', 'final', 'review', 'probe', 'story'].includes(s.phase);
const SCENE = { balloon: 'station', pencil: 'workshop', egg: 'farm', bead: 'station' };
let PID = 0;

/** FLIP animation: every [data-id] element glides from where it was to where it is after `mutate` */
function flip(root, mutate, { dur = 560, newFrom = null } = {}) {
  const before = new Map(); $$('[data-id]', root).forEach((e) => before.set(e.dataset.id, e.getBoundingClientRect()));
  mutate();
  const anims = [];
  $$('[data-id]', root).forEach((e) => {
    const b = before.get(e.dataset.id) || (newFrom && newFrom(e)); if (!b) return;
    const a = e.getBoundingClientRect(); if (!a.width) return;
    const dx = b.left - a.left, dy = b.top - a.top, sx = (b.width || a.width) / a.width, sy = (b.height || a.height) / a.height;
    if (Math.abs(dx) < 1 && Math.abs(dy) < 1 && Math.abs(sx - 1) < 0.02) return;
    anims.push(e.animate([{ transformOrigin: '0 0', transform: `translate(${dx}px,${dy}px) scale(${sx},${sy})` }, { transformOrigin: '0 0', transform: 'none' }], { duration: dur, easing: 'cubic-bezier(.2,.9,.25,1.12)' }));
  });
  return Promise.all(anims.map((a) => a.finished.catch(() => { })));
}

// ------------------------------------------------------------------ the board: tens (bundles / full cartons) and ones
export class V2Board {
  constructor(parent, o) {
    this.o = Object.assign({ skin: 'balloon', start: 0, bundled: null, pile: 0, interactive: true, showPV: false, autoTie: true, cols: false }, o);
    this.skin = this.o.skin; this.frame = this.skin === 'egg' || this.skin === 'bead';
    const tens = this.o.bundled ?? Math.floor(this.o.start / 10);
    this.bundles = Array.from({ length: tens }, () => Array.from({ length: 10 }, () => this.mk()));
    this.loose = Array.from({ length: this.o.start - 10 * tens }, () => this.mk());
    this.pile = this.o.pile; this.hist = [];
    const I = this.o.interactive;
    this.el = h(`<div class="tb v2board skin-${this.skin} mode-bundle ${I ? '' : 'static'} ${this.o.cols ? 'cols' : ''}">
      <div class="v2-area tb-board" dir="ltr" ${I ? 'data-zone="board"' : ''}><div class="v2-tens"></div><div class="v2-ones"></div></div>
      <div class="v2-qty"></div>
      ${this.o.showPV ? '<div class="v2-pv" dir="ltr"><div class="pvb t"><b></b><span>عشرات</span></div><div class="pvb o"><b></b><span>آحاد</span></div></div>' : ''}
      ${I ? '<div class="tb-tray" data-zone="tray"></div><div class="v2-actions"><button class="btn undo" aria-label="تراجع">↩</button><button class="btn tie" aria-label="اربط عشرة">🎀</button><button class="btn done">تمّ ✓</button></div>' : ''}
    </div>`);
    parent.appendChild(this.el);
    if (I) {
      $('.undo', this.el).onclick = () => this.undo();
      $('.tie', this.el).onclick = () => { if (!G.busy) this.tie(false); };
      $('.done', this.el).onclick = () => { if (G.busy) return; if (this._done) { const r = this._done; this._done = null; r(this.n); } else this._donePending = true; };
      $('.v2-tens', this.el).addEventListener('click', (e) => { const b = e.target.closest('.v2-bundle'); if (b && !G.busy) this.untie(+b.dataset.b); });
    }
    this.render();
  }
  mk() { return { id: 'q' + (++PID), c: PID }; }
  get n() { return this.bundles.length * 10 + this.loose.length; }
  get tens() { return this.bundles.length; }
  pieceHTML(p, inB) { return `<div class="v2-piece ${inB ? 'in-b' : ''}" data-id="${p.id}">${P2.piece[this.skin](p.c, { string: !inB })}</div>`; }
  render() {
    const T = $('.v2-tens', this.el), O = $('.v2-ones', this.el);
    T.innerHTML = this.bundles.map((b, i) => `<div class="v2-bundle" data-b="${i}" ${this.o.interactive ? 'role="button" aria-label="حزمة عشرة: المسها لتفكها"' : ''}><div class="v2-bm">${b.map((p) => this.pieceHTML(p, true)).join('')}</div>${this.skin === 'balloon' ? P2.strings() : ''}${this.frame ? '' : `<div class="v2-bow">${P2.bow()}</div>`}<span class="ten-tag">${num(10)}</span></div>`).join('');
    T.classList.toggle('many', this.bundles.length > 2);
    O.innerHTML = (this.frame ? `<div class="v2-carton">${Array.from({ length: 10 }, (_, k) => `<div class="cup">${this.loose[k] ? this.pieceHTML(this.loose[k]) : ''}</div>`).join('')}</div>` : this.loose.map((p) => this.pieceHTML(p)).join(''))
      + (this.o.interactive ? '<div class="v2-preview" aria-hidden="true"></div>' : '');
    O.classList.toggle('empty', !this.loose.length); O.classList.toggle('lots', this.loose.length > 10);
    Object.assign(this.el.dataset, { n: this.n, tens: this.tens, loose: this.loose.length });
    if (this.o.showPV) { const [t, o] = $$('.v2-pv b', this.el); t.textContent = ar(this.tens); o.textContent = this.loose.length >= 10 ? '…' : ar(this.loose.length); }
    if (this.o.interactive) {
      const tray = $('.tb-tray', this.el); tray.innerHTML = '';
      for (let i = 0; i < Math.min(this.pile, 4); i++) {
        const p = h(`<button class="piece tray-p" aria-label="أضف">${P2.piece[this.skin](PID + 7 + i, { string: true })}</button>`);
        draggable(p, { onTap: () => { this.add(p.getBoundingClientRect()); }, onDrop: (z, pt) => z.dataset.zone === 'board' && (this.add(pt ? { left: pt.x - 28, top: pt.y - 40, width: 56, height: 80 } : p.getBoundingClientRect()), true) });
        tray.appendChild(p);
      }
      tray.dataset.left = this.pile; tray.classList.toggle('empty', this.pile <= 0);
      const tie = $('.tie', this.el); tie.disabled = this.loose.length < 10; tie.classList.toggle('glow', this.loose.length >= 10);
      $('.undo', this.el).disabled = !this.hist.length;
    }
    this.o.onChange && this.o.onChange(this);
  }
  showPV(on) { this.el.classList.toggle('pv-on', on); }
  async add(from) {
    if (G.busy || this.pile <= 0) { sfx('soft'); return false; }
    this.pile--; const p = this.mk();
    const f = flip(this.el, () => { this.loose.push(p); this.render(); }, { newFrom: (e) => (e.dataset.id === p.id ? from : null) });
    const e = $(`[data-id="${p.id}"] svg`, this.el);
    if (e) e.animate(this.skin === 'balloon' ? [{ transform: 'scale(.35)' }, { transform: 'scale(1.15)' }, { transform: 'scale(1)' }] : [{ transform: 'scale(1.25)' }, { transform: 'scale(1)' }], { duration: 560, easing: 'ease-out' });
    sfx(this.skin === 'balloon' ? 'inflate' : 'snap'); setTimeout(() => sfx('snap'), 420);
    v2log.push('add'); if (this.skin === 'balloon') v2log.push('inflate');
    this.hist.push({ t: 'add' }); this.render();
    await f;
    if (this.o.autoTie && this.loose.length >= 10) await this.tie(true);
    return true;
  }
  async tie(auto) {
    if (this.loose.length < 10) return false;
    setBusy(true);
    const talk = auto ? (pose('cheer'), speak(['v_ten_formed'])) : null;
    const m = this.loose.splice(0, 10);
    await flip(this.el, () => { this.bundles.push(m); this.render(); }, { dur: 850 });
    const b = $$('.v2-bundle', this.el).pop(); b && b.classList.add('tying'); sfx('tie'); v2log.push('tie');
    await sleep(750); b && b.classList.remove('tying');
    this.hist.push({ t: 'tie', auto }); this.render();
    if (talk) await talk; pose('wave');
    setBusy(false); this._tied && this._tied(); return true;
  }
  async untie(i) {
    if (G.busy || !this.o.interactive) return;
    setBusy(true);
    const m = this.bundles.splice(i, 1)[0];
    await flip(this.el, () => { this.loose.unshift(...m); this.render(); }, { dur: 700 });
    sfx('whoosh'); v2log.push('untie'); this.hist.push({ t: 'untie', i }); this.render();
    await speak(['v_untied']);
    setBusy(false); this._untied && this._untied();
  }
  async unAdd() {
    const p = this.loose.pop(); if (!p) return;
    const e = $(`[data-id="${p.id}"]`, this.el), tr = $('.tb-tray', this.el).getBoundingClientRect();
    if (e) { const r = e.getBoundingClientRect(); await e.animate([{ transform: 'none' }, { transform: `translate(${tr.left + tr.width / 2 - r.left - r.width / 2}px,${tr.top - r.top}px) scale(.35)`, opacity: 0.2 }], { duration: 420, easing: 'ease-in' }).finished.catch(() => { }); }
    this.pile++; this.render();
  }
  async undo() {
    if (G.busy) return; const last = this.hist.pop(); if (!last) { sfx('soft'); return; }
    setBusy(true); sfx('undo'); v2log.push('undo');
    if (last.t === 'tie') { const m = this.bundles.pop(); await flip(this.el, () => { this.loose.unshift(...m); this.render(); }); if (last.auto && this.hist.length && this.hist[this.hist.length - 1].t === 'add') { this.hist.pop(); await this.unAdd(); } }
    else if (last.t === 'untie') { const m = this.loose.splice(0, 10); await flip(this.el, () => { this.bundles.splice(last.i, 0, m); this.render(); }); }
    else await this.unAdd();
    this.render(); setBusy(false);
  }
  waitDone() { return new Promise((r) => { if (this._donePending) { this._donePending = false; r(this.n); } else this._done = r; }); }
  /** count again with a visible hop on every piece: ten (glow) ... then each single one */
  async countReplay() {
    v2log.push('replay:count'); let k = 0;
    for (const b of $$('.v2-bundle', this.el)) { k += 10; b.classList.add('glow'); await speak([k === 10 ? 'h_count_on' : null, N(Math.min(k, 20))].filter(Boolean)); b.classList.remove('glow'); }
    for (const p of this.loose) {
      k++; const e = $(`[data-id="${p.id}"]`, this.el);
      e && e.animate([{ transform: 'translateY(0)' }, { transform: 'translateY(-26px) scale(1.12)' }, { transform: 'translateY(0)' }], { duration: 420, easing: 'ease-out' });
      if (k <= 20) await speak([N(k)]);
    }
  }
  /** show what a (wrong) number means: the pieces regroup into that quantity, then back */
  async morphTo(v) {
    const all = [...this.bundles.flat(), ...this.loose]; const nb = Math.floor(v / 10), nl = v % 10, need = nb * 10 + nl;
    while (all.length < need) all.push(this.mk());
    const keep = all.slice(0, need), gone = all.slice(need);
    gone.forEach((p) => { const e = $(`[data-id="${p.id}"]`, this.el); e && e.animate([{ opacity: 1 }, { opacity: 0, transform: 'scale(.2) translateY(-40px)' }], { duration: 450, fill: 'forwards' }); });
    if (gone.length) await sleep(430);
    const before = new Set([...this.bundles.flat(), ...this.loose].map((p) => p.id));
    await flip(this.el, () => { this.bundles = Array.from({ length: nb }, (_, b) => keep.slice(b * 10, b * 10 + 10)); this.loose = keep.slice(nb * 10); this.render(); }, { dur: 750 });
    $$('[data-id]', this.el).forEach((e) => { if (!before.has(e.dataset.id)) e.animate([{ opacity: 0, transform: 'scale(.2)' }, { opacity: 1, transform: 'scale(1)' }], { duration: 450 }); });
    const q = $('.v2-qty', this.el); q.innerHTML = num(v); q.classList.add('on');
    this.el.dataset.shown = v; v2log.push('morph:' + v);
  }
  hideQty() { $('.v2-qty', this.el).classList.remove('on'); }
}

// ------------------------------------------------------------------ choose the number (with replayed mistakes)
async function chooseNumber(step, board, target, { clips = ['t_choose_number'] } = {}) {
  await task('كم العدد؟ اخترْ بطاقتَه', clips);
  const c = numCards(G.play, numberChoices(target, {}));
  if (step.phase === 'demo') { await sleep(500); c.mark(String(target), true); board.showPV(true); await speak([N(target)]); return { ok: true, demo: true }; }
  let hinted = false, err = null;
  for (; ;) {
    const v = +(await c.next());
    if (v === target) { c.mark(v, true); c.disable(); board.showPV(true); sfx('ok'); await speak([N(target)]); if (!hinted) await praise(); return { ok: !hinted, hinted, err, retry: hinted && isSolo(step) && step.phase !== 'story' }; }
    c.mark(v, false); const bad = c.el.querySelector(`[data-v="${v}"]`); if (bad) bad.disabled = true;
    hinted = true;
    const rev = v === reversed(target) && target >= 10;
    err = err || { lesson: step.lesson, type: rev ? 'reverse' : 'count', text: `رأى ${ar(target)} واختار ${ar(v)}${rev ? ' (عكس الخانتين)' : ''}` };
    setBusy(true); pose('kind');
    if (rev) {
      board.el.classList.add('hl-tens'); v2log.push('replay:pv');
      await pointAt($('.v2-tens', board.el), ['v_tens_here', 'h_pv']);
      board.el.classList.remove('hl-tens');
    } else { await pointAt(board.el, ['v_watch_again']); await board.countReplay(); }
    comeBack(); await speak(['v_fix_it']); setBusy(false);
  }
}

/** before adding: the child predicts what will happen */
async function predict(from, to) {
  const box = h(`<div class="predict"><div class="p-in"><div class="p-pic">${num(from)}<span>+</span>${P2.balloon(3)}<span>=</span><b>؟</b></div></div></div>`); G.play.appendChild(box);
  pose('think'); v2log.push('predict');
  const c = cards($('.p-in', box), shuffle([from, to, 10]).map((v) => ({ v, html: num(v) })), { cls: 'predict-cards' });
  await task('توقّعْ قبل أن تضيف: كم يصيرُ العددُ؟', ['v_predict_q']);
  const v = +(await c.next()); c.mark(v, v === to); c.disable();
  const right = v === to; pose(right ? 'cheer' : 'think'); if (right) sfx('ok');
  await speak([right ? 'v_predict_ok' : 'v_predict_see']);
  box.classList.add('out'); await sleep(350); box.remove(); pose('wave');
  return { v, right };
}

// ------------------------------------------------------------------ build (demo / guided with prediction / solo / story)
export async function build(step) {
  const P = clearPlay(); setScene(SCENE[step.skin] || 'station');
  const t = step.target, start = step.start || 0;
  const goal = h(`<div class="goal v2goal">${num(t, 'big')}</div>`); P.appendChild(goal);
  if (step.hideGoal) goal.style.visibility = 'hidden';
  const board = new V2Board(P, { skin: step.skin, start, bundled: step.bundled, pile: step.pile ?? Math.max(3, t - start + 2), showPV: true });
  if (step.phase === 'demo') {
    setBusy(true);
    await task('انظرْ واسمعْ', ['t_watch']);
    $$('.v2-bundle', board.el).forEach((b) => b.classList.add('glow'));
    await speak([(step.demoClips || [])[0] || 'l4_demo']);
    $$('.v2-bundle', board.el).forEach((b) => b.classList.remove('glow'));
    await pointAt($('.v2-ones', board.el), ['v_predict_demo'], 'think'); comeBack();
    setBusy(false);
    const tp = $('.tb-tray .piece', board.el); tp && tp.classList.add('demo-hand');
    await board.add(tp ? tp.getBoundingClientRect() : null);
    setBusy(true); await speak([(step.demoClips || [])[2] || 'l4_twenty']); setBusy(false);
    await chooseNumber(step, board, t);
    return { ok: true, demo: true };
  }
  let prediction = null;
  if (step.predict) prediction = await predict(board.n, t);
  const clips = step.clips || ['t_build', N(t)];
  await task(t - start === 1 ? 'أضفْ بالونًا واحدًا' : `كوِّنِ العددَ ${num(t)}`, step.phase === 'guided' ? [...clips, 'v_drag_balloon'] : clips, { wait: false });
  let hinted = false, err = null;
  for (; ;) {
    const got = await board.waitDone();
    if (board.loose.length >= 10) { setBusy(true); await pointAt($('.tie', board.el), ['h_tie_first']); comeBack(); setBusy(false); continue; }
    if (got === t) break;
    hinted = true;
    err = err || { lesson: step.lesson, type: got > t ? 'over' : 'under', text: `طُلب ${ar(t)} فكوّن ${ar(got)}` };
    setBusy(true); pose('kind');
    if (got > t) { v2log.push('replay:over'); await board.morphTo(got); await pointAt($('.undo', board.el), [got - t === 1 ? 'v_one_more' : 'h_too_many']); board.hideQty(); $('.undo', board.el).classList.add('glow'); }
    else { await pointAt($('.v2-ones', board.el), ['v_need_more']); await board.countReplay(); }
    comeBack(); await speak(['v_fix_it']); setBusy(false);
  }
  $('.undo', board.el)?.classList.remove('glow');
  sfx('ok'); board.showPV(true); board.hideQty();
  const r = await chooseNumber(step, board, t);
  return { ok: r.ok && !hinted, hinted: hinted || r.hinted, err: err || r.err, retry: (r.retry || hinted) && isSolo(step) && step.phase !== 'story', prediction };
}

export async function see(step) {
  const P = clearPlay(); setScene(SCENE[step.skin] || 'station');
  const board = new V2Board(P, { skin: step.skin, start: step.n, interactive: false, showPV: true });
  return chooseNumber(step, board, step.n, { clips: step.clips || ['t_how_many_pic'] });
}

export async function digits(step) {
  const P = clearPlay(); setScene(SCENE[step.skin] || 'station');
  const t = step.n, tens = Math.floor(t / 10), ones = t % 10;
  const board = new V2Board(P, { skin: step.skin, start: t, interactive: false, showPV: false, cols: true });
  const tiles = [...new Set([tens, ones, ones === 0 ? 1 : (ones + 1) % 10])].sort((a, b) => a - b);
  const slots = new DigitSlots(P, t, tiles); slots.el.classList.add('v2slots');
  await task('ركّبِ العددَ بالأرقام', [N(t), 't_digits']);
  let hinted = false, err = null;
  for (; ;) {
    const v = await slots.waitFull();
    if (v === t) { sfx('ok'); slots.el.classList.add('right'); await speak([N(t)]); if (!hinted) await praise(); return { ok: !hinted, hinted, err, retry: hinted && isSolo(step) && step.phase !== 'story' }; }
    hinted = true;
    const rev = slots.vals[0] === ones && slots.vals[1] === tens;
    err = err || { lesson: step.lesson, type: rev ? 'reverse' : 'digits', text: `كتب ${ar(t)} هكذا: ${ar(String(slots.vals[0]) + String(slots.vals[1]))}` };
    setBusy(true); pose('kind');
    if (rev || v <= 99) {
      v2log.push('replay:swap');
      await board.morphTo(v);                                   // the quantity changes in front of him
      await pointAt(slots.el, ['v_swap_see', ...(v <= 20 ? [N(v)] : [])]);
      await board.morphTo(t); board.hideQty();
      slots.highlight(true); await pointAt($('.s-tens', slots.el), ['v_swap_back']); slots.highlight(false);
    }
    slots.clear(); comeBack(); await speak(['v_fix_it']); setBusy(false);
  }
}

export async function story(step, fallback) {
  if (step.id !== 's4') return fallback(step);
  const P = clearPlay(); setScene('station');
  await task('اسمعِ القصة', ['t_story']);
  const sc = h(`<div class="v2story"><div class="actor" data-k="v"><img src="img/ch_seller.webp" alt=""><span>البائع</span></div><div class="actor" data-k="a"><img src="img/ch_ammar.webp" alt=""><span>عمّار</span></div></div>`);
  P.appendChild(sc); setBusy(true);
  for (const [who, clip] of [['', 's4_n'], ['v', 's4_seller'], ['a', 's4_ammar'], ['', 's4_q']]) {
    $$('.actor', sc).forEach((a) => a.classList.toggle('speaking', a.dataset.k === who)); await speak([clip]);
  }
  setBusy(false);
  return build({ g: 'build', skin: 'balloon', target: 20, start: 19, bundled: 1, clips: ['s4_q'], lesson: step.lesson, phase: 'story', hideGoal: true, keepScene: true });
}

export const V2GAMES = { build, see, digits, story };

// ------------------------------------------------------------------ small surprise after every game
export const STICKERS = ['star', 'rainbow', 'cupcake', 'kite', 'butterfly', 'sun', 'flower', 'rocket'];
export async function surprise() {
  const st = S(); st.stickers = st.stickers || [];
  const next = STICKERS[st.stickers.length % STICKERS.length];
  const ov = h(`<div class="surprise"><div class="sp-in"><button class="gift" aria-label="افتح الهدية">${P2.gift()}</button><img class="sticker" alt="" src="img/st_${next}.webp"><div class="sp-conf">${Array.from({ length: 24 }, (_, i) => `<i style="--a:${i * 15}deg;--c:${P2.bcol(i)}"></i>`).join('')}</div></div></div>`);
  document.body.appendChild(ov); pose('cheer'); v2log.push('gift');
  const talk = speak(['v_gift']);
  await new Promise((r) => { $('.gift', ov).onclick = r; setTimeout(r, 8000); });
  ov.classList.add('open'); sfx('open'); v2log.push('surprise:' + next);
  st.stickers.push(next); save();
  await talk; await speak([namePraise(), 't_done_game', 'v_sticker']);
  await sleep(500); ov.classList.add('out'); await sleep(350); ov.remove(); pose('wave');
}
