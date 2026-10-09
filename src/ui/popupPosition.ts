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
  const gap = rect.height <= 500 ? 28 : 56;
  const right = anchor.x + gap;
  let left = right + width <= bounds.right ? right : anchor.x - gap - width;
  let top = anchor.y - height / 2;
  if (right + width > bounds.right && anchor.x - gap - width < bounds.left) {
    left = anchor.x - width / 2;
    top = anchor.y - height - gap >= bounds.top ? anchor.y - height - gap : anchor.y + gap;
  }
  popup.style.left = `${Math.max(bounds.left, Math.min(bounds.right - width, left))}px`;
  popup.style.top = `${Math.max(bounds.top, Math.min(bounds.bottom - height, top))}px`;
  return anchor;
}

export function placeRosterPopup(root: HTMLElement, popup: HTMLElement): void {
  const bounds = popupBounds(root);
  popup.style.maxHeight = `${Math.max(0, bounds.bottom - bounds.top)}px`;
  popup.style.left = `${Math.max(bounds.left, bounds.right - popup.offsetWidth)}px`;
  popup.style.top = `${Math.max(bounds.top, bounds.bottom - popup.offsetHeight)}px`;
}
