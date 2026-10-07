import { ART_COLORS } from './palette';

const OUT = ART_COLORS.outline;
const S = (w: number) => `stroke="${OUT}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"`;
const BODY = 'M50 34C72 34 82 52 81 67C80 83 68 91 50 91C32 91 20 83 19 67C18 52 28 34 50 34Z';
const eyes = (y = 60, dx = 10, r = 1) =>
  [50 - dx, 50 + dx]
    .map(
      (x) =>
        `<ellipse cx="${x}" cy="${y}" rx="${4.3 * r}" ry="${5.4 * r}" fill="#2A1E2C"/><circle cx="${x + 1.6 * r}" cy="${y - 2 * r}" r="${1.8 * r}" fill="#fff"/>`,
    )
    .join('');
const blush = (y = 68) =>
  `<ellipse cx="31" cy="${y}" rx="5.5" ry="3.2" fill="#FF8FA8" opacity=".75"/><ellipse cx="69" cy="${y}" rx="5.5" ry="3.2" fill="#FF8FA8" opacity=".75"/>`;
const mouth = `<path d="M45.5 66.5q2.25 2.8 4.5 0q2.25 2.8 4.5 0" fill="none" ${S(2.2)}/>`;
const feet = (c: string) =>
  `<ellipse cx="38" cy="90" rx="8" ry="4.5" fill="${c}" ${S(3)}/><ellipse cx="62" cy="90" rx="8" ry="4.5" fill="${c}" ${S(3)}/>`;
const body = (c: string) => `<path d="${BODY}" fill="${c}" ${S(3.2)}/>`;
const belly = (c: string, cy = 75, rx = 17, ry = 12.5) =>
  `<ellipse cx="50" cy="${cy}" rx="${rx}" ry="${ry}" fill="${c}"/>`;
const roundEars = (b: string, i: string, r = 9.5, y = 40, x = 31) =>
  `<circle cx="${x}" cy="${y}" r="${r}" fill="${b}" ${S(3)}/><circle cx="${100 - x}" cy="${y}" r="${r}" fill="${b}" ${S(3)}/><circle cx="${x}" cy="${y}" r="${r * 0.5}" fill="${i}"/><circle cx="${100 - x}" cy="${y}" r="${r * 0.5}" fill="${i}"/>`;
function spiral(cx: number, cy: number, turns: number, maxR: number) {
  let d = '';
  const n = 60;
  for (let k = 0; k <= n; k++) {
    const t = k / n;
    const a = t * turns * 2 * Math.PI;
    const r = 2 + t * maxR;
    d += `${(k ? 'L' : 'M') + (cx + r * Math.cos(a)).toFixed(1)} ${(cy + r * Math.sin(a)).toFixed(1)}`;
  }
  return d;
}
function star(cx: number, cy: number, R: number, r: number) {
  let d = '';
  for (let k = 0; k < 10; k++) {
    const a = -Math.PI / 2 + (k * Math.PI) / 5;
    const rr = k % 2 ? r : R;
    d += `${(k ? 'L' : 'M') + (cx + rr * Math.cos(a)).toFixed(1)} ${(cy + rr * Math.sin(a)).toFixed(1)}`;
  }
  return `${d}Z`;
}

const C = {
  squirrel: () =>
    `<path d="M66 86C92 86 99 58 90 44C83 33 68 36 70 48C72 57 82 62 76 74C73 80 70 82 66 86Z" fill="#DE7B42" ${S(3)}/><path d="M86 45C82 41 76 43 77 48" fill="none" stroke="#F6C08F" stroke-width="3" stroke-linecap="round"/>` +
    roundEars('#E9955A', '#F7B98A', 7, 40, 33) +
    feet('#C97A45') +
    body('#E9955A') +
    belly('#FCE3C8') +
    eyes() +
    blush() +
    mouth +
    `<ellipse cx="24" cy="77" rx="6.5" ry="7.5" fill="#C98B4A" ${S(2.6)}/><path d="M16.5 73Q24 65 31.5 73Z" fill="#7A5230" ${S(2.6)}/><path d="M24 67l1.5-3.5" ${S(2.6)}/>`,
  cat: () =>
    `<path d="M27 52L29 27L46 39Z" fill="#B9C3D6" ${S(3)}/><path d="M73 52L71 27L54 39Z" fill="#B9C3D6" ${S(3)}/><path d="M31 46L32 33L40.5 39.5Z" fill="#FFB3C4"/><path d="M69 46L68 33L59.5 39.5Z" fill="#FFB3C4"/>` +
    feet('#9AA6BC') +
    body('#B9C3D6') +
    belly('#F4F6FA') +
    `<path d="M28 52l7 2M28 58l7 0M72 52l-7 2M72 58l-7 0" ${S(1.8)}/>` +
    eyes() +
    blush() +
    mouth +
    `<g transform="rotate(-32 80 76)"><rect x="77" y="46" width="6" height="28" rx="3" fill="#E9EEF2" ${S(2.6)}/><rect x="72.5" y="72" width="15" height="5" rx="2.5" fill="#F2C14E" ${S(2.6)}/><rect x="77.5" y="77" width="5" height="9" rx="2.5" fill="#8A5A3B" ${S(2.6)}/></g>`,
  bear: () =>
    roundEars('#A9785A', '#D9A88A') +
    feet('#8E6249') +
    body('#A9785A') +
    belly('#E9CBAF') +
    eyes(58) +
    blush(67) +
    `<ellipse cx="50" cy="67" rx="8.5" ry="6" fill="#F1DCC6" ${S(2.2)}/><ellipse cx="50" cy="64.6" rx="3" ry="2" fill="${OUT}"/><path d="M50 66.5v2.5" ${S(1.8)}/>` +
    `<circle cx="27" cy="76" r="15.5" fill="#C7D3DC" ${S(3)}/><circle cx="27" cy="76" r="10" fill="none" stroke="#9FB0BE" stroke-width="2"/><circle cx="27" cy="76" r="3.6" fill="#6E7F8E" ${S(2)}/>`,
  penguin: () =>
    feet('#FFB03B') +
    `<ellipse cx="20" cy="70" rx="5" ry="11" transform="rotate(22 20 70)" fill="#33497A" ${S(3)}/>` +
    body('#3D5486') +
    `<ellipse cx="50" cy="63" rx="22" ry="17" fill="#fff"/>` +
    belly('#fff', 77, 18, 12) +
    eyes(59) +
    blush(67) +
    `<path d="M45.5 64L54.5 64L50 69.5Z" fill="#FFB03B" ${S(2)}/><path d="M29 76Q50 85 71 76" fill="none" stroke="#E5466B" stroke-width="5.5" stroke-linecap="round"/><path d="M62 79l4 9" stroke="#E5466B" stroke-width="5" stroke-linecap="round"/><ellipse cx="80" cy="70" rx="5" ry="11" transform="rotate(-22 80 70)" fill="#33497A" ${S(3)}/><circle cx="82" cy="78" r="7.5" fill="#fff" ${S(2.6)}/><circle cx="80" cy="76" r="2" fill="#DDEBFF"/>`,
  sheep: () => {
    const W = [
      [34, 42, 10],
      [50, 36, 11],
      [66, 42, 10],
      [25, 54, 7],
      [75, 54, 7],
    ];
    return (
      feet('#B89A7E') +
      body('#F3E3CF') +
      `<ellipse cx="21" cy="60" rx="7" ry="3.6" fill="#D8BFA3" ${S(2.6)}/><ellipse cx="79" cy="60" rx="7" ry="3.6" fill="#D8BFA3" ${S(2.6)}/>` +
      W.map(
        (w) =>
          `<circle cx="${w[0]}" cy="${w[1]}" r="${w[2]}" fill="${OUT}" stroke="${OUT}" stroke-width="6"/>`,
      ).join('') +
      W.map((w) => `<circle cx="${w[0]}" cy="${w[1]}" r="${w[2]}" fill="#FFFDF7"/>`).join('') +
      eyes(62) +
      blush(70) +
      `<path d="M45.5 68.5q2.25 2.8 4.5 0q2.25 2.8 4.5 0" fill="none" ${S(2.2)}/>` +
      `<path d="M76 90L85 62" stroke="${OUT}" stroke-width="7.5" stroke-linecap="round"/><path d="M76 90L85 62" stroke="#A9744F" stroke-width="3.8" stroke-linecap="round"/><path d="${star(86, 57, 10, 4.6)}" fill="#FFD45C" ${S(2.6)}/>`
    );
  },
  bunny: () =>
    `<g transform="rotate(-9 40 40)"><ellipse cx="40" cy="22" rx="7" ry="18" fill="#FFF7F8" ${S(3)}/><ellipse cx="40" cy="24" rx="3.2" ry="12" fill="#FFB3C4"/></g><g transform="rotate(9 60 40)"><ellipse cx="60" cy="22" rx="7" ry="18" fill="#FFF7F8" ${S(3)}/><ellipse cx="60" cy="24" rx="3.2" ry="12" fill="#FFB3C4"/></g>` +
    feet('#F4D7DC') +
    body('#FFF7F8') +
    eyes() +
    blush() +
    mouth +
    `<path d="M38 42Q38 31 50 31Q62 31 62 42Z" fill="#fff" ${S(2.6)}/><path d="M50 33.8v5.4M47.3 36.5h5.4" stroke="#E5466B" stroke-width="2.4" stroke-linecap="round"/><g transform="rotate(18 80 78)"><path d="M75 69L85 69L80 90Z" fill="#FF9A3C" ${S(2.6)}/><path d="M78 69l-3-6M80 69v-7M82 69l3-6" stroke="#3FA66B" stroke-width="2.6" stroke-linecap="round"/></g>`,
  mole: () =>
    roundEars('#7E6A63', '#C7A99A', 6, 46, 29) +
    feet('#695750') +
    body('#7E6A63') +
    belly('#D9C6B8') +
    `<path d="M36 61q4-5 8 0M56 61q4-5 8 0" fill="none" ${S(2.6)}/>` +
    blush(67) +
    `<ellipse cx="50" cy="66.5" rx="4.2" ry="3.2" fill="#FF8FA8" ${S(2)}/>` +
    `<path d="M29 47Q29 26 50 26Q71 26 71 47Z" fill="#FFC94A" ${S(3)}/><rect x="25" y="44" width="50" height="6.5" rx="3.2" fill="#F2A916" ${S(2.6)}/><circle cx="50" cy="34" r="5" fill="#FFF7C2" ${S(2.2)}/>` +
    `<path d="M80 90L82 62" stroke="${OUT}" stroke-width="7" stroke-linecap="round"/><path d="M80 90L82 62" stroke="#A9744F" stroke-width="3.6" stroke-linecap="round"/><path d="M75 61Q82 45 89 61Q82 67 75 61Z" fill="#C9D2DA" ${S(2.6)}/>`,
  snail: () =>
    `<path d="M41 40L36 25M59 40L64 25" ${S(3)}/><circle cx="36" cy="24" r="3.8" fill="#F3E3A0" ${S(2.4)}/><circle cx="64" cy="24" r="3.8" fill="#F3E3A0" ${S(2.4)}/>` +
    `<circle cx="74" cy="56" r="21" fill="#E98CB0" ${S(3)}/><path d="${spiral(74, 56, 2.3, 15)}" fill="none" stroke="#B85C86" stroke-width="2.6" stroke-linecap="round"/>` +
    `<ellipse cx="50" cy="90" rx="33" ry="5.5" fill="#E2CC7E" ${S(3)}/>` +
    body('#F3E3A0') +
    eyes() +
    blush() +
    mouth,
  jelly: () =>
    `<path d="M17 90C13 66 29 43 50 43C71 43 87 66 83 90Z" fill="#9B7BFF" ${S(3.2)}/><path d="M24 90C24 84 76 84 76 90" fill="#8463F0" opacity=".6"/><ellipse cx="36" cy="57" rx="7" ry="3.2" fill="#fff" opacity=".55" transform="rotate(-28 36 57)"/>` +
    eyes(69, 9, 0.85) +
    `<path d="M34 60.5l9.5 3.5M66 60.5l-9.5 3.5" ${S(2.8)}/><path d="M45 79q5-3.8 10 0" fill="none" ${S(2.4)}/><path d="M50 43q2-8 8-9" fill="none" stroke="#3FA66B" stroke-width="3" stroke-linecap="round"/>`,
  crow: () =>
    `<path d="M32 60C14 46 6 64 20 74C26 76 30 72 32 68Z" fill="#383B50" ${S(3)}/><path d="M68 60C86 46 94 64 80 74C74 76 70 72 68 68Z" fill="#383B50" ${S(3)}/><circle cx="50" cy="64" r="22" fill="#44485E" ${S(3.2)}/><ellipse cx="50" cy="73" rx="13" ry="9" fill="#6B7090"/><path d="M44 42q6-8 12 0" fill="none" stroke="#383B50" stroke-width="4" stroke-linecap="round"/><circle cx="42" cy="60" r="5.2" fill="#fff"/><circle cx="58" cy="60" r="5.2" fill="#fff"/><circle cx="43" cy="61" r="2.6" fill="#2A1E2C"/><circle cx="57" cy="61" r="2.6" fill="#2A1E2C"/><path d="M35 53l10 3M65 53l-10 3" ${S(2.8)}/><path d="M45 66L55 66L50 73Z" fill="#FFC94A" ${S(2.2)}/>`,
  hardJelly: () =>
    C.jelly().replaceAll('#9B7BFF', '#6E8BE8').replaceAll('#8463F0', '#5574D1') +
    '<path d="M25 57L28 29Q50 22 72 29L75 57Z" fill="#B8C2CE" ' +
    S(3) +
    '/><path d="M27 48H73" stroke="#8A99AA" stroke-width="3"/>' +
    [34, 50, 66].map((x) => `<circle cx="${x}" cy="50" r="2" fill="#6E7F8E"/>`).join(''),
  pudding: () =>
    '<ellipse cx="50" cy="90" rx="38" ry="7" fill="#fff" ' +
    S(3) +
    '/><path d="M26 88L32 52Q50 44 68 52L74 88Z" fill="#FFD77A" ' +
    S(3.2) +
    '/><path d="M32 52Q50 44 68 52L66 62Q58 70 50 62Q42 70 34 62Z" fill="#9A5A2E" ' +
    S(3) +
    '/><circle cx="50" cy="44" r="6" fill="#E5466B" ' +
    S(2.6) +
    '/>' +
    eyes(75, 10, 0.75) +
    blush(82),
};
export type CritterId = keyof typeof C;
export const CRITTER_IDS = Object.keys(C) as CritterId[];
export const CRITTER_ANCHOR = { x: 50, y: 93 };
export function critterSvg(id: CritterId): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="256" height="256" aria-hidden="true">${C[id]()}</svg>`;
}
