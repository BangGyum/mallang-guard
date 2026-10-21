import type { Role } from '../data/types';
import { element } from './dom';

type Icon = Role | 'pause' | 'play' | 'speed' | 'retreat';

const PATHS: Record<Icon, string> = {
  vanguard: '<path d="m12 3 8 5v9l-8 4-8-4V8l8-5Zm-8 5 8 5 8-5M12 13v8M8 5l8 5"/>',
  guard: '<path d="m5 19 2-5L18 3l3 3L10 17l-5 2Zm1-7 6 6M3 21l4-4"/>',
  defender: '<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Zm-4 9 3 3 5-6"/>',
  sniper:
    '<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2"/><path d="M12 2v4m0 12v4M2 12h4m12 0h4"/>',
  caster: '<path d="m14 2-9 12h7l-2 8 9-12h-7l2-8Z"/>',
  medic: '<path d="m5 10 7-7 7 7M5 18l7-7 7 7M12 11v10"/>',
  specialist: '<path d="m3 12 8-7v4h8v6h-8v4l-8-7Zm16-7h2m-2 14h2"/>',
  supporter: '<path d="M5 4h14M5 20h14M7 4v4l5 4-5 4v4m10-16v4l-5 4 5 4v4"/>',
  pause: '<path d="M8 5v14M16 5v14" stroke-width="4"/>',
  play: '<path d="m8 4 12 8-12 8V4Z"/>',
  speed: '<path d="m3 5 8 7-8 7V5Zm10 0 8 7-8 7V5Z"/>',
  retreat: '<path d="M14 4h6v16h-6M3 12h12m-7-5-5 5 5 5"/>',
};

export function battleIcon(icon: Icon) {
  const node = element('span', 'battle-icon');
  node.setAttribute('aria-hidden', 'true');
  node.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${PATHS[icon]}</svg>`;
  return node;
}
