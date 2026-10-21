import { ART_COLORS } from './palette';
import { SKILL_DRAWINGS } from './skillArt';
import { SKILL_PROJECTILES } from './skillProjectileArt';

const star = '<path d="M32 5L39 23L59 24L43 37L48 57L32 46L16 57L21 37L5 24L25 23Z"';
const drawings = {
  ...SKILL_DRAWINGS,
  ...SKILL_PROJECTILES,
  gravityOrb:
    '<g stroke="none"><circle cx="32" cy="32" r="24" fill="#8BD7D0" opacity=".2"/><circle cx="32" cy="32" r="14" fill="#62AAA9"/><circle cx="32" cy="32" r="7" fill="#E5F8E7"/></g><ellipse cx="32" cy="32" rx="27" ry="12" transform="rotate(-30 32 32)" fill="none" stroke="#D3E8B4" stroke-width="3"/>',
  gravityRing:
    '<g fill="none" stroke="#7CC8C0" stroke-width="2"><circle cx="32" cy="32" r="29"/><circle cx="32" cy="32" r="24" stroke-dasharray="12 6"/><path d="M32 5L28 13H36ZM59 32L51 28V36ZM32 59L28 51H36ZM5 32L13 28V36Z" fill="#D7E8BC" stroke="none"/><circle cx="32" cy="32" r="5" fill="#A5E2D0" opacity=".45"/></g>',
  gravityBurst:
    '<g fill="none" stroke="#A5E4D5" stroke-width="4"><circle cx="32" cy="32" r="24"/><path d="M32 3V19M32 45V61M3 32H19M45 32H61M11 11L23 23M41 41L53 53M53 11L41 23M23 41L11 53" stroke="#EADAA4"/><circle cx="32" cy="32" r="10" fill="#F2FFED" stroke="none"/></g>',
  frostFlash:
    '<g fill="none" stroke="#93DCEF" stroke-width="4"><path d="M32 8V56M11 20L53 44M11 44L53 20"/><circle cx="32" cy="32" r="9" fill="#EFFFFF" stroke="#EFFFFF"/></g>',
  railFlash:
    '<g fill="none" stroke="#9ADACB" stroke-width="3"><ellipse cx="32" cy="32" rx="12" ry="24"/><path d="M5 32H59M24 20L40 44M24 44L40 20" stroke="#F0FFF5"/><circle cx="32" cy="32" r="5" fill="#EEFFF4"/></g>',
  shellFlash:
    '<g stroke="none"><path d="M7 21L24 24L32 9L40 24L57 21L46 32L57 43L40 40L32 55L24 40L7 43L18 32Z" fill="#DAAE69" opacity=".7"/><circle cx="32" cy="32" r="11" fill="#FFE6A8"/><circle cx="32" cy="32" r="5" fill="#FFFBDF"/></g>',
  mintRailRound:
    '<g stroke="none"><path d="M0 29H48L64 32L48 35H0Z" fill="#A2DDD1"/><path d="M13 31H54L62 32L54 33H13Z" fill="#F6FFF6"/></g>',
  shellRound:
    '<path d="M13 16H38Q55 16 57 32Q55 48 38 48H13Z" fill="#E3BA6C"/><path d="M13 16H25V48H13Z" fill="#667D64"/><path d="M27 21H40Q48 21 51 29H27Z" fill="#FFF0BE" stroke="none"/><path d="M12 16V48M25 17V47" fill="none" stroke="#344953" stroke-width="3"/>',
  shellBurst:
    '<g stroke="none"><path d="M9 38Q0 26 13 19Q10 5 25 12Q34 0 41 12Q57 8 55 23Q68 29 56 41Q59 55 44 53Q33 65 23 52Q7 59 9 38Z" fill="#6F716A" opacity=".32"/><path d="M32 7L40 20L53 16L49 30L61 37L46 43L43 57L30 49L17 57L16 42L3 34L17 26L15 12L27 19Z" fill="#EF9748"/><circle cx="32" cy="33" r="17" fill="#FFD578"/><circle cx="32" cy="32" r="9" fill="#FFF6D6"/></g>',
  lightningLink:
    '<path d="M0 32L14 25L26 36L39 27L51 35L64 32" fill="none" stroke="#B7A5E5" stroke-width="5" stroke-linejoin="round"/><path d="M0 32L14 25L26 36L39 27L51 35L64 32" fill="none" stroke="#FAF5FF" stroke-width="2" stroke-linejoin="round"/>',
  stormBolt:
    '<path d="M3 35L24 19L29 30L43 21L61 32L39 43L36 33L18 44L21 34Z" fill="#C0AFE9" stroke="#EDE8FF" stroke-width="2"/>',
  stormFlash:
    '<g fill="none" stroke="#CAB5F2" stroke-width="3"><path d="M32 5L27 20L36 27L28 39L34 58M5 32L20 26L29 35L44 26L59 32"/><circle cx="32" cy="32" r="5" fill="#F8F4FF" stroke="none"/></g>',
  flameBolt:
    '<g stroke="none"><path d="M0 17Q21 27 35 14Q57 7 63 32Q57 54 35 49Q20 37 0 46L16 32Z" fill="#EFA2C1" opacity=".25"/><path d="M0 20Q20 33 33 19Q53 11 62 32Q53 52 34 45Q17 34 2 43L18 32Z" fill="#EF744F"/><path d="M9 25Q28 36 39 24Q53 18 59 32Q50 45 37 39Q21 32 9 37L25 31Z" fill="#FFC56A"/><path d="M31 31Q46 24 57 32Q46 39 36 34L20 32Z" fill="#FFF8D9"/></g>',
  flameLink:
    '<g fill="none" stroke-linecap="round"><path d="M0 32Q12 11 25 31T48 31Q57 23 64 32" stroke="#E998BD" stroke-width="15" opacity=".2"/><path d="M0 32Q12 11 25 31T48 31Q57 23 64 32" stroke="#F18156" stroke-width="8"/><path d="M0 32Q12 19 25 31T48 31Q57 27 64 32" stroke="#FFD281" stroke-width="4"/><path d="M3 31Q12 23 22 30M30 35Q39 44 46 33M51 30L61 31" stroke="#FFF6D3" stroke-width="2"/></g>',
  flameBloom:
    '<g stroke="none"><ellipse cx="32" cy="34" rx="28" ry="25" fill="#EE9AB7" opacity=".2"/><path d="M30 3Q46 18 40 29L55 16Q65 39 48 51Q30 64 13 50Q0 37 10 22L22 34Q17 19 30 3Z" fill="#ED8058"/><path d="M31 15Q43 28 34 36L48 28Q51 46 34 53Q17 54 15 37L28 42Q23 29 31 15Z" fill="#FFD079"/><path d="M32 31Q43 42 35 49Q23 51 25 41Z" fill="#FFF7DC"/><path d="M6 11L9 18L4 20ZM52 3L56 10L51 14Z" fill="#FFC56A"/></g>',
  bullet:
    '<path d="M6 26H43L60 32L43 38H6Z" fill="#FFE2A0"/><path d="M15 32H49" stroke="#fff" stroke-width="4"/>',
  compactRound:
    '<g stroke="none"><path d="M8 29H43L58 32L43 35H8Z" fill="#D2DCE8"/><path d="M34 30H49L57 32L49 34H34Z" fill="#FFF4CA"/></g>',
  energyPulse:
    '<g stroke="none"><path d="M2 28H37L54 32L37 36H2Z" fill="#84D6BD" opacity=".45"/><ellipse cx="43" cy="32" rx="16" ry="8" fill="#9BE7CA"/><ellipse cx="46" cy="32" rx="9" ry="3" fill="#F0FFF7"/></g>',
  iceRound:
    '<path d="M4 25H43L61 32L43 39H4Z" fill="#8DDDFA"/><path d="M17 32H52" stroke="#F5FFFF" stroke-width="5"/>',
  arcBolt:
    '<path d="M3 30L21 19L40 25L59 32L40 39L21 45Z" fill="#B3C8FF"/><path d="M17 32H52" stroke="#F4F5FF" stroke-width="5"/>',
  railRound:
    '<g stroke="none"><path d="M0 30.5H50L64 32L50 33.5H0Z" fill="#FFD386"/><path d="M22 31.4H55L64 32L55 32.6H22Z" fill="#FFFFFF"/></g>',
  fireball:
    '<g stroke="none"><ellipse cx="42" cy="32" rx="22" ry="23" fill="#F78B46" opacity=".2"/><path d="M0 11Q21 11 32 18L18 7Q42 9 53 18Q69 30 56 45Q42 59 17 56L29 46Q9 47 2 37L22 34Q8 27 0 11Z" fill="#ED6943"/><path d="M10 19Q31 26 37 20Q60 16 59 34Q56 51 32 48L39 39Q23 42 17 35L32 31Z" fill="#FFB64E"/><path d="M37 26Q53 21 55 32Q54 43 40 40L44 34L29 29Z" fill="#FFF4BA"/></g>',
  fireBurst:
    '<g stroke="none"><circle cx="32" cy="34" r="27" fill="#F68A43" opacity=".18"/><path d="M32 3Q48 15 42 27L53 17Q65 37 48 51Q30 66 13 49Q0 35 14 20L17 34Q30 27 32 3Z" fill="#EB7143"/><path d="M33 18Q43 30 35 38L45 32Q53 48 35 55Q17 57 17 41L25 46Q23 32 33 18Z" fill="#FFB951"/><path d="M32 37Q43 48 33 52Q24 53 32 37Z" fill="#FFF3C4"/></g>',
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
