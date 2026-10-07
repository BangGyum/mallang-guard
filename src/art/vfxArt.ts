import { ART_COLORS } from './palette';

const star = '<path d="M32 5L39 23L59 24L43 37L48 57L32 46L16 57L21 37L5 24L25 23Z"';
const drawings = {
  snowball:
    '<circle cx="32" cy="32" r="24" fill="#fff"/><path d="M16 28Q20 15 32 15" fill="none" stroke="#C4DFFF" stroke-width="5"/>',
  star: `${star} fill="#FFD45C"/>`,
  stickyDrop: '<path d="M32 6C28 20 10 29 11 42C12 66 54 64 53 41C53 27 38 19 32 6Z" fill="#CE99E4"/>',
  heartPlus:
    '<path d="M32 20C12-4-11 29 32 55C75 29 52-4 32 20Z" fill="#FF9EB4"/><path d="M32 26V44M23 35H41" stroke="#fff" stroke-width="6"/>',
  spark: `${star} fill="#FFF3A3"/>`,
  droplet: '<ellipse cx="32" cy="32" rx="16" ry="22" fill="#B99BFF"/>',
  goo: '<path d="M5 36C-5 13 26 21 33 17C54 7 70 29 56 42C39 56 15 48 5 36Z" fill="#BE83DA"/>',
  stunStar: `${star} fill="#FFE373"/>`,
  acorn:
    '<ellipse cx="32" cy="37" rx="18" ry="21" fill="#D89B52"/><path d="M11 29Q32 9 53 29Z" fill="#825934"/><path d="M32 19L35 7" stroke="#825934" stroke-width="6"/>',
  carrot:
    '<path d="M20 21H44L31 59Z" fill="#FFA349"/><path d="M27 20L17 6M32 20V3M37 20L48 6" stroke="#59AE71" stroke-width="5"/>',
};

export type VfxId = keyof typeof drawings;
export const VFX_IDS = Object.keys(drawings) as VfxId[];
export function vfxSvg(id: VfxId): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="128" height="128"><g stroke="${ART_COLORS.outline}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round">${drawings[id]}</g></svg>`;
}
