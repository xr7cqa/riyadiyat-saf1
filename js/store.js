import { todayKey } from './fmt.js';
const KEY = 'riyadiyat-saf1-v1';

const fresh = () => ({
  v: 1, created: Date.now(),
  settings: { volume: 0.9, companion: null, childName: '', schoolLesson: 'auto' },
  foundation: { done: false, skills: {} },   // skill -> {status:'ok'|'weak', ok, n, streak}
  lessons: {},                               // id -> {stage, streak, passDay, attempts, correct, skins:[]}
  stars: 0, errors: [], usage: {}, misses: 0,
  sessions: { doneDay: null, extraDay: null, count: 0 },
  session: null,                             // the running session plan (resume after reload)
});

let state = load();
function load() {
  try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && s.v === 1) return Object.assign(fresh(), s); } catch (e) { }
  return fresh();
}
export const S = () => state;
export function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { } }
export function reset() { const keep = { settings: state.settings }; state = fresh(); state.settings = Object.assign(state.settings, keep.settings, { companion: null }); save(); }
export function lesson(id) { return state.lessons[id] || (state.lessons[id] = { stage: 'new', streak: 0, passDay: null, attempts: 0, correct: 0, skins: [] }); }
export function addError(e) { state.errors.unshift(Object.assign({ d: todayKey() }, e)); state.errors = state.errors.slice(0, 60); save(); }
export function tickUsage(sec) { const k = todayKey(); state.usage[k] = (state.usage[k] || 0) + sec; save(); }
addEventListener('pagehide', save);
document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });

// ---- personal clips & parent recordings: IndexedDB, on this device only
const DB = 'riyadiyat-saf1-media';
function db() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore('clips');
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
}
export async function putClip(key, blob) { const d = await db(); return new Promise((res, rej) => { const t = d.transaction('clips', 'readwrite'); t.objectStore('clips').put(blob, key); t.oncomplete = res; t.onerror = () => rej(t.error); }); }
export async function getClip(key) { const d = await db(); return new Promise((res) => { const r = d.transaction('clips').objectStore('clips').get(key); r.onsuccess = () => res(r.result || null); r.onerror = () => res(null); }); }
export async function delClip(key) { const d = await db(); return new Promise((res) => { const t = d.transaction('clips', 'readwrite'); t.objectStore('clips').delete(key); t.oncomplete = res; }); }
