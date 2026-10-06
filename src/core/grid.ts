export type Dir = 'right' | 'down' | 'left' | 'up';

export interface Tile {
  x: number;
  y: number;
}

export function rotateOffset(offset: readonly [number, number], dir: Dir): Tile {
  const [dx, dy] = offset;
  let x = dx;
  let y = dy;

  switch (dir) {
    case 'down':
      x = -dy;
      y = dx;
      break;
    case 'left':
      x = -dx;
      y = -dy;
      break;
    case 'up':
      x = dy;
      y = -dx;
      break;
  }

  return { x: x === 0 ? 0 : x, y: y === 0 ? 0 : y };
}

export function rangeTiles(
  tile: Tile,
  offsets: readonly (readonly [number, number])[],
  dir: Dir,
  width: number,
  height: number,
): Tile[] {
  const tiles: Tile[] = [];

  for (const offset of offsets) {
    const rotated = rotateOffset(offset, dir);
    const x = tile.x + rotated.x;
    const y = tile.y + rotated.y;

    if (x >= 0 && x < width && y >= 0 && y < height) {
      tiles.push({ x, y });
    }
  }

  return tiles;
}
