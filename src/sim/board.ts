import { assert } from '../core/assert';

const KIND_BY_CHAR = {
  '.': 'ground',
  ',': 'path',
  H: 'high',
  '#': 'blocked',
  S: 'spawn',
  G: 'goal',
} as const;

export type TileKind = (typeof KIND_BY_CHAR)[keyof typeof KIND_BY_CHAR];

export interface Board {
  readonly width: number;
  readonly height: number;
  kindAt(x: number, y: number): TileKind | undefined;
}

export function parseBoard(map: readonly string[]): Board {
  const width = map[0]?.length ?? 0;
  assert(width > 0, 'board.map: empty map');
  const rows = map.map((row, y) => {
    assert(row.length === width, `board.map[${y}]: inconsistent row width`);
    return Array.from(row, (char, x) => {
      const kind = KIND_BY_CHAR[char as keyof typeof KIND_BY_CHAR];
      assert(kind, `board.map[${y}][${x}]: unknown tile "${char}"`);
      return kind;
    });
  });
  return {
    width,
    height: rows.length,
    kindAt: (x, y) => rows[y]?.[x],
  };
}

export function isWalkable(kind: TileKind | undefined): boolean {
  return kind === 'ground' || kind === 'path' || kind === 'spawn' || kind === 'goal';
}
