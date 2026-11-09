// Audio: local static clips played in a queue. Personal clips (from IndexedDB) replace the generic ones.
import { S, getClip } from './store.js';
import { sleep } from './fmt.js';

const cache = new Map();
const personal = { p_greet: null, p_praise: null };
let current = null, token = 0, unlocked = false;
export const log = [];  // played ids (used by tests)
window.__audioLog = log;

export async function loadPersonal() {
  for (const k of Object.keys(personal)) {
    if (personal[k]) URL.revokeObjectURL(personal[k]);
    const b = await getClip(k).catch(() => null);
    personal[k] = b ? URL.createObjectURL(b) : null;
  }
}
export const hasPersonal = (k) => !!personal[k];
function url(id) { return personal[id] || `audio/${id}.mp3`; }

function playOne(id, my) {
  return new Promise((resolve) => {
    if (my !== token) return resolve(false);
    const a = new Audio(url(id));
    a.volume = Math.max(0, Math.min(1, S().settings.volume));
    const rate = +(localStorage.getItem('rs1-test-rate') || 1); if (rate !== 1) a.playbackRate = rate; // automated tests only
    current = a;
    let done = false;
    const fin = (ok) => { if (done) return; done = true; clearTimeout(guard); resolve(ok); };
    const guard = setTimeout(() => fin(false), 9000);      // never hang a game on a missing clip
    a.onended = () => fin(true);
    a.onerror = () => { log.push('!' + id); setTimeout(() => fin(false), 600); };
    log.push(id);
    const p = a.play();
    if (p && p.catch) p.catch(() => { log.push('blocked:' + id); setTimeout(() => fin(false), 400); });
  });
}
/** say('t_build', 'n_13') plays clips one after another; resolves when finished (or interrupted). */
export async function say(...ids) {
  const my = ++token;
  if (current) { try { current.pause(); } catch (e) { } }
  for (const id of ids.flat()) {
    if (!id) continue;
    if (typeof id === 'number') { await sleep(id); continue; }
    if (my !== token) return false;
    await playOne(id, my);
    await sleep(140);
  }
  return my === token;
}
export function stop() { token++; if (current) { try { current.pause(); } catch (e) { } } }
export const n = (k, g = false) => (g && [2, 12, 20].includes(k) ? `n_${k}g` : `n_${k}`);

// short calm effects with WebAudio (no files)
let ctx = null;
export function unlock() {
  unlocked = true;
  try { ctx = ctx || new (window.AudioContext || window.webkitAudioContext)(); if (ctx.state === 'suspended') ctx.resume(); } catch (e) { }
}
export function sfx(kind) {
  if (!ctx) return;
  const v = S().settings.volume * 0.18;
  const notes = { pop: [520], ok: [660, 880], tie: [440, 550, 660], soft: [300], party: [523, 659, 784, 1046] }[kind] || [440];
  notes.forEach((f, i) => {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine'; o.frequency.value = f;
    const t = ctx.currentTime + i * 0.09;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    o.connect(g); g.connect(ctx.destination); o.start(t); o.stop(t + 0.25);
  });
}
let lastPraise = 0;
export function praiseId() { let i; do { i = 1 + Math.floor(Math.random() * 6); } while (i === lastPraise); lastPraise = i; return `c_praise_${i}`; }
