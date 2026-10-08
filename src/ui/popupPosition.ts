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
  popup.style.left = `${Math.max(bounds.left, bounds.right - width)}px`;
  popup.style.top = `${Math.max(bounds.top, bounds.bottom - height)}px`;
  return anchor;
}
