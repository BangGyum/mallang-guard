import type { Dir, Tile } from '../core/grid';

export type InputState =
  | { mode: 'idle' }
  | { mode: 'dragging'; unitId: string; hover: Tile | null }
  | { mode: 'aiming'; unitId: string; tile: Tile; dir: Dir | null }
  | { mode: 'selected'; uid: number };

export function directionFromDrag(dx: number, dy: number): Dir | null {
  if (Math.hypot(dx, dy) < 28) return null;
  return Math.abs(dx) >= Math.abs(dy) ? (dx >= 0 ? 'right' : 'left') : dy >= 0 ? 'down' : 'up';
}
