import { ART_COLORS } from './palette';

const star = '<path d="M32 5L39 23L59 24L43 37L48 57L32 46L16 57L21 37L5 24L25 23Z"';
const drawings = {
  bullet:
    '<path d="M6 26H43L60 32L43 38H6Z" fill="#FFE2A0"/><path d="M15 32H49" stroke="#fff" stroke-width="4"/>',
  iceRound:
    '<path d="M4 25H43L61 32L43 39H4Z" fill="#8DDDFA"/><path d="M17 32H52" stroke="#F5FFFF" stroke-width="5"/>',
  arcBolt:
    '<path d="M3 30L21 19L40 25L59 32L40 39L21 45Z" fill="#B3C8FF"/><path d="M17 32H52" stroke="#F4F5FF" stroke-width="5"/>',
  railRound:
    '<g stroke="none"><path d="M0 23L45 27L64 32L45 37L0 41L15 32Z" fill="#EFAB57" opacity=".5"/><path d="M3 29H48L64 32L48 35H3Z" fill="#FFD386"/><path d="M15 31H53L61 32L53 33H15Z" fill="#FFFFFF"/></g>',
  plasma:
    '<g stroke="none"><ellipse cx="37" cy="32" rx="25" ry="19" fill="#9299EC" opacity=".25"/><path d="M2 17L37 23L7 30L40 32L7 43L38 40L2 51L55 43L63 32L55 21Z" fill="#AACFEF" opacity=".55"/><ellipse cx="44" cy="32" rx="15" ry="12" fill="#85E0D5"/><ellipse cx="48" cy="32" rx="9" ry="7" fill="#F1FFF4"/></g>',
  impact:
    '<g stroke="none"><path d="M32 4L37 24L57 10L43 29L64 33L43 37L57 56L37 43L32 64L27 43L8 57L21 37L0 32L23 27L9 8L27 22Z" fill="#EAB05F" opacity=".7"/><path d="M32 17L37 28L49 32L37 36L32 48L28 37L16 32L27 28Z" fill="#FFF9DF"/></g>',
  plasmaImpact:
    '<g fill="none" stroke="#A7ABF5" stroke-width="3"><circle cx="32" cy="32" r="24" opacity=".5"/><path d="M32 3L29 18L39 24L28 34L37 45L32 61M3 32L20 26L26 37L42 28L61 32"/><circle cx="32" cy="32" r="14" stroke="#8CE2D5" stroke-width="6"/><circle cx="32" cy="32" r="7" fill="#E8FFF0" stroke="none"/></g>',
  slash:
    '<path d="M13 3Q62 24 48 61Q49 29 13 3Z" fill="#E9FFFF" stroke="#75CFD9"/><path d="M7 10Q43 25 42 49" fill="none" stroke="#B5ECF4" stroke-width="3"/>',
  shockwave:
    '<path d="M13 7L48 32L13 57L29 32Z" fill="#AEDFEB"/><path d="M35 10L58 32L35 54" fill="none" stroke="#F2FFFF" stroke-width="5"/>',
  muzzle:
    '<path d="M7 24L25 25L34 7L40 23L61 20L49 32L61 46L40 41L34 59L25 40L7 42L16 32Z" fill="#FFC764"/><path d="M23 27L42 23L36 32L44 40L24 37Z" fill="#FFFBEA" stroke="none"/>',
  signal:
    '<path d="M13 49L25 37L32 45L48 27" fill="none" stroke="#9BE1CF" stroke-width="7"/><path d="M36 24H52V40" fill="none" stroke="#E8FFF8" stroke-width="6"/>',
  ring: '<circle cx="32" cy="32" r="25" stroke="#FFE596" stroke-width="5" fill="none"/>',
  stickyDrop: '<path d="M32 6C28 20 10 29 11 42C12 66 54 64 53 41C53 27 38 19 32 6Z" fill="#CE99E4"/>',
  spark:
    '<g fill="#FFE6A2" stroke="none"><path d="M28 30L3 6L20 34ZM35 30L61 12L42 35ZM33 37L51 61L39 39Z"/><circle cx="31" cy="33" r="5" fill="#FFFFFF"/></g>',
  droplet: '<ellipse cx="32" cy="32" rx="16" ry="22" fill="#B99BFF"/>',
  goo: '<path d="M5 36C-5 13 26 21 33 17C54 7 70 29 56 42C39 56 15 48 5 36Z" fill="#BE83DA"/>',
  stunStar: `${star} fill="#FFE373"/>`,
  acorn:
    '<ellipse cx="32" cy="37" rx="18" ry="21" fill="#D89B52"/><path d="M11 29Q32 9 53 29Z" fill="#825934"/><path d="M32 19L35 7" stroke="#825934" stroke-width="6"/>',
};

export type VfxId = keyof typeof drawings;
export const VFX_IDS = Object.keys(drawings) as VfxId[];
export function vfxSvg(id: VfxId): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="128" height="128"><g stroke="${ART_COLORS.outline}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round">${drawings[id]}</g></svg>`;
}
