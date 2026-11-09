// Simple original SVG drawings (no external images)
const C = ['#ff6b8a', '#4aa8ff', '#ffc93c', '#5bd08a', '#b07cff', '#ff9f43'];
export const color = (i) => C[i % C.length];

export const pencil = (i = 0) => `<svg viewBox="0 0 20 64" class="art pencil"><rect x="4" y="10" width="12" height="44" rx="2" fill="${color(i)}"/><rect x="4" y="6" width="12" height="6" rx="2" fill="#f4a3b5"/><polygon points="4,54 16,54 10,63" fill="#f3d6a4"/><polygon points="8.5,60 11.5,60 10,63" fill="#333"/></svg>`;
export const bead = (i = 0) => `<svg viewBox="0 0 30 30" class="art bead"><circle cx="15" cy="15" r="13" fill="${color(i)}"/><circle cx="10" cy="10" r="4" fill="#fff" opacity=".55"/></svg>`;
export const egg = () => `<svg viewBox="0 0 30 36" class="art egg"><ellipse cx="15" cy="19" rx="12" ry="15" fill="#fff4e0" stroke="#e0c49a" stroke-width="1.5"/><ellipse cx="11" cy="13" rx="3" ry="5" fill="#fff" opacity=".8"/></svg>`;
export const balloon = (i = 0) => `<svg viewBox="0 0 30 60" class="art balloon"><ellipse cx="15" cy="14" rx="12" ry="14" fill="${color(i)}"/><ellipse cx="11" cy="9" rx="3" ry="4" fill="#fff" opacity=".5"/><polygon points="13,27 17,27 15,30" fill="${color(i)}"/><path d="M15 30 Q11 40 15 48 T15 60" stroke="#777" fill="none" stroke-width="1.2"/></svg>`;
export const apple = () => `<svg viewBox="0 0 32 32" class="art apple"><path d="M16 9c-6-4-13 0-12 8 1 9 7 13 12 11 5 2 11-2 12-11 1-8-6-12-12-8z" fill="#e94b4b"/><path d="M16 9c0-3 1-5 4-7" stroke="#6b4" stroke-width="2.5" fill="none"/></svg>`;
export const bird = () => `<svg viewBox="0 0 36 30" class="art bird"><ellipse cx="17" cy="17" rx="12" ry="9" fill="#4aa8ff"/><circle cx="26" cy="11" r="6" fill="#4aa8ff"/><circle cx="27.5" cy="10" r="1.5" fill="#222"/><polygon points="32,11 36,12.5 32,14" fill="#ffb02e"/><path d="M9 15 Q15 8 20 16" fill="#2f86d6"/></svg>`;
export const star = (cls = '') => `<svg viewBox="0 0 24 24" class="art star ${cls}"><path d="M12 2l3 6.5 7 .8-5.2 4.8 1.5 7L12 17.6 5.7 21l1.5-7L2 9.3l7-.8z" fill="#ffc93c" stroke="#e5a400" stroke-width="1"/></svg>`;
export const flower = (i = 0) => `<svg viewBox="0 0 30 46" class="art flower"><path d="M15 22 V46" stroke="#4caf50" stroke-width="3"/><ellipse cx="9" cy="36" rx="5" ry="2.5" fill="#66bb6a"/>${[0, 72, 144, 216, 288].map(a => `<ellipse cx="15" cy="8" rx="5" ry="7" fill="${color(i)}" transform="rotate(${a} 15 15)"/>`).join('')}<circle cx="15" cy="15" r="4.5" fill="#ffd54f"/></svg>`;
export const tree = () => `<svg viewBox="0 0 60 80" class="art tree"><rect x="25" y="45" width="10" height="35" fill="#8d6e63"/><circle cx="30" cy="30" r="24" fill="#66bb6a"/><circle cx="18" cy="36" r="5" fill="#e94b4b"/><circle cx="40" cy="24" r="5" fill="#e94b4b"/><circle cx="34" cy="42" r="5" fill="#e94b4b"/></svg>`;

// bundles (ten tied together)
export const pencilBundle = () => `<svg viewBox="0 0 64 70" class="art bundle"><g>${Array.from({ length: 10 }, (_, i) => `<g transform="translate(${2 + i * 5.6} ${i % 2 ? 2 : 0})"><rect x="0" y="8" width="6" height="48" rx="1.5" fill="${color(i)}"/><polygon points="0,56 6,56 3,63" fill="#f3d6a4"/></g>`).join('')}</g><rect x="0" y="28" width="64" height="9" rx="3" fill="#c0392b"/><rect x="26" y="25" width="12" height="15" rx="3" fill="#e74c3c"/></svg>`;
export const balloonBundle = () => `<svg viewBox="0 0 80 90" class="art bundle">${Array.from({ length: 10 }, (_, i) => { const x = 10 + (i % 5) * 15, y = 8 + Math.floor(i / 5) * 20; return `<path d="M${x} ${y + 12} L40 72" stroke="#888" stroke-width="1"/><ellipse cx="${x}" cy="${y}" rx="8" ry="10" fill="${color(i)}"/>`; }).join('')}<rect x="34" y="68" width="12" height="8" rx="3" fill="#c0392b"/><path d="M40 76 L40 90" stroke="#888" stroke-width="1.2"/></svg>`;
export const tenString = (i = 0) => `<svg viewBox="0 0 26 250" class="art tenstring"><path d="M13 2 V248" stroke="#888" stroke-width="2"/>${Array.from({ length: 10 }, (_, k) => `<circle cx="13" cy="${14 + k * 24}" r="11" fill="${color(i)}"/>`).join('')}</svg>`;

// companions (female voiced): cat, bird, bee
export const companions = {
  1: { name: 'لولو', clip: 'c_hi_1', svg: `<svg viewBox="0 0 100 100" class="comp"><circle cx="50" cy="56" r="34" fill="#ffb74d"/><polygon points="22,36 28,8 44,28" fill="#ffb74d"/><polygon points="78,36 72,8 56,28" fill="#ffb74d"/><circle cx="38" cy="52" r="5" fill="#333"/><circle cx="62" cy="52" r="5" fill="#333"/><ellipse cx="50" cy="64" rx="5" ry="3.5" fill="#e57373"/><path class="mouth" d="M42 72 Q50 79 58 72" stroke="#333" stroke-width="3" fill="none"/><path d="M18 62 H34 M18 68 H34 M66 62 H82 M66 68 H82" stroke="#8d6e63" stroke-width="2"/></svg>` },
  2: { name: 'سكّرة', clip: 'c_hi_2', svg: `<svg viewBox="0 0 100 100" class="comp"><ellipse cx="50" cy="58" rx="34" ry="30" fill="#4fc3f7"/><ellipse cx="30" cy="62" rx="14" ry="18" fill="#29b6f6"/><circle cx="40" cy="48" r="5" fill="#333"/><circle cx="60" cy="48" r="5" fill="#333"/><polygon class="mouth" points="44,58 56,58 50,68" fill="#ffb02e"/><path d="M44 26 Q50 14 56 26" fill="#e91e63"/></svg>` },
  3: { name: 'نونا', clip: 'c_hi_3', svg: `<svg viewBox="0 0 100 100" class="comp"><ellipse cx="30" cy="34" rx="16" ry="12" fill="#e3f2fd" opacity=".9"/><ellipse cx="70" cy="34" rx="16" ry="12" fill="#e3f2fd" opacity=".9"/><ellipse cx="50" cy="60" rx="32" ry="28" fill="#ffd54f"/><rect x="24" y="58" width="52" height="7" fill="#5d4037"/><rect x="28" y="72" width="44" height="6" fill="#5d4037"/><circle cx="40" cy="48" r="5" fill="#333"/><circle cx="60" cy="48" r="5" fill="#333"/><path class="mouth" d="M43 54 Q50 60 57 54" stroke="#333" stroke-width="3" fill="none"/></svg>` },
};

// story characters (simple faces)
const face = (skin, hair, extra = '') => `<svg viewBox="0 0 80 100" class="ch"><rect x="18" y="58" width="44" height="40" rx="14" fill="${extra || '#7986cb'}"/><circle cx="40" cy="36" r="24" fill="${skin}"/>${hair}<circle cx="32" cy="36" r="3" fill="#333"/><circle cx="48" cy="36" r="3" fill="#333"/><path class="mouth" d="M33 46 Q40 52 47 46" stroke="#333" stroke-width="2.5" fill="none"/></svg>`;
export const chars = {
  man: face('#f1c27d', '<path d="M16 32 Q40 0 64 32 Q40 18 16 32" fill="#3e2723"/><path d="M28 50 Q40 60 52 50 Q40 66 28 50" fill="#3e2723"/>', '#8d6e63'),
  woman: face('#f1c27d', '<path d="M14 40 Q14 6 40 8 Q66 6 66 40 L66 70 L58 66 Q60 30 40 22 Q20 30 22 66 L14 70z" fill="#5c6bc0"/>', '#5c6bc0'),
  grandma: face('#e0ac69', '<path d="M14 40 Q14 6 40 8 Q66 6 66 40 L66 70 L58 66 Q60 30 40 22 Q20 30 22 66 L14 70z" fill="#eeeeee"/>', '#8e24aa'),
  boy: face('#f1c27d', '<path d="M18 30 Q40 6 62 30 Q40 20 18 30" fill="#212121"/>', '#43a047'),
  girl: face('#f1c27d', '<path d="M14 40 Q14 6 40 8 Q66 6 66 40 L66 70 L58 66 Q60 30 40 22 Q20 30 22 66 L14 70z" fill="#ec407a"/>', '#ec407a'),
};
