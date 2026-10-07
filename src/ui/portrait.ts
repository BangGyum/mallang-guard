import { type CritterId, critterSvg } from '../art/critters';
import { element } from './dom';

export function portrait(id: CritterId, className: string): HTMLSpanElement {
  const node = element('span', className);
  node.setAttribute('aria-hidden', 'true');
  node.innerHTML = critterSvg(id);
  return node;
}
