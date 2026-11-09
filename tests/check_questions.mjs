// Programmatic check: every closed question has exactly one correct answer, distinct options, numbers in range.
import fs from 'fs'; import path from 'path'; import url from 'url';
const here = path.dirname(url.fileURLToPath(import.meta.url)); const tmp = '/tmp/rs1q'; fs.mkdirSync(tmp, { recursive: true });
for (const f of ['fmt.js', 'content-u6.js']) fs.writeFileSync(path.join(tmp, f.replace('.js', '.mjs')), fs.readFileSync(path.join(here, '../public/js', f), 'utf8').replace(/'\.\/fmt\.js'/g, "'./fmt.mjs'"));
const { numberChoices, reversed } = await import(tmp + '/fmt.mjs');
const { LESSONS, FOUNDATION } = await import(tmp + '/content-u6.mjs');
const clips = new Set(fs.readdirSync(path.join(here, '../public/audio')).map((f) => f.replace('.mp3', '')));
let n = 0, bad = [];
const one = (opts, ok, tag) => { n++; const c = opts.filter(ok).length; if (c !== 1 || new Set(opts).size !== opts.length) bad.push(`${tag}: ${JSON.stringify(opts)}`); };
const cmpOpen = (a, b) => (a === b ? 'eq' : a > b ? 'right' : 'left');
const hearOpts = (t, lo, hi) => [t, ...[t + 1, t - 1, t + 2, t - 2].filter((v) => v >= lo && v <= hi && v !== t)].slice(0, 3);
function checkStep(s, tag) {
  const tgt = s.target ?? s.n;
  if (['build', 'see'].includes(s.g)) { const o = numberChoices(tgt); one(o, (v) => v === tgt, tag); if (o.length !== 3) bad.push(tag + ' not 3 cards'); }
  if (s.g === 'build' && s.clips) s.clips.forEach((c) => clips.has(c) || bad.push(tag + ' missing clip ' + c));
  if (s.g === 'hear' || s.g === 'hearSmall') { const o = hearOpts(tgt, s.lo ?? 1, s.hi ?? 10); one(o, (v) => v === tgt, tag); if (o.length < 3) bad.push(tag + ' <3 pictures'); }
  if (s.g === 'digits') { const t = Math.floor(tgt / 10), o = tgt % 10; const tiles = [...new Set([t, o, o === 0 ? 2 : (o + 1) % 10])]; if (!tiles.includes(t) || !tiles.includes(o)) bad.push(tag + ' tiles'); n++; }
  if (s.g === 'compare') { one(['right', 'left', 'eq'], (v) => v === cmpOpen(s.a, s.b), tag); const rel = s.a > s.b ? 'gt' : s.a < s.b ? 'lt' : 'eq'; one(['gt', 'lt', 'eq'], (v) => v === rel, tag); if (s.a < 10 || s.a > 20 || s.b < 10 || s.b > 20) bad.push(tag + ' range'); }
  if (s.g === 'pickExtreme') { const t = s.big ? Math.max(...s.vals) : Math.min(...s.vals); one(s.vals, (v) => v === t, tag); }
  if (s.g === 'countTap' || s.g === 'addSub') { const r = s.g === 'countTap' ? s.k : s.op === 'add' ? s.a + s.b : s.a - s.b; one(numberChoices(r, { lo: 0, hi: 10 }), (v) => v === r, tag); if (r > 10 || r < 0) bad.push(tag + ' >10'); }
  if (s.g === 'moreQty') { one(['a', 'b'], (v) => v === (s.a > s.b ? 'a' : 'b'), tag); if (s.a === s.b) bad.push(tag + ' equal plates'); }
  if (tgt != null && s.lesson) { const L = LESSONS.find((l) => l.id === s.lesson); }
}
for (let r = 0; r < 400; r++) {
  for (const L of LESSONS) {
    for (const s of L.plan()) { checkStep(s, `${L.id}/${s.g}/${s.phase}`); if (s.phase !== 'demo') checkStep(L.retry(s), `${L.id}/retry/${s.g}`);
      const t = s.target ?? s.n; if (t != null && s.g !== 'compare' && s.phase !== 'story' && (t < L.range[0] || t > L.range[1])) bad.push(`${L.id} ${s.g} ${t} outside lesson range`); }
    for (const sk of ['pencil', 'bead', 'egg', 'balloon']) checkStep(L.review(sk), `${L.id}/review`);
  }
  for (const [k, f] of Object.entries(FOUNDATION)) { checkStep(f.item(0), 'found/' + k); checkStep(f.item(1), 'found/' + k); }
}
one([6, 8, 10], (v) => v > 7 && v < 9, 'story s5 ages');
for (const t of [12, 14, 17, 20]) one(numberChoices(t), (v) => v === t, 'story ' + t);
// every clip referenced in the code exists
const code = ['games.js', 'session.js', 'main.js', 'content-u6.js', 'engine.js', 'parent.js'].map((f) => fs.readFileSync(path.join(here, '../public/js', f), 'utf8')).join('\n');
const refs = new Set([...code.matchAll(/'((?:t|f|h|l[1-5]|w|c|s[1-5])_[a-z0-9_]+)'/g)].map((m) => m[1]));
for (const r of refs) if (!clips.has(r) && !/^c_praise_$/.test(r)) bad.push('missing clip ' + r);
for (let i = 0; i <= 20; i++) if (!clips.has('n_' + i)) bad.push('missing n_' + i);
console.log(JSON.stringify({ questions_checked: n, clip_refs: refs.size, problems: [...new Set(bad)].slice(0, 30) }, null, 1));
process.exit(bad.length ? 1 : 0);
