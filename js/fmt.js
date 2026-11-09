// Central number formatting: every visible number goes through ar()/num().
export const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';
export const ar = (v) => String(v).replace(/[0-9]/g, (d) => AR_DIGITS[+d]);
// user input (Latin, Eastern or Persian digits) -> Latin string
export const toLatin = (s) => String(s)
  .replace(/[٠-٩]/g, (d) => AR_DIGITS.indexOf(d))
  .replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d));
// a number isolated from the surrounding RTL text; digits keep tens-left / ones-right order
export const num = (n, cls = '') => `<bdi class="num ${cls}" dir="ltr">${ar(n)}</bdi>`;
export const fmtDate = (d) => {
  try { return new Intl.DateTimeFormat('ar-u-nu-arab', { day: 'numeric', month: 'long' }).format(d); }
  catch (e) { return ar(`${d.getDate()}/${d.getMonth() + 1}`); }
};
export const todayKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const tensOnes = (n) => [Math.floor(n / 10), n % 10];
export const reversed = (n) => { const [t, o] = tensOnes(n); return o * 10 + t; };
export const rint = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
export const shuffle = (arr) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/** Number-card choices for target n: one correct + distinct distractors that reveal specific errors
 * (digit reversal, off-by-one in the ones). Every set has exactly one correct card. */
export function numberChoices(n, { count = 3, lo = 0, hi = 99, extra = [] } = {}) {
  const cand = [];
  const r = reversed(n);
  if (n >= 10 && r !== n && n % 10 !== 0) cand.push(r);
  cand.push(...extra, n + 1, n - 1, n + 2, n - 2);
  const out = [n];
  for (const c of cand) {
    if (out.length >= count) break;
    if (c >= lo && c <= hi && !out.includes(c)) out.push(c);
  }
  return shuffle(out);
}
