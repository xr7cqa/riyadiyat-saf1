// Unit 6 «الأعداد حتى ٢٠» — trial: lessons 6-1 … 6-5 (printed pages 8, 12, 16, 20, 22)
import { pick, shuffle, rint } from './fmt.js';

const other = (arr, v) => pick(arr.filter((x) => x !== v));
const skinsExcept = (s) => ['pencil', 'bead', 'egg', 'balloon'].filter((x) => x !== s);

export const UNIT6 = {
  id: 6, title: 'الأعداد حتى ٢٠', pages: [7, 34],
  lessons: [
    {
      id: 'u6l1', code: '٦-١', page: 8, pages: [8, 9, 10, 11], title: 'العددان ١١ و١٢', game: 'ورشة الأقلام',
      skill: 'تكوين ١١ و١٢ من حزمة عشرة وآحاد', range: [11, 12], skin: 'pencil', needs: ['count', 'match10', 'make10'],
      home: 'حطّوا ١٢ قلمًا على الطاولة، وخلّوه يعدّ عشرة ويربطها بمطّاط، ثم يقول: حزمة وقلمان، اثنا عشر.',
      plan() {
        const a = pick([11, 12]), b = other([11, 12], a);
        return [
          { g: 'build', phase: 'demo', skin: 'pencil', target: 11, demoClips: ['l1_demo1', 'l1_demo2'] },
          { g: 'build', phase: 'guided', skin: 'pencil', target: 12, phased: true, untie: true },
          { g: 'build', phase: 'solo', skin: 'pencil', target: a, phased: true },
          { g: 'see', phase: 'solo', skin: 'pencil', n: b },
          { g: 'digits', phase: 'solo', skin: 'pencil', n: pick([11, 12]) },
          { g: 'story', phase: 'story', id: 's1' },
          { g: 'see', phase: 'final', skin: 'bead', n: pick([11, 12]) },
        ];
      },
      retry(step) { const n = (step.target ?? step.n) === 11 ? 12 : 11; return Object.assign({}, step, step.target != null ? { target: n } : { n }); },
      review(skin) { return pick([{ g: 'see', skin, n: pick([11, 12]) }, { g: 'build', skin, target: pick([11, 12]) }]); },
    },
    {
      id: 'u6l2', code: '٦-٢', page: 12, pages: [12, 13, 14, 15], title: 'الأعداد ١٣ و١٤ و١٥', game: 'لوحة الخرز',
      skill: 'تكوين ١٣ و١٤ و١٥ ومطابقتها بالعدد المسموع', range: [13, 15], skin: 'bead', needs: ['count', 'match10', 'make10'],
      home: 'رتّبوا ١٤ حبة فاصوليا: صفّين من خمس، ثم أربع حبات تحتها، وخلّوه يقول: عشرة وأربعة، أربعة عشر.',
      plan() {
        const s = shuffle([13, 14, 15]);
        return [
          { g: 'build', phase: 'demo', skin: 'bead', target: 13, demoClips: ['l2_demo'] },
          { g: 'build', phase: 'guided', skin: 'bead', target: 14, phased: true },
          { g: 'hear', phase: 'solo', skin: 'bead', n: s[0], lo: 11, hi: 17 },
          { g: 'build', phase: 'solo', skin: 'bead', target: s[1], phased: true },
          { g: 'digits', phase: 'solo', skin: 'bead', n: s[2] },
          { g: 'story', phase: 'story', id: 's2' },
          { g: 'see', phase: 'final', skin: 'egg', n: pick([13, 14, 15]) },
        ];
      },
      retry(step) { const v = step.target ?? step.n; const n = other([13, 14, 15], v); return Object.assign({}, step, step.target != null ? { target: n } : { n }); },
      review(skin) { return pick([{ g: 'hear', skin, n: rint(13, 15), lo: 11, hi: 17 }, { g: 'see', skin, n: rint(13, 15) }]); },
    },
    {
      id: 'u6l3', code: '٦-٣', page: 16, pages: [16, 17, 18, 19], title: 'الأعداد ١٦ و١٧ و١٨', game: 'علبتا البيض',
      skill: 'تكوين ١٦ و١٧ و١٨ بإكمال عشرة وآحاد', range: [16, 18], skin: 'egg', needs: ['count', 'match10', 'make10'],
      home: 'جيبوا علبتي بيض (أو كرتونتين)، املأوا الأولى عشرة، وخلّوه يكمل الثانية حتى ١٧ ويقول العدد.',
      plan() {
        const s = shuffle([16, 17, 18]);
        return [
          { g: 'build', phase: 'demo', skin: 'egg', target: 16, start: 10, demoClips: ['l3_demo'] },
          { g: 'build', phase: 'guided', skin: 'egg', target: 17, start: 10, clips: ['l3_fill', 'n_17'] },
          { g: 'build', phase: 'solo', skin: 'egg', target: s[0], start: 10, clips: ['l3_fill', 'n_' + s[0]] },
          { g: 'see', phase: 'solo', skin: 'egg', n: s[1], clips: ['l3_see'] },
          { g: 'digits', phase: 'solo', skin: 'egg', n: s[2] },
          { g: 'story', phase: 'story', id: 's3' },
          { g: 'see', phase: 'final', skin: 'pencil', n: pick([16, 17, 18]) },
        ];
      },
      retry(step) { const v = step.target ?? step.n; const n = other([16, 17, 18], v); const r = Object.assign({}, step, step.target != null ? { target: n } : { n }); if (r.clips && r.target != null) r.clips = ['l3_fill', 'n_' + n]; return r; },
      review(skin) { return pick([{ g: 'see', skin, n: rint(16, 18) }, { g: 'hear', skin, n: rint(16, 18), lo: 14, hi: 20 }]); },
    },
    {
      id: 'u6l4', code: '٦-٤', page: 20, pages: [20, 21], title: 'العددان ١٩ و٢٠', game: 'البالون الأخير',
      skill: 'فهم ١٩ و٢٠: عشرتان وصفر آحاد', range: [19, 20], skin: 'balloon', needs: ['count', 'make10'],
      home: 'اعملوا حزمتين من عشرة أعواد، فكّوا واحدة واتركوا ٩، وخلّوه يضيف عودًا فتصير عشرتين: عشرون.',
      plan() {
        return [
          { g: 'build', phase: 'demo', skin: 'balloon', target: 20, start: 19, bundled: 1, noUntie: true, demoClips: ['l4_demo', 'l4_add', 'l4_twenty'] },
          { g: 'build', phase: 'guided', skin: 'balloon', target: 20, start: 19, bundled: 1, noUntie: true, clips: ['l4_add'] },
          { g: 'see', phase: 'solo', skin: 'pencil', n: pick([19, 20]) },
          { g: 'build', phase: 'solo', skin: 'balloon', target: 19, start: 10, bundled: 1, noUntie: true },
          { g: 'digits', phase: 'solo', skin: 'balloon', n: 20 },
          { g: 'story', phase: 'story', id: 's4' },
          { g: 'see', phase: 'final', skin: 'egg', n: pick([19, 20]) },
        ];
      },
      retry(step) { if (step.g === 'digits') return Object.assign({}, step, { n: 19 }); const v = step.target ?? step.n; const n = v === 19 ? 20 : 19; return Object.assign({}, step, step.target != null ? { target: n } : { n }); },
      review(skin) { return { g: 'see', skin, n: pick([19, 20]) }; },
    },
    {
      id: 'u6l5', code: '٦-٥', page: 22, pages: [22, 23, 24, 25], title: 'مقارنة الأعداد ضمن ٢٠', game: 'صفّان من الخرز',
      skill: 'مقارنة عددين ضمن ٢٠ بالكلمات وبالرموز', range: [10, 20], skin: 'bead', needs: ['compare'],
      home: 'اعملوا صفّين من الحصى (١٤ و١٢)، وخلّوه يقابل حصاة بحصاة، ويقول: أربعة عشر أكبر من اثني عشر.',
      plan() {
        const p1 = pair(), p2 = pair(true), p3 = pair();
        return [
          { g: 'compare', phase: 'demo', mode: 'pair', a: 14, b: 12 },
          { g: 'compare', phase: 'guided', mode: 'pair', a: 13, b: 15 },
          { g: 'compare', phase: 'solo', mode: 'symbol', dots: true, ...p1 },
          { g: 'pickExtreme', phase: 'solo', vals: shuffle(distinct3()), big: Math.random() < 0.5 },
          { g: 'compare', phase: 'solo', mode: 'symbol', ...p2 },
          { g: 'story', phase: 'story', id: 's5' },
          { g: 'compare', phase: 'final', mode: 'symbol', ...p3 },
        ];
      },
      retry(step) { if (step.g === 'pickExtreme') return Object.assign({}, step, { vals: shuffle(distinct3()) }); return Object.assign({}, step, pair()); },
      review() { return { g: 'compare', mode: 'symbol', ...pair() }; },
    },
  ],
};
function pair(eq = false) { const a = rint(10, 20); if (eq && Math.random() < 0.35) return { a, b: a }; let b; do { b = rint(10, 20); } while (b === a); return { a, b }; }
function distinct3() { const s = new Set(); while (s.size < 3) s.add(rint(10, 20)); return [...s]; }

export const LESSONS = UNIT6.lessons;
export const lessonById = (id) => LESSONS.find((l) => l.id === id);
export { skinsExcept };

// first-term foundations the book builds on
export const FOUNDATION = {
  count: { name: 'العدّ بلمس كل شيء مرة واحدة', home: 'عدّوا معه ملاعق المطبخ، يلمس كل ملعقة مرة واحدة وهو يعدّ.', item: () => ({ g: 'countTap', k: rint(5, 9), obj: pick(['apple', 'bird']) }) },
  match10: { name: 'مطابقة العدد بالكمية حتى ١٠', home: 'قولوا له عددًا حتى ١٠، وخلّوه يجيب نفس العدد من الحبوب.', item: () => ({ g: 'hearSmall', n: rint(4, 9) }) },
  make10: { name: 'تكوين عشرة', home: 'حطّوا ٧ أزرار، واسألوه: كم نحتاج حتى تصير عشرة؟ وخلّوه يكمل بيده.', item: () => ({ g: 'makeTen', start: rint(5, 8) }) },
  compare: { name: 'مقارنة كميتين', home: 'حطّوا صحنين فيهما حبات تمر مختلفة، وخلّوه يقابل حبة بحبة ويقول أيهما أكثر.', item: () => { const a = rint(3, 9); let b; do { b = rint(3, 9); } while (b === a); return { g: 'moreQty', a, b }; } },
  addsub10: { name: 'الجمع والطرح ضمن ١٠', home: 'ضعوا ٣ حبات ثم ٢، واسألوه كم صارت؛ ثم ارفعوا ١ واسألوه كم بقي.', item: (i = 0) => (i % 2 === 0 ? (() => { const a = rint(2, 5), b = rint(1, 4); return { g: 'addSub', op: 'add', a, b }; })() : (() => { const a = rint(5, 9), b = rint(1, 4); return { g: 'addSub', op: 'sub', a, b }; })()) },
};
