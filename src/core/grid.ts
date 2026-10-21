export type Dir = 'right' | 'down' | 'left' | 'up';

export interface Tile {
  x: number;
  y: number;
}

export function rotateOffset([dx, dy]: readonly [number, number], dir: Dir): [number, number] {
  // 0에서 빼면 정수 좌표에 -0이 남지 않습니다.
  switch (dir) {
    case 'right':
      return [dx, dy];
    case 'down':
      return [0 - dy, dx];
    case 'left':
      return [0 - dx, 0 - dy];
    case 'up':
      return [dy, 0 - dx];
  }
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
    const [dx, dy] = rotateOffset(offset, dir);
    const x = tile.x + dx;
    const y = tile.y + dy;
    if (x >= 0 && x < width && y >= 0 && y < height) tiles.push({ x, y });
  }
  return tiles;
}
