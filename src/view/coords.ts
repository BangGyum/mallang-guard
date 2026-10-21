import { Vector3 } from 'three';
import type { Tile } from '../core/grid';
import type { TileKind } from '../sim/board';

export function tileHeight(kind: TileKind): number {
  if (kind === 'high') return 0.5;
  if (kind === 'blocked') return 0.15;
  return 0;
}

export function tileToWorld(tile: Tile, width: number, height: number, elevation = 0): Vector3 {
  return new Vector3(tile.x + 0.5 - width / 2, elevation, tile.y + 0.5 - height / 2);
}
