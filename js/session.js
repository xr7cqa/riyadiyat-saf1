// Daily session: placement/foundation rounds, 2 review questions, today's lesson (watch -> together -> alone), last independent task, gentle close.
import { S, save, lesson as L, addError } from './store.js';
import { todayKey, pick, sleep } from './fmt.js';
import { say, hasPersonal } from './audio.js';
import { mountGame, task, speak, celebrate, updateStars, clearPlay, h } from './engine.js';
import { GAMES } from './games.js';
import { LESSONS, lessonById, FOUNDATION, skinsExcept } from './content-u6.js';

const PHASE_LABEL = { demo: 'انظر', guided: 'معًا', solo: 'وحدك', story: 'قصة', final: 'مهمة أخيرة', review: 'مراجعة', probe: 'تعارف', warmup: 'تمهيد' };

export function todaysLesson() {
  const st = S();
  return LESSONS.find((l) => !['mastered', 'confirm'].includes(L(l.id).stage)) || LESSONS.find((l) => L(l.id).stage === 'confirm') || null;
}

function foundationPlan() {
  const steps = [{ g: 'say', clips: ['t_intro_round'], text: 'هيا نتعارف بألعاب قصيرة' }];
  for (const k of Object.keys(FOUNDATION)) for (let i = 0; i < 2; i++) steps.push(Object.assign(FOUNDATION[k].item(i), { phase: 'probe', skill: k }));
  steps.push({ g: 'probeEnd' });
  return steps;
}

function reviewPlan(today) {
  const st = S(); const out = []; const sess = st.sessions.count;
  const used = new Set();
  const add = (s) => { if (out.length < 2) out.push(s); };
  // 1) lessons waiting for confirmation in a later session, on a different material
  for (const l of LESSONS) {
    const x = L(l.id);
    if (x.stage === 'confirm' && x.passSession < sess && (!today || l.id !== today.id || true)) { add(Object.assign(l.review(pick(skinsExcept(l.skin))), { lesson: l.id, phase: 'review', confirm: true })); used.add(l.id); }
  }
  // 2) skills chosen from his recent mistakes
  for (const e of st.errors.slice(0, 12)) {
    if (e.lesson && !used.has(e.lesson) && (!today || e.lesson !== today.id)) { const l = lessonById(e.lesson); if (l) { add(Object.assign(l.review(pick(skinsExcept(l.skin))), { lesson: l.id, phase: 'review' })); used.add(l.id); } }
    if (e.skill && !used.has(e.skill) && st.foundation.skills[e.skill]?.status === 'weak') { add(Object.assign(FOUNDATION[e.skill].item(), { phase: 'review', skill: e.skill })); used.add(e.skill); }
  }
  // 3) spaced practice of mastered lessons
  const mastered = LESSONS.filter((l) => L(l.id).stage === 'mastered' && !used.has(l.id));
  while (out.length < 2 && mastered.length) { const l = mastered.splice(Math.floor(Math.random() * mastered.length), 1)[0]; add(Object.assign(l.review(pick(skinsExcept(l.skin))), { lesson: l.id, phase: 'review' })); }
  return out;
}

export function buildPlan(forceLesson = null) {
  // forceLesson: a parent picked this lesson from the index -> play it directly (no intro round / review / warm-up)
  const st = S(); const steps = []; const direct = !!(forceLesson && lessonById(forceLesson));
  if (!st.foundation.done && !direct) steps.push(...foundationPlan());
  const today = direct ? lessonById(forceLesson) : todaysLesson();
  const rev = st.foundation.done && !direct ? reviewPlan(today) : [];
  if (rev.length) steps.push({ g: 'say', clips: ['t_review'], text: 'نبدأ بسؤالين مما تعلمنا' }, ...rev);
  if (today) {
    // foundation warm-up if a skill this lesson needs is weak
    const weak = today.needs.filter((k) => st.foundation.skills[k]?.status === 'weak').slice(0, 2);
    if (!direct && (weak.length || !st.foundation.done)) steps.push({ g: 'warmups', lesson: today.id });
    steps.push({ g: 'say', clips: ['t_today'], text: `درس اليوم: ${today.title}`, lessonTitle: today.id });
    const plan = today.plan().map((s) => Object.assign(s, { lesson: today.id }));
    for (const s of plan) {
      if (s.phase === 'demo') steps.push({ g: 'say', clips: ['t_watch'], text: 'انظر واسمع' });
      if (s.phase === 'guided') steps.push({ g: 'say', clips: ['t_together', 'c_together'], text: 'جرّب معنا' });
      if (s.phase === 'solo' && !steps.some((x) => x.g === 'say' && x.alone)) steps.push({ g: 'say', clips: ['t_alone'], text: 'جرّب وحدك', alone: true });
      if (s.phase === 'final') steps.push({ g: 'say', clips: ['t_last_task'], text: 'مهمة أخيرة تحلّها وحدك' });
      steps.push(s);
    }
    steps.push({ g: 'gameEnd', lesson: today.id });
  }
  steps.push({ g: 'close' });
  return { day: todayKey(), idx: 0, steps, lesson: today && today.id, started: Date.now(), retries: 0 };
}

function record(step, res) {
  const st = S();
  if (!res || res.demo) return;
  if (res.err) addError(res.err);
  if (step.skill) {
    const f = st.foundation.skills[step.skill] || (st.foundation.skills[step.skill] = { status: 'ok', ok: 0, n: 0, streak: 0 });
    f.n++; if (res.ok) { f.ok++; f.streak++; } else f.streak = 0;
    if (step.phase === 'probe' && !res.ok) f.status = 'weak';
    if (step.phase !== 'probe' && f.streak >= 2) f.status = 'ok';
    if (res.ok) st.stars++;
  }
  if (step.lesson) {
    const x = L(step.lesson); x.attempts++; if (res.ok) x.correct++;
    if (x.stage === 'new') x.stage = 'learning';
    if (['solo', 'final', 'story', 'review'].includes(step.phase)) {
      if (res.ok) { x.streak++; st.stars++; } else x.streak = 0;
      if (step.phase === 'review' && step.confirm) {
        if (res.ok) { x.stage = 'mastered'; x.masteredDay = todayKey(); st.stars += 3; step._mastered = true; }
        else { x.stage = 'learning'; x.streak = 0; }
      } else if (x.stage === 'learning' && x.streak >= 2 && step.lesson === st.session?.lesson) {
        x.stage = 'confirm'; x.passDay = todayKey(); x.passSession = st.sessions.count;
      }
    }
    if (step.skin && !x.skins.includes(step.skin)) x.skins.push(step.skin);
  }
  save();
}

async function runStep(step, plan) {
  const st = S();
  if (step.g === 'say') { clearPlay(); if (step.lessonTitle) clearPlay().appendChild(h(`<div class="lesson-title">${lessonById(step.lessonTitle).title}</div>`)); await task(step.text, step.clips); await sleep(300); return null; }
  if (step.g === 'probeEnd') { st.foundation.done = true; for (const k of Object.keys(FOUNDATION)) st.foundation.skills[k] = st.foundation.skills[k] || { status: 'ok', ok: 0, n: 0, streak: 0 }; save(); return null; }
  if (step.g === 'warmups') {
    // expand into warm-up items for weak skills of this lesson (2 guided items each)
    const l = lessonById(step.lesson);
    const weak = l.needs.filter((k) => st.foundation.skills[k]?.status === 'weak').slice(0, 2);
    const items = [];
    if (weak.length) items.push({ g: 'say', clips: ['t_warmup'], text: 'لعبة قصيرة قبل الدرس' });
    weak.forEach((k) => { for (let i = 0; i < 2; i++) items.push(Object.assign(FOUNDATION[k].item(i), { phase: 'warmup', skill: k })); });
    plan.steps.splice(plan.idx + 1, 0, ...items);
    return null;
  }
  if (step.g === 'gameEnd') {
    await celebrate([hasPersonal('p_praise') ? 'p_praise' : 't_done_game'], false);
    return null;
  }
  if (step.g === 'close') {
    clearPlay(); st.sessions.doneDay = todayKey(); save();
    await task('انتهت جلسة اليوم. نلتقي غدًا', ['t_bye', 'c_bye']);
    return 'close';
  }
  const fn = GAMES[step.g];
  const res = await fn(step);
  record(step, res);
  updateStars();
  if (step._mastered) await celebrate([hasPersonal('p_praise') ? 'p_praise' : 't_mastered', 'c_party'], true);
  // after a wrong answer in independent work: hint was given, now a NEW example in the same familiar context
  if (res && res.retry && step.lesson && plan.retries < 4 && !step.isRetry) {
    const l = lessonById(step.lesson);
    const nx = Object.assign(l.retry ? l.retry(step) : Object.assign({}, step), { isRetry: true });
    delete nx._mastered; delete nx.rowsShown;
    plan.steps.splice(plan.idx + 1, 0, { g: 'say', clips: ['t_new_try'], text: 'جرّب هذا المثال الجديد' }, nx);
    plan.retries++;
  }
  return res;
}

let RUN = 0;
export const stopSession = () => { RUN++; };
export async function runSession(app, { onExit, resume = false, forceLesson = null }) {
  const st = S(); const my = ++RUN;
  if (forceLesson) { st.sessions.count++; st.session = buildPlan(forceLesson); save(); }
  else if (!resume || !st.session) { st.sessions.count++; st.session = buildPlan(); save(); }
  const plan = st.session;
  mountGame(app, { onHome: () => { RUN++; save(); onExit(); } });
  if (resume && plan.idx > 0) await task('نكمل من حيث توقفنا', ['t_resume']);
  while (plan.idx < plan.steps.length) {
    if (my !== RUN) return; // left
    const step = plan.steps[plan.idx];
    document.body.dataset.step = `${plan.idx}:${step.g}:${step.phase || ''}`;
    window.__rs1 = { step, idx: plan.idx, plan };
    const tag = document.querySelector('.phase-tag'); if (tag) tag.remove();
    if (step.phase && document.querySelector('.taskbar')) document.querySelector('.taskbar').appendChild(h(`<span class="phase-tag">${PHASE_LABEL[step.phase] || ''}</span>`));
    const r = await runStep(step, plan);
    if (my !== RUN) return;
    plan.idx++; save();
    if (r === 'close') { st.session = null; save(); await sleep(600); onExit(); return; }
  }
  st.session = null; save(); onExit();
}
