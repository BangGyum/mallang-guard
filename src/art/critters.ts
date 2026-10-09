import { COMBAT_GEAR, combatEyes } from './combatGear';
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

const C = {
  squirrel: () =>
    `<path d="M66 86C92 86 99 58 90 44C83 33 68 36 70 48C72 57 82 62 76 74C73 80 70 82 66 86Z" fill="#DE7B42" ${S(3)}/><path d="M86 45C82 41 76 43 77 48" fill="none" stroke="#F6C08F" stroke-width="3" stroke-linecap="round"/>` +
    roundEars('#E9955A', '#F7B98A', 7, 40, 33) +
    feet('#C97A45') +
    body('#E9955A') +
    belly('#FCE3C8') +
    combatEyes() +
    COMBAT_GEAR.squirrel,
  cat: () =>
    `<path d="M27 52L29 27L46 39Z" fill="#B9C3D6" ${S(3)}/><path d="M73 52L71 27L54 39Z" fill="#B9C3D6" ${S(3)}/><path d="M31 46L32 33L40.5 39.5Z" fill="#FFB3C4"/><path d="M69 46L68 33L59.5 39.5Z" fill="#FFB3C4"/>` +
    feet('#9AA6BC') +
    body('#B9C3D6') +
    belly('#F4F6FA') +
    `<path d="M28 52l7 2M28 58l7 0M72 52l-7 2M72 58l-7 0" ${S(1.8)}/>` +
    combatEyes() +
    COMBAT_GEAR.cat,
  bear: () =>
    roundEars('#A9785A', '#D9A88A') +
    feet('#8E6249') +
    body('#A9785A') +
    belly('#E9CBAF') +
    combatEyes(58) +
    `<ellipse cx="50" cy="67" rx="8.5" ry="6" fill="#F1DCC6" ${S(2.2)}/><ellipse cx="50" cy="64.6" rx="3" ry="2" fill="${OUT}"/><path d="M50 66.5v2.5" ${S(1.8)}/>` +
    COMBAT_GEAR.bear,
  penguin: () =>
    feet('#FFB03B') +
    `<ellipse cx="20" cy="70" rx="5" ry="11" transform="rotate(22 20 70)" fill="#33497A" ${S(3)}/>` +
    body('#3D5486') +
    `<ellipse cx="50" cy="63" rx="22" ry="17" fill="#fff"/>` +
    belly('#fff', 77, 18, 12) +
    combatEyes(59) +
    `<path d="M45.5 64L54.5 64L50 69.5Z" fill="#FFB03B" ${S(2)}/>` +
    COMBAT_GEAR.penguin,
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
      combatEyes(62) +
      COMBAT_GEAR.sheep
    );
  },
  bunny: () =>
    `<g transform="rotate(-9 40 40)"><ellipse cx="40" cy="22" rx="7" ry="18" fill="#FFF7F8" ${S(3)}/><ellipse cx="40" cy="24" rx="3.2" ry="12" fill="#FFB3C4"/></g><g transform="rotate(9 60 40)"><ellipse cx="60" cy="22" rx="7" ry="18" fill="#FFF7F8" ${S(3)}/><ellipse cx="60" cy="24" rx="3.2" ry="12" fill="#FFB3C4"/></g>` +
    feet('#F4D7DC') +
    body('#FFF7F8') +
    combatEyes() +
    COMBAT_GEAR.bunny,
  mole: () =>
    roundEars('#7E6A63', '#C7A99A', 6, 46, 29) +
    feet('#695750') +
    body('#7E6A63') +
    belly('#D9C6B8') +
    combatEyes() +
    `<ellipse cx="50" cy="66.5" rx="4.2" ry="3.2" fill="#FF8FA8" ${S(2)}/>` +
    COMBAT_GEAR.mole,
  snail: () =>
    `<path d="M41 40L36 25M59 40L64 25" ${S(3)}/><circle cx="36" cy="24" r="3.8" fill="#F3E3A0" ${S(2.4)}/><circle cx="64" cy="24" r="3.8" fill="#F3E3A0" ${S(2.4)}/>` +
    `<circle cx="74" cy="56" r="21" fill="#E98CB0" ${S(3)}/><path d="${spiral(74, 56, 2.3, 15)}" fill="none" stroke="#B85C86" stroke-width="2.6" stroke-linecap="round"/>` +
    `<ellipse cx="50" cy="90" rx="33" ry="5.5" fill="#E2CC7E" ${S(3)}/>` +
    body('#F3E3A0') +
    combatEyes() +
    COMBAT_GEAR.snail,
  owl: () =>
    `<path d="M32 61Q18 54 13 64Q16 73 9 81Q18 85 25 81L19 89Q34 91 38 79M68 61Q83 52 89 66Q84 75 92 84Q79 92 66 82" fill="#C5E5DB" ${S(2.5)}/><path d="M22 65Q27 75 21 83M78 65Q72 78 84 84" fill="none" stroke="#8BBCAF" stroke-width="2" stroke-linecap="round"/>` +
    `<path d="M26 47Q19 33 25 23Q30 28 41 38M74 47Q81 33 75 23Q70 28 59 38" fill="#E8D8C2" ${S(2.8)}/>` +
    feet('#D8BE9D') +
    body('#E8D8C2') +
    belly('#FFF5E7') +
    `<path d="M28 55Q13 58 18 73L14 80Q22 81 29 69M72 55Q85 60 82 73L86 80Q76 82 71 69" fill="#F8EEDC" ${S(2.5)}/><circle cx="38" cy="57" r="15" fill="#FFFDF3" ${S(2.2)}/><circle cx="62" cy="57" r="15" fill="#FFFDF3" ${S(2.2)}/>` +
    `<path d="M29 43Q38 29 51 33Q67 31 73 45Q63 39 58 47Q51 38 47 46Q36 38 29 48" fill="#F8EEDC" ${S(2.5)}/><path d="M31 52Q36 48 42 51M58 51Q64 48 69 52" fill="none" ${S(1.8)}/>` +
    `<ellipse cx="38" cy="57" rx="4.1" ry="5.1" fill="#665D8A"/><ellipse cx="62" cy="57" rx="4.1" ry="5.1" fill="#665D8A"/><circle cx="39.3" cy="55.3" r="1.5" fill="#fff"/><circle cx="63.3" cy="55.3" r="1.5" fill="#fff"/><path d="M34 55L30 52M66 55L70 52" fill="none" ${S(1.8)}/><path d="M46 65L54 65L50 71Z" fill="#E8C486" ${S(1.8)}/>` +
    COMBAT_GEAR.owl +
    `<path d="M68 32Q64 23 58 26L60 36L68 36M72 32Q78 24 83 28L80 38L72 36M67 37Q65 44 60 46M73 37Q75 44 82 43" fill="#D8CDED" ${S(2.2)}/><circle cx="70" cy="34" r="3.5" fill="#E8D4A2" ${S(2)}/>`,
  wolf: () =>
    `<path d="M69 86Q95 95 93 68L85 61Q79 62 79 70Q85 78 71 76Z" fill="#AEBBC7" ${S(3)}/><path d="M87 65Q89 78 81 84" fill="none" stroke="#F3EFE2" stroke-width="5" stroke-linecap="round"/><path d="M25 45L26 23L43 38M75 45L74 23L57 38" fill="#AEBBC7" ${S(3)}/><path d="M30 38L30 30L37 37M70 38L70 30L63 37" fill="#D4B8B7"/>` +
    feet('#758798') +
    body('#AEBBC7') +
    belly('#F3EFE2') +
    `<path d="M27 59L20 65L26 69L23 73L34 73M73 59L80 65L74 69L77 73L66 73" fill="#F3EFE2" ${S(2.5)}/>` +
    combatEyes(57) +
    `<path d="M38 63Q50 59 62 63L60 71Q50 77 40 71Z" fill="#F3EFE2" ${S(2.2)}/><path d="M46 63H54L50 67Z" fill="${OUT}"/><path d="M47 69Q50 72 53 69" fill="none" ${S(1.8)}/>` +
    COMBAT_GEAR.wolf,
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
  splitJelly: () =>
    C.jelly().replaceAll('#9B7BFF', '#79B6BD').replaceAll('#8463F0', '#5498A5') +
    `<path d="M48 48L43 60L54 66L47 85" fill="none" stroke="#D3F5EB" stroke-width="4" stroke-linecap="round"/><circle cx="74" cy="82" r="10" fill="#B0DFD6" ${S(2.5)}/>`,
  miniJelly: () =>
    `<g transform="translate(13 23) scale(.74)">${C.jelly().replaceAll('#9B7BFF', '#B0DFD6').replaceAll('#8463F0', '#80BEB9')}</g>`,
  spitter: () =>
    C.jelly().replaceAll('#9B7BFF', '#83A6CC').replaceAll('#8463F0', '#6389B1') +
    `<ellipse cx="50" cy="77" rx="11" ry="8" fill="#BACFE8" ${S(2.5)}/><ellipse cx="50" cy="77" rx="5" ry="4" fill="#506887"/><path d="M74 35Q84 46 74 50Q64 46 74 35Z" fill="#ABC9DF" ${S(2.5)}/>`,
  kingJelly: () =>
    C.jelly().replaceAll('#9B7BFF', '#8B83C8').replaceAll('#8463F0', '#6B63A5') +
    `<path d="M26 46L23 24L39 32L50 15L61 32L77 24L74 46Z" fill="#FFD46B" ${S(3)}/><path d="M28 41H72" stroke="#DCA546" stroke-width="4"/><circle cx="50" cy="35" r="4" fill="#E98CB0" ${S(2)}/>`,
  captainJelly: () =>
    C.jelly().replaceAll('#9B7BFF', '#B49E83').replaceAll('#8463F0', '#8C7B69') +
    `<path d="M26 52L30 28Q50 19 70 28L74 52Z" fill="#849AA5" ${S(3)}/><path d="M50 24L50 12Q68 12 72 23L59 25Z" fill="#D89083" ${S(2.5)}/><path d="M25 45H75" stroke="#E8D3A1" stroke-width="5"/><path d="M14 68L31 60L47 68L45 85L31 95L16 85Z" fill="#A8B7AD" ${S(3)}/><path d="M31 65L34 73L42 74L36 79L37 87L31 83L25 87L26 79L20 74L28 73Z" fill="#F4D99F" ${S(1.5)}/>`,
  dashJelly: () =>
    C.jelly().replaceAll('#9B7BFF', '#E7A18C').replaceAll('#8463F0', '#C87973') +
    `<path d="M25 54Q50 44 75 54" fill="none" stroke="#E5F4ED" stroke-width="7"/><path d="M73 53L92 46L87 59L73 57Z" fill="#81BABC" ${S(2.3)}/><path d="M2 67H15M7 76H17" stroke="#81BABC" stroke-width="3" stroke-linecap="round"/><path d="M23 84H39L37 94H20ZM62 84H77L82 94H64Z" fill="#586D7B" ${S(2.5)}/>`,
  crystalJelly: () =>
    C.jelly().replaceAll('#9B7BFF', '#AEA2D8').replaceAll('#8463F0', '#8E82BE') +
    `<path d="M36 44L29 29L37 18L48 34L50 13L62 26L66 44Z" fill="#CAE7EF" ${S(2.6)}/><path d="M37 20L40 38M51 17L57 40" stroke="#FBFFFF" stroke-width="3"/><path d="M21 69L11 59L14 47L26 59M77 71L90 60L86 46L74 60" fill="#CAE7EF" ${S(2.3)}/>`,
  shieldJelly: () =>
    C.jelly().replaceAll('#9B7BFF', '#82AEC4').replaceAll('#8463F0', '#638EAA') +
    `<path d="M25 52L30 29Q50 20 70 29L75 52Z" fill="#8A9EAD" ${S(3)}/><path d="M34 42H66" stroke="#D5E8E9" stroke-width="4"/><path d="M62 62L84 53L96 64L92 83L78 94L62 82Z" fill="#A3D7E2" ${S(3)}/><path d="M79 61V83M68 70H88" stroke="#F7FFFF" stroke-width="4"/>`,
  sproutJelly: () =>
    C.jelly().replaceAll('#9B7BFF', '#91BD9D').replaceAll('#8463F0', '#6B9E87') +
    `<path d="M50 47V24" stroke="#477B62" stroke-width="4"/><path d="M49 34Q25 34 25 16Q47 14 49 34ZM51 30Q51 11 75 14Q76 35 51 30Z" fill="#BDDDB0" ${S(2.5)}/><path d="M33 22L46 30M69 20L55 28" fill="none" stroke="#6EA886" stroke-width="2"/><path d="M31 83H40M65 80H74" stroke="#E5F4D7" stroke-width="4" stroke-linecap="round"/>`,
  flowerJelly: () =>
    C.jelly().replaceAll('#9B7BFF', '#D7A5B6').replaceAll('#8463F0', '#B982A1') +
    `<g fill="#F4DDE0" ${S(2.3)}><ellipse cx="50" cy="21" rx="9" ry="13"/><ellipse cx="35" cy="32" rx="13" ry="9"/><ellipse cx="65" cy="32" rx="13" ry="9"/><ellipse cx="41" cy="43" rx="9" ry="11"/><ellipse cx="59" cy="43" rx="9" ry="11"/></g><circle cx="50" cy="32" r="8" fill="#EDD393" ${S(2.3)}/><path d="M79 64V48M73 54H85" stroke="#CBE7D1" stroke-width="6" stroke-linecap="round"/>`,
  drummerJelly: () =>
    C.jelly().replaceAll('#9B7BFF', '#C9A889').replaceAll('#8463F0', '#A38376') +
    `<path d="M29 47L29 30L71 30L71 47Z" fill="#647D8D" ${S(2.5)}/><path d="M49 30V14L61 20L49 24" fill="#CBE4D6" ${S(2)}/><path d="M21 69H79V89H21Z" fill="#CC996B" ${S(2.8)}/><ellipse cx="50" cy="69" rx="29" ry="8" fill="#F0E4C7" ${S(2.5)}/><path d="M31 75L40 86L49 75L59 86L69 75" fill="none" stroke="#E7CF9E" stroke-width="3"/><path d="M12 57L33 68M88 57L67 68" stroke="#607C8B" stroke-width="4" stroke-linecap="round"/>`,
  nestJelly: () =>
    C.jelly().replaceAll('#9B7BFF', '#ACB6A2').replaceAll('#8463F0', '#869887') +
    `<path d="M24 47L21 30L37 35L46 23L57 34L78 29L75 47Z" fill="#AA866E" ${S(2.8)}/><path d="M27 39L70 44M31 47L65 34" stroke="#D6BA8E" stroke-width="3"/><ellipse cx="43" cy="28" rx="8" ry="11" fill="#DEECD0" ${S(2.2)}/><ellipse cx="59" cy="28" rx="8" ry="11" fill="#D1E5D6" ${S(2.2)}/><circle cx="76" cy="79" r="12" fill="#B0DFD6" ${S(2.4)}/><circle cx="72" cy="78" r="2" fill="${OUT}"/><circle cx="80" cy="78" r="2" fill="${OUT}"/>`,
  armoredCrow: () =>
    C.crow().replaceAll('#44485E', '#657887').replaceAll('#383B50', '#4F6374') +
    `<path d="M30 53L31 32Q50 22 69 32L70 53Z" fill="#A3B3BF" ${S(3)}/><path d="M31 42H69M50 30V48" stroke="#D9E4E6" stroke-width="3"/><path d="M24 59L11 51L8 64L25 71M76 59L89 51L92 64L75 71" fill="#A3B3BF" ${S(2.5)}/><path d="M38 79L50 72L62 79L57 88H43Z" fill="#C5D3D8" ${S(2.5)}/>`,
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
