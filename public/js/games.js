// Game types shared by all lessons. A step descriptor {g, phase, ...params} -> result {ok, hinted, err}
import { ar, num, sleep, numberChoices, reversed, shuffle, rint } from './fmt.js';
import { n as N, sfx } from './audio.js';
import { G, $, $$, h, tapQueue, clearPlay, task, speak, praise, setBusy, cards, numCards, TensBoard, quantityPic, CompareRows, compareLine, symSVG, correctOpen, DigitSlots, storyScene, draggable } from './engine.js';
import * as A from './art.js';

const isSolo = (s) => ['solo', 'final', 'review', 'probe', 'story'].includes(s.phase);
const skinName = { pencil: 'قلم', bead: 'خرزة', egg: 'بيضة', balloon: 'بالون' };

/** count-on hint: highlight ones and count from ten */
async function countOnHint(board, target) {
  board && board.highlight('ones');
  const seq = ['h_count_on', N(10)];
  for (let k = 11; k <= target; k++) seq.push(N(k));
  await speak(seq);
  board && board.highlight(null);
}
async function pvHint(board, slots) {
  board && board.el.classList.add('pv-show');
  board && board.highlight('tens'); slots && slots.highlight(true);
  await speak(['h_pv']);
  board && board.highlight('ones'); await sleep(900);
  board && board.highlight(null); slots && slots.highlight(false);
}
/** choose the number shown by `board`. Specific hints: digit reversal -> place value; other -> count on. */
async function chooseNumber(step, board, target, { clips = ['t_choose_number'], extra = [] } = {}) {
  const P = G.play;
  await task('اخترْ بطاقةَ العدد', clips);
  const c = numCards(P, numberChoices(target, { extra }));
  let hinted = false, err = null;
  if (step.phase === 'demo') {
    await sleep(500); c.mark(String(target), true); await speak([N(target)]); return { ok: true, demo: true };
  }
  for (; ;) {
    const v = +(await c.next());
    if (v === target) { c.mark(v, true); c.disable(); await speak([N(target)]); if (!hinted) await praise(); return { ok: !hinted, hinted, err }; }
    c.mark(v, false); hinted = true;
    const rev = v === reversed(target) && target >= 10;
    err = err || { lesson: step.lesson, type: rev ? 'reverse' : 'count', text: `${board ? 'رأى' : 'سمع'} ${ar(target)} واختار ${ar(v)}${rev ? ' (عكس الخانتين)' : ''}` };
    setBusy(true);
    if (rev) await pvHint(board); else await countOnHint(board, target);
    setBusy(false);
    if (isSolo(step) && step.phase !== 'story') { c.disable(); return { ok: false, hinted, err, retry: true }; }
    await speak(['t_try_again']);
  }
}

// ------------------------------------------------------------------ build a quantity on a ten board
export async function build(step) {
  const P = clearPlay();
  const t = step.target;
  const top = h(`<div class="goal">${num(t, 'big')}</div>`); P.appendChild(top);
  if (step.hideGoal) top.style.visibility = 'hidden';
  const board = new TensBoard(P, { skin: step.skin, start: step.start || 0, bundled: step.bundled, pile: step.pile ?? Math.min(14, t - (step.start || 0) + 3), autoTie: step.skin === 'balloon', minN: step.start || 0, noUntie: !!step.noUntie });
  const demo = step.phase === 'demo';
  if (demo) {
    setBusy(true);
    await task('انظرْ واسمعْ', ['t_watch', ...(step.demoClips || [])].slice(0, 1));
    const speech = speak(step.demoClips || ['t_build', N(t)]);
    if (board.mode === 'bundle' && (step.start || 0) < 10) { await board.demoAdd(10 - (step.start || 0), 500); await sleep(300); board.tie(); }
    await board.demoAdd(t - board.n, 650);
    await speech; await sleep(300);
    setBusy(false);
    const r = step.choose === false ? { ok: true } : await chooseNumber(step, board, t);
    return { ok: true, demo: true };
  }
  let hinted = false, err = null;
  // phased instructions (lesson 6-1): first ten -> tie, then add ones
  if (step.phased && board.mode === 'bundle' && board.bundled === 0) {
    await task('ضعْ عشرةَ أقلام ثم اربطْها', ['l1_put10'], { wait: false });
    await board.waitTie();
    await speak(['h_ten', N(10)]);
    const ones = t - 10;
    await task(ones === 1 ? 'أضفْ قلمًا واحدًا' : 'أضفْ قلمين', [ones === 1 ? 'l1_add1' : 'l1_add2'], { wait: false });
  } else if (step.phased && board.mode === 'frame' && board.n < 10) {
    await task('املأ الصفّين بالخرز', ['l2_fill'], { wait: false });
    await board.waitChange((b) => b.n >= 10);
    await speak(['h_ten', N(10)]);
    await task(`أضفْ حتى يصيرَ العددُ ${num(t)}`, ['l2_add', N(t)], { wait: false });
  } else {
    const clips = step.clips || ['t_build', N(t)];
    await task(`كوِّنِ العددَ ${num(t)}`, step.guided || step.phase === 'guided' ? [...clips, 't_done_btn'] : clips, { wait: false });
  }
  let idle = null;
  const nudge = () => { clearTimeout(idle); if (step.phase === 'guided') idle = setTimeout(() => speak(['c_help_tap']), 9000); };
  nudge(); const prevChange = board.o.onChange; board.o.onChange = (b) => { nudge(); $('.done', b.el)?.classList.toggle('glow', step.phase === 'guided' && b.n === t && !(b.mode === 'bundle' && b.loose >= 10)); };
  for (; ;) {
    const got = await board.waitDone();
    clearTimeout(idle);
    if (board.mode === 'bundle' && board.loose >= 10) { setBusy(true); await speak(['h_tie_first']); setBusy(false); continue; }
    if (got === t) break;
    hinted = true;
    err = err || { lesson: step.lesson, type: got > t ? 'over' : 'under', text: `طُلب ${ar(t)} فكوّن ${ar(got)}` };
    setBusy(true);
    if (got > t) await speak(['h_too_many']); else { await speak(['h_too_few']); if (step.phase !== 'solo') await countOnHint(board, got); }
    setBusy(false);
  }
  clearTimeout(idle);
  board.o.onChange = prevChange;
  sfx('ok');
  if (step.choose === false) { if (!hinted) await praise(); return { ok: !hinted, hinted, err }; }
  const r = await chooseNumber(step, board, t);
  if (step.untie && board.bundled > 0) {
    await task('المسِ الحزمةَ لتفكَّها', ['l1_untie'], { wait: false });
    await Promise.race([new Promise((res) => (board._untied = res)), sleep(12000)]);
    await sleep(800);
  }
  return { ok: r.ok && !hinted, hinted: hinted || r.hinted, err: err || r.err, retry: r.retry || hinted };
}

// ------------------------------------------------------------------ see a quantity, choose the number
export async function see(step) {
  const P = clearPlay();
  const board = quantityPic(P, step.n, step.skin, { showPV: true, bundled: step.skin === 'pencil' || step.skin === 'balloon' ? Math.floor(step.n / 10) : null });
  board.el.classList.add('pv-hide');
  return chooseNumber(step, board, step.n, { clips: step.clips || ['t_how_many_pic'] });
}

// ------------------------------------------------------------------ hear a number, choose the picture
export async function hear(step) {
  const P = clearPlay();
  const t = step.n; const lo = step.lo ?? 0, hi = step.hi ?? 20;
  const opts = shuffle([t, ...[t + 1, t - 1, t + 2, t - 2].filter((v) => v >= lo && v <= hi && v !== t)].slice(0, 3));
  const row = h('<div class="pic-choices"></div>'); P.appendChild(row);
  opts.forEach((v) => { const b = h(`<button class="pic-card" data-v="${v}"></button>`); quantityPic(b, v, step.skin, { bundled: step.skin === 'pencil' ? Math.floor(v / 10) : null }); row.appendChild(b); });
  const nextPick = tapQueue(row, '.pic-card', 'v');
  await task('اسمعْ واخترِ الصورة', ['t_which_pic', N(t)]);
  let hinted = false, err = null;
  for (; ;) {
    const v = +(await nextPick());
    const b = row.querySelector(`[data-v="${v}"]`);
    if (v === t) { b.classList.add('right'); await speak([N(t)]); if (!hinted) await praise(); return { ok: !hinted, hinted, err }; }
    b.classList.add('wrong'); setTimeout(() => b.classList.remove('wrong'), 900); hinted = true;
    err = err || { lesson: step.lesson, type: 'match', text: `سمع ${ar(t)} واختار صورة فيها ${ar(v)}` };
    setBusy(true); await speak(['h_listen_again', N(t)]); setBusy(false);
    if (isSolo(step)) return { ok: false, hinted, err, retry: true };
  }
}

// ------------------------------------------------------------------ compose the written number with digit tiles
export async function digits(step) {
  const P = clearPlay();
  const t = step.n; const tens = Math.floor(t / 10), ones = t % 10;
  const board = quantityPic(P, t, step.skin, { showPV: true, bundled: ['pencil', 'balloon'].includes(step.skin) ? tens : null });
  board.el.classList.add('pv-hide');
  const tiles = [...new Set([tens, ones, ones === 0 ? 2 : (ones + 1) % 10])].sort((a, b) => a - b);
  const slots = new DigitSlots(P, t, tiles);
  await task('ركّبِ العددَ بالأرقام', [N(t), 't_digits']);
  let hinted = false, err = null;
  for (; ;) {
    const v = await slots.waitFull();
    if (v === t) { sfx('ok'); await speak([N(t)]); if (!hinted) await praise(); return { ok: !hinted, hinted, err }; }
    hinted = true;
    const rev = v === reversed(t);
    err = err || { lesson: step.lesson, type: rev ? 'reverse' : 'digits', text: `كتب ${ar(t)} هكذا: ${ar(String(Math.floor(v / 10)) + String(v % 10))}` };
    setBusy(true); if (rev) await pvHint(board, slots); else await countOnHint(board, t); setBusy(false);
    slots.clear();
    if (isSolo(step) && step.phase !== 'story') return { ok: false, hinted, err, retry: true };
  }
}

// ------------------------------------------------------------------ compare two numbers (beads paired one to one, words, symbol)
const WORDS = { gt: 'أكبر من', lt: 'أصغر من', eq: 'يساوي' };
const relOf = (a, b) => (a > b ? 'gt' : a < b ? 'lt' : 'eq');
async function readSentence(a, b) { const r = relOf(a, b); await speak([N(a), 'w_' + r, N(b, true)]); }
async function chooseSymbol(step, a, b, rowsHint, line) {
  const P = G.play;
  line = line || compareLine(P, a, b);
  await task('اخترِ الرمزَ المناسب', ['l5_symbol']);
  const right = correctOpen(a, b);
  const c = cards(P, shuffle(['right', 'left', 'eq']).map((o) => ({ v: o, html: symSVG(o) })), { cls: 'sym-cards' });
  let hinted = false, err = null;
  if (step.phase === 'demo') { await sleep(500); c.mark(right, true); }
  else for (; ;) {
    const v = await c.next();
    if (v === right) { c.mark(v, true); c.disable(); break; }
    c.mark(v, false); hinted = true;
    err = err || { lesson: step.lesson, type: 'symbol', text: `في المقارنة بين ${ar(a)} و${ar(b)} اختار رمزًا خاطئًا` };
    setBusy(true);
    if (v !== 'eq' && right !== 'eq') { line.classList.add('hl-big-' + (a > b ? 'A' : 'B')); await speak(['h_sym']); line.classList.remove('hl-big-A', 'hl-big-B'); }
    else { await speak(['h_cmp']); }
    setBusy(false);
    if (rowsHint && !step.rowsShown) { step.rowsShown = true; await showRows(a, b); }
    if (isSolo(step) && step.phase !== 'story') { c.disable(); return { ok: false, hinted, err, retry: true }; }
  }
  $('.mid', line).innerHTML = symSVG(right);
  await readSentence(a, b);
  if (!hinted && step.phase !== 'demo') await praise();
  return { ok: !hinted, hinted, err };
}
async function showRows(a, b) {
  const box = h('<div class="rows-hint"></div>'); G.play.prepend(box);
  const rows = new CompareRows(box, a, b); await rows.demo();
  await speak([a === b ? 'l5_equal' : 'l5_left']);
}
export async function compare(step) {
  const P = clearPlay();
  const { a, b } = step;
  if (step.mode === 'pair') {
    const rows = new CompareRows(P, a, b);
    let hinted = false, err = null;
    if (step.phase === 'demo') { setBusy(true); await task('انظرْ واسمعْ', ['t_watch']); const sp = speak(['l5_demo']); await rows.demo(); await sp; setBusy(false); }
    else {
      await task('اقرنْ خرزةً بخرزة', a >= 10 && b >= 10 ? ['l5_pair_tens', 'l5_pair'] : ['l5_pair'], { wait: false });
      await rows.play({ guided: true });
    }
    rows.el.classList.add('done-' + relOf(a, b));
    await speak([a === b ? 'l5_equal' : 'l5_left']);
    const line = compareLine(P, a, b);
    await task('اخترْ: أكبر من، أصغر من، يساوي', ['l5_word']);
    const right = relOf(a, b);
    const c = cards(P, ['gt', 'lt', 'eq'].map((k) => ({ v: k, html: WORDS[k] })), { cls: 'word-cards' });
    if (step.phase === 'demo') { await sleep(400); c.mark(right, true); }
    else for (; ;) {
      const v = await c.next();
      if (v === right) { c.mark(v, true); c.disable(); break; }
      c.mark(v, false); hinted = true;
      err = err || { lesson: step.lesson, type: 'word', text: `قال إن ${ar(a)} ${WORDS[v]} ${ar(b)}` };
      setBusy(true); rows.el.classList.add('flash'); await speak(['h_cmp']); rows.el.classList.remove('flash'); setBusy(false);
    }
    $('.mid', line).innerHTML = `<span class="word">${WORDS[right]}</span>`;
    await readSentence(a, b);
    c.el.remove(); line.remove();
    const line2 = compareLine(P, a, b);
    const r = await chooseSymbol(step, a, b, false, line2);
    return { ok: !hinted && r.ok, hinted: hinted || r.hinted, err: err || r.err };
  }
  // symbol mode: dot cards (like the dominoes in the book) or plain numbers
  if (step.dots) {
    const d = h(`<div class="dominoes" dir="rtl"><div class="dom" data-k="A"></div><div class="dom" data-k="B"></div></div>`); P.appendChild(d);
    quantityPic($('[data-k=A]', d), a, 'bead'); quantityPic($('[data-k=B]', d), b, 'bead');
    await speak(['l5_count_dots']);
  }
  const ln = compareLine(P, a, b);
  await task('قارنْ بين العددين', ['l5_cmp_q', N(a), N(b)], { wait: true });
  return chooseSymbol(step, a, b, true, ln);
}
export async function pickExtreme(step) {
  const P = clearPlay();
  const vals = step.vals; const target = step.big ? Math.max(...vals) : Math.min(...vals);
  await task(step.big ? 'المسِ العددَ الأكبر' : 'المسِ العددَ الأصغر', [step.big ? 'l5_pick_big' : 'l5_pick_small', ...vals.flatMap((v) => [N(v), 200])]);
  const c = numCards(P, vals);
  let hinted = false, err = null;
  for (; ;) {
    const v = +(await c.next());
    if (v === target) { c.mark(v, true); c.disable(); if (!hinted) await praise(); return { ok: !hinted, hinted, err }; }
    c.mark(v, false); hinted = true;
    err = err || { lesson: step.lesson, type: 'extreme', text: `بين ${vals.map(ar).join(' و')} اختار ${ar(v)} ${step.big ? 'أكبرَ' : 'أصغرَ'} عدد` };
    setBusy(true); await showRows(v, target); setBusy(false);
    $('.rows-hint', P)?.remove();
    if (isSolo(step)) return { ok: false, hinted, err, retry: true };
  }
}

// ------------------------------------------------------------------ stories (word problems) with character voices
const STORIES = {
  s1: { cast: [{ k: 'f', art: 'man', name: 'الأب' }, { k: 's', art: 'boy', name: 'سامي' }], lines: [['', 's1_n'], ['f', 's1_father'], ['s', 's1_sami'], ['', 's1_q']], act: { g: 'build', skin: 'pencil', target: 12, phased: false, clips: ['s1_q'] } },
  s2: { cast: [{ k: 'm', art: 'woman', name: 'الأم' }, { k: 'b', art: 'girl', name: 'بلقيس' }], lines: [['', 's2_n'], ['m', 's2_mom'], ['b', 's2_bilqis'], ['', 's2_q']], act: { g: 'build', skin: 'bead', target: 14, clips: ['s2_q'] } },
  s3: { cast: [{ k: 'g', art: 'grandma', name: 'الجدة' }], lines: [['', 's3_n'], ['g', 's3_grandma'], ['', 's3_q']], act: { g: 'build', skin: 'egg', target: 17, start: 10, clips: ['s3_q'] } },
  s4: { cast: [{ k: 'v', art: 'man', name: 'البائع' }, { k: 'a', art: 'boy', name: 'عمّار' }], lines: [['', 's4_n'], ['v', 's4_seller'], ['a', 's4_ammar'], ['', 's4_q']], act: { g: 'build', skin: 'balloon', target: 20, start: 19, bundled: 1, clips: ['s4_q'], noUntie: true } },
  s5: { cast: [{ k: 'a', art: 'boy', name: 'أحمد' }, { k: 'm', art: 'boy', name: 'محمد' }, { k: 'f', art: 'girl', name: 'فاطمة' }], lines: [['', 's5_n'], ['a', 's5_ahmad'], ['f', 's5_fatima'], ['', 's5_q']], act: { g: 'ages' } },
};
export async function story(step) {
  const P = clearPlay();
  const s = STORIES[step.id];
  await task('اسمعِ القصة', ['t_story']);
  setBusy(true); await storyScene(P, s.cast, s.lines); setBusy(false);
  if (s.act.g === 'ages') return ages(step);
  return build(Object.assign({}, s.act, { lesson: step.lesson, phase: 'story', hideGoal: true }));
}
async function ages(step) {
  const P = G.play;
  const line = h(`<div class="numline" dir="rtl">${[6, 7, 8, 9, 10].map((v) => `<div class="tick ${v === 7 ? 'f' : v === 9 ? 'a' : ''}" data-v="${v}"><b>${num(v)}</b>${v === 7 ? '<small>فاطمة</small>' : v === 9 ? '<small>أحمد</small>' : v === 8 ? '<small>محمد؟</small>' : ''}</div>`).join('')}</div>`);
  P.appendChild(line);
  const c = numCards(P, [6, 8, 10]);
  let hinted = false, err = null;
  for (; ;) {
    const v = +(await c.next());
    if (v === 8) { c.mark(v, true); c.disable(); await speak([N(8)]); if (!hinted) await praise(); return { ok: !hinted, hinted, err }; }
    c.mark(v, false); hinted = true; err = err || { lesson: step.lesson, type: 'between', text: `اختار ${ar(v)} عمرًا لمحمد (المطلوب عدد بين ٧ و٩)` };
    setBusy(true); line.classList.add('hl-between'); await speak(['s5_q']); line.classList.remove('hl-between'); setBusy(false);
  }
}

// ------------------------------------------------------------------ foundation games (first-term skills)
export async function countTap(step) {
  const P = clearPlay();
  const k = step.k; const art = step.obj === 'bird' ? A.bird : A.apple;
  const field = h('<div class="field"></div>'); P.appendChild(field);
  const pos = shuffle(Array.from({ length: 12 }, (_, i) => i)).slice(0, k);
  pos.forEach((p, i) => field.appendChild(h(`<button class="obj" style="--r:${Math.floor(p / 4)};--c:${p % 4}" data-i="${i}">${art()}<em></em></button>`)));
  await task('المسْ كلَّ واحدة مرةً واحدة وعُدَّ', ['f_count_tap'], { wait: false });
  let counted = 0, doubles = 0;
  await new Promise((done) => {
    field.onclick = async (e) => {
      const b = e.target.closest('.obj'); if (!b || G.busy) return;
      if (b.classList.contains('counted')) { doubles++; speak(['f_already']); return; }
      counted++; b.classList.add('counted'); $('em', b).innerHTML = ar(counted); speak([N(counted)]);
      if (counted === k) { await sleep(900); done(); }
    };
  });
  await task('كم عددها كلّها؟', ['f_how_many']);
  const c = numCards(P, numberChoices(k, { lo: 1, hi: 10 }));
  let hinted = false, err = null;
  for (; ;) {
    const v = +(await c.next());
    if (v === k) { c.mark(v, true); c.disable(); if (!hinted) await praise(); return { ok: !hinted, hinted, err }; }
    c.mark(v, false); hinted = true; err = err || { skill: 'count', type: 'count', text: `عدّ ${ar(k)} أشياء واختار ${ar(v)}` };
    setBusy(true); await speak(['h_count_again', ...Array.from({ length: k }, (_, i) => N(i + 1))]); setBusy(false);
    if (step.phase === 'probe' || step.phase === 'review') return { ok: false, hinted, err };
  }
}
export async function makeTen(step) {
  const P = clearPlay();
  const board = new TensBoard(P, { skin: 'bead', start: step.start, pile: 10 - step.start + 2, max: 12, minN: step.start, showPV: false });
  await task('أكملِ اللوحة حتى تصيرَ عشرة', ['f_make_ten', ...(step.phase === 'warmup' ? ['t_done_btn'] : [])], { wait: false });
  let hinted = false, err = null;
  for (; ;) {
    const got = await board.waitDone();
    if (got === 10) { await speak([N(10)]); if (!hinted) await praise(); return { ok: !hinted, hinted, err }; }
    hinted = true; err = err || { skill: 'make10', type: 'ten', text: `أراد تكوين عشرة فوضع ${ar(got)}` };
    setBusy(true); await speak([got > 10 ? 'h_too_many' : 'h_too_few']); setBusy(false);
    if (step.phase === 'probe') return { ok: false, hinted, err };
  }
}
const plate = (k, art) => `<div class="plate">${Array.from({ length: k }, () => art()).join('')}</div>`;
export async function moreQty(step) {
  const P = clearPlay();
  const { a, b } = step;
  const row = h(`<div class="plates" dir="rtl"><button class="pic-card" data-v="a">${plate(a, A.apple)}</button><button class="pic-card" data-v="b">${plate(b, A.apple)}</button></div>`); P.appendChild(row);
  const nextPick = tapQueue(row, '.pic-card', 'v');
  await task('أيُّ صحنٍ فيه أكثر؟', ['f_which_more']);
  const right = a > b ? 'a' : 'b';
  let hinted = false, err = null;
  for (; ;) {
    const v = await nextPick();
    if (v === right) { row.querySelector(`[data-v=${v}]`).classList.add('right'); if (!hinted) await praise(); return { ok: !hinted, hinted, err }; }
    hinted = true; err = err || { skill: 'compare', type: 'more', text: `بين صحن فيه ${ar(a)} وصحن فيه ${ar(b)} اختار الأقل` };
    setBusy(true); row.classList.add('pairing'); await speak(['h_more_less']); row.classList.remove('pairing'); setBusy(false);
    if (step.phase === 'probe') return { ok: false, hinted, err };
  }
}
export async function addSub(step) {
  const P = clearPlay();
  const { a, b, op } = step; const res = op === 'add' ? a + b : a - b;
  if (op === 'add') P.appendChild(h(`<div class="plates" dir="rtl"><div class="pic-card">${plate(a, A.apple)}</div><div class="plus">+</div><div class="pic-card">${plate(b, A.apple)}</div></div>`));
  else P.appendChild(h(`<div class="tree-birds"><div class="branch">${Array.from({ length: a }, (_, i) => `<span class="${i >= a - b ? 'flown' : ''}">${A.bird()}</span>`).join('')}</div></div>`));
  await task(op === 'add' ? 'كم صار؟' : 'كم بقي؟', [op === 'add' ? 'f_add' : 'f_sub']);
  const c = numCards(P, numberChoices(res, { lo: 0, hi: 10 }));
  let hinted = false, err = null;
  for (; ;) {
    const v = +(await c.next());
    if (v === res) { c.mark(v, true); c.disable(); await speak([N(res)]); if (!hinted) await praise(); return { ok: !hinted, hinted, err }; }
    c.mark(v, false); hinted = true; err = err || { skill: 'addsub10', type: op, text: op === 'add' ? `${ar(a)} و${ar(b)} معًا: اختار ${ar(v)}` : `من ${ar(a)} طار ${ar(b)}: اختار ${ar(v)}` };
    setBusy(true); await speak([op === 'add' ? 'h_count_again' : 'h_flown', ...Array.from({ length: res }, (_, i) => N(i + 1))]); setBusy(false);
    if (step.phase === 'probe') return { ok: false, hinted, err };
  }
}
export async function hearSmall(step) { return hear(Object.assign({}, step, { skin: 'bead', lo: 1, hi: 10 })); }

export const GAMES = { build, see, hear, digits, compare, pickExtreme, story, countTap, makeTen, moreQty, addSub, hearSmall };
