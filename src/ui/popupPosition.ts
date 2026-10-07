import { clamp } from '../core/math';

export interface ScreenPoint {
  x: number;
  y: number;
}

export function popupBounds(root: HTMLElement) {
  const rect = root.getBoundingClientRect();
  const top = root.querySelector('.battle-top')?.getBoundingClientRect();
  const bottom = root.querySelector('.deploy-bar')?.getBoundingClientRect();
  return {
    left: 8,
    right: rect.width - 8,
    top: top ? top.bottom - rect.top + 8 : 8,
    bottom: bottom ? bottom.top - rect.top - 8 : rect.height - 8,
  };
}

export function placeUnitPopup(root: HTMLElement, popup: HTMLElement, point: ScreenPoint) {
  const rect = root.getBoundingClientRect();
  const anchor = { x: point.x - rect.left, y: point.y - rect.top };
  const bounds = popupBounds(root);
  popup.style.maxHeight = `${Math.max(0, bounds.bottom - bounds.top)}px`;
  const width = popup.offsetWidth;
  const height = popup.offsetHeight;
  const gap = rect.height <= 500 ? 28 : 48;
  const leftFits = anchor.x - gap - width >= bounds.left;
  const rightFits = anchor.x + gap + width <= bounds.right;
  const onLeft = leftFits && (anchor.x < rect.width / 2 || !rightFits);
  const x = clamp(onLeft ? anchor.x - gap - width : anchor.x + gap, bounds.left, bounds.right - width);
  const y = clamp(anchor.y - height / 2, bounds.top, Math.max(bounds.top, bounds.bottom - height));
  popup.style.left = `${x}px`;
  popup.style.top = `${y}px`;
  popup.dataset.side = onLeft ? 'left' : 'right';
  return { anchor, edge: { x: onLeft ? x + width : x, y: clamp(anchor.y, y + 18, y + height - 18) } };
}
