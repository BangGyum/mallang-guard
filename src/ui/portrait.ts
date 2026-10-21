import { characterMarkup } from '../art/characterArt';
import type { CritterId } from '../art/critters';
import { element } from './dom';

export function portrait(id: CritterId, className: string): HTMLSpanElement {
  const node = element('span', className);
  node.setAttribute('aria-hidden', 'true');
  node.innerHTML = characterMarkup(id);
  return node;
}
