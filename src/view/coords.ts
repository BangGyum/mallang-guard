import type { Board, TileKind } from '../sim/board';

export const TILE_HEIGHT: Readonly<Record<TileKind, number>> = {
  ground: 0,
  path: 0,
  spawn: 0,
  goal: 0,
  high: 0.5,
  blocked: 0.15,
};

export function tileCenter(x: number, y: number, board: Board): [number, number, number] {
  const kind = board.kindAt(x, y);
  return [x + 0.5 - board.width / 2, kind ? TILE_HEIGHT[kind] : 0, y + 0.5 - board.height / 2];
}
