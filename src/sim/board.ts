import { assert } from '../core/assert';
import type { Tile } from '../core/grid';

export type TileKind = 'ground' | 'path' | 'high' | 'blocked' | 'spawn' | 'goal';

export interface Board {
  readonly width: number;
  readonly height: number;
  kindAt(tile: Tile): TileKind | undefined;
}

const TILE_KINDS: Readonly<Record<string, TileKind>> = {
  '.': 'ground',
  ',': 'path',
  H: 'high',
  '#': 'blocked',
  S: 'spawn',
  G: 'goal',
};

export function parseBoard(map: readonly string[]): Board {
  const width = map[0]?.length ?? 0;
  assert(width > 0 && map.length > 0, '맵은 비어 있을 수 없습니다');
  const kinds: TileKind[] = [];
  for (const row of map) {
    assert(row.length === width, '맵의 모든 줄 길이가 같아야 합니다');
    for (const character of row) {
      const kind = TILE_KINDS[character];
      assert(kind !== undefined, `알 수 없는 타일: ${character}`);
      kinds.push(kind);
    }
  }
  const height = map.length;
  return {
    width,
    height,
    kindAt({ x, y }) {
      if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= width || y >= height) {
        return undefined;
      }
      return kinds[y * width + x];
    },
  };
}
