import { vfxSvg } from '../art/vfxArt';
import { element } from './dom';

export function acornIcon(): HTMLSpanElement {
  const icon = element('span', 'acorn-icon');
  icon.setAttribute('aria-hidden', 'true');
  icon.innerHTML = vfxSvg('acorn');
  return icon;
}
