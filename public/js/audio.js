// Audio: local static clips played in a queue. Personal clips (from IndexedDB) replace the generic ones.
import { S, getClip } from './store.js';
import { sleep } from './fmt.js';

const cache = new Map();
const personal = { p_greet: null, p_praise: null };   // parent's own recordings override the built-in name clips
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
  if (kind === 'inflate' || kind === 'whoosh') { // short filtered noise sweep
    const len = kind === 'inflate' ? 0.35 : 0.25, buf = ctx.createBuffer(1, ctx.sampleRate * len, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(); src.buffer = buf; f.type = 'bandpass'; f.Q.value = 4;
    const t = ctx.currentTime; f.frequency.setValueAtTime(kind === 'inflate' ? 300 : 1200, t); f.frequency.exponentialRampToValueAtTime(kind === 'inflate' ? 1400 : 300, t + len);
    g.gain.value = v * 1.6; src.connect(f); f.connect(g); g.connect(ctx.destination); src.start(t); return;
  }
  const notes = { pop: [520], snap: [880, 1320], ok: [660, 880, 1046], tie: [523, 659, 784, 1046], soft: [300], undo: [600, 450], party: [523, 659, 784, 1046, 1318], open: [392, 523, 659, 784, 1046, 1318] }[kind] || [440];
  notes.forEach((f, i) => {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine'; o.frequency.value = f;
    const t = ctx.currentTime + i * 0.09;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    o.connect(g); g.connect(ctx.destination); o.start(t); o.stop(t + 0.25);
  });
}
let lastPraise = 0, praiseN = 0;
export function praiseId() { let i; do { i = 1 + Math.floor(Math.random() * 10); } while (i === lastPraise); lastPraise = i; return `c_praise_${i}`; }
/** the child's name (built in, or the parent's recording) alternates with varied generic praise */
export const nameGreet = () => (personal.p_greet ? 'p_greet' : 'name_greet');
export const namePraise = () => (personal.p_praise ? 'p_praise' : 'name_praise');
export function nextPraise() { praiseN++; return praiseN % 2 === 1 ? namePraise() : praiseId(); }
