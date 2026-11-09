// New-design manipulatives: big glossy SVG balloons, pencils, eggs, egg cartons, gift box, garden plants.
const BAL = ['#ff5d8f', '#ffb020', '#3fb6ff', '#7c5cff', '#2fd19a', '#ff7a45', '#ff4fd8', '#25c7c7', '#ffd23f', '#ff6b6b'];
const PEN = ['#ff5252', '#ffb300', '#43a047', '#1e88e5', '#8e24aa', '#f4511e', '#00acc1', '#d81b60', '#7cb342', '#5e35b1'];
const EGG = ['#fff3e0', '#ffe0b2', '#fbe9e7', '#fff8e1'];
let uid = 0;
export const bcol = (i) => BAL[((i % 10) + 10) % 10];

export function balloon(i, { string = true } = {}) {
  const c = bcol(i), id = 'bg' + (uid++);
  return `<svg viewBox="0 0 60 92" class="a-balloon" aria-hidden="true"><defs><radialGradient id="${id}" cx="35%" cy="30%" r="75%"><stop offset="0" stop-color="#fff" stop-opacity=".85"/><stop offset=".18" stop-color="${c}"/><stop offset="1" stop-color="${c}" stop-opacity=".92"/></radialGradient></defs>
  ${string ? '<path class="str" d="M30 64 C 24 72, 36 78, 29 91" stroke="#8d6e63" stroke-width="1.6" fill="none"/>' : ''}
  <ellipse cx="30" cy="31" rx="24" ry="29" fill="url(#${id})"/><path d="M26 59 L30 65 L34 59 Z" fill="${c}"/><ellipse cx="21" cy="19" rx="6" ry="9" fill="#fff" opacity=".45" transform="rotate(-20 21 19)"/></svg>`;
}
export function pencil(i) {
  const c = PEN[((i % 10) + 10) % 10];
  return `<svg viewBox="0 0 24 130" class="a-pencil" aria-hidden="true"><rect x="3" y="2" width="18" height="14" rx="5" fill="#f48fb1"/><rect x="3" y="14" width="18" height="9" fill="#cfd8dc"/><rect x="3" y="16" width="18" height="2" fill="#90a4ae"/><rect x="3" y="21" width="18" height="2" fill="#90a4ae"/>
  <rect x="3" y="23" width="18" height="80" fill="${c}"/><rect x="3" y="23" width="6" height="80" fill="#fff" opacity=".25"/><rect x="15" y="23" width="6" height="80" fill="#000" opacity=".12"/>
  <path d="M3 103 L21 103 L12 126 Z" fill="#ffcc80"/><path d="M9 118 L15 118 L12 126 Z" fill="#424242"/></svg>`;
}
export function egg(i) {
  const id = 'eg' + (uid++); const c = EGG[((i % 4) + 4) % 4];
  return `<svg viewBox="0 0 50 62" class="a-egg" aria-hidden="true"><defs><radialGradient id="${id}" cx="38%" cy="30%" r="80%"><stop offset="0" stop-color="#fff"/><stop offset=".5" stop-color="${c}"/><stop offset="1" stop-color="#e0c3a0"/></radialGradient></defs><path d="M25 3 C 9 3, 3 30, 4 40 C 5 54, 15 60, 25 60 C 35 60, 45 54, 46 40 C 47 30, 41 3, 25 3 Z" fill="url(#${id})"/></svg>`;
}
export function bead(i) {
  const c = bcol(i + 3), id = 'bd' + (uid++);
  return `<svg viewBox="0 0 50 50" class="a-bead" aria-hidden="true"><defs><radialGradient id="${id}" cx="35%" cy="30%" r="75%"><stop offset="0" stop-color="#fff" stop-opacity=".9"/><stop offset=".25" stop-color="${c}"/><stop offset="1" stop-color="${c}"/></radialGradient></defs><circle cx="25" cy="25" r="22" fill="url(#${id})"/></svg>`;
}
export const piece = { balloon, pencil, egg, bead };

// ribbon bow that ties a bundle (drawn with an animation when the ten forms)
export const bow = () => `<svg viewBox="0 0 80 40" class="a-bow" aria-hidden="true"><path class="bw" d="M40 20 C 20 0, 4 6, 8 20 C 4 34, 20 40, 40 20 Z" fill="#e91e63"/><path class="bw" d="M40 20 C 60 0, 76 6, 72 20 C 76 34, 60 40, 40 20 Z" fill="#e91e63"/><circle cx="40" cy="20" r="7" fill="#c2185b"/><path d="M36 25 L28 39 M44 25 L52 39" stroke="#c2185b" stroke-width="5" stroke-linecap="round"/></svg>`;
export const strings = () => `<svg viewBox="0 0 100 100" preserveAspectRatio="none" class="a-strings" aria-hidden="true">${[10, 30, 50, 70, 90, 20, 40, 60, 80, 50].map((x, i) => `<path d="M${x} ${i < 5 ? 30 : 55} Q ${(x + 50) / 2} 80, 50 98" stroke="#8d6e63" stroke-width="1" fill="none" vector-effect="non-scaling-stroke"/>`).join('')}</svg>`;
export const gift = () => `<svg viewBox="0 0 160 160" class="a-gift" aria-hidden="true"><g class="lid"><rect x="18" y="38" width="124" height="30" rx="8" fill="#ff4f8b"/><rect x="72" y="38" width="16" height="30" fill="#ffd23f"/><path d="M80 38 C 60 6, 30 14, 46 34 Z M80 38 C 100 6, 130 14, 114 34 Z" fill="#ffd23f"/></g><rect x="28" y="66" width="104" height="80" rx="10" fill="#7c5cff"/><rect x="72" y="66" width="16" height="80" fill="#ffd23f"/><rect x="28" y="66" width="104" height="10" fill="#000" opacity=".08"/></svg>`;
export const flower = (i) => { const c = BAL[(i * 3) % 10]; return `<svg viewBox="0 0 40 56" class="a-flower" aria-hidden="true"><path d="M20 30 V54" stroke="#2e7d32" stroke-width="3"/><path d="M20 46 C 12 40, 8 44, 6 48 C 12 50, 16 50, 20 46 Z" fill="#43a047"/>${[0, 72, 144, 216, 288].map((a) => `<ellipse cx="20" cy="12" rx="6" ry="9" fill="${c}" transform="rotate(${a} 20 20)"/>`).join('')}<circle cx="20" cy="20" r="6" fill="#ffd23f"/></svg>`; };
export const tree = () => `<svg viewBox="0 0 90 120" class="a-tree" aria-hidden="true"><rect x="38" y="70" width="14" height="46" rx="4" fill="#8d6e63"/><circle cx="45" cy="44" r="34" fill="#43a047"/><circle cx="28" cy="58" r="20" fill="#388e3c"/><circle cx="62" cy="58" r="20" fill="#2e7d32"/><circle cx="34" cy="32" r="6" fill="#ff5252"/><circle cx="58" cy="40" r="6" fill="#ff5252"/><circle cx="46" cy="58" r="6" fill="#ff5252"/></svg>`;
