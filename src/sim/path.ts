import { assert } from '../core/assert';
import type { Tile } from '../core/grid';
import { clamp, dist, lerp } from '../core/math';
import type { RouteDef } from '../data/types';
import { type Board, isWalkable } from './board';

interface SearchNode {
  tile: Tile;
  g: number;
  h: number;
  order: number;
  parent?: SearchNode;
}

export interface PathPosition extends Tile {
  segIndex: number;
}

export interface Polyline {
  readonly points: readonly Readonly<Tile>[];
  readonly cumulativeLengths: readonly number[];
  readonly length: number;
  positionAt(distance: number, segHint?: number): PathPosition;
}

export function findTilePath(board: Board, from: Tile, to: Tile): Tile[] {
  for (const tile of [from, to]) {
    assert(isWalkable(board.kindAt(tile.x, tile.y)), `path: tile (${tile.x},${tile.y}) is not walkable`);
  }
  const key = (tile: Tile): number => tile.y * board.width + tile.x;
  const heuristic = (tile: Tile): number => Math.abs(tile.x - to.x) + Math.abs(tile.y - to.y);
  const start: SearchNode = { tile: { ...from }, g: 0, h: heuristic(from), order: 0 };
  const nodes = new Map<number, SearchNode>([[key(from), start]]);
  const open = [start];
  const closed = new Set<number>();
  let order = 1;
  while (true) {
    open.sort((a, b) => a.g + a.h - (b.g + b.h) || a.h - b.h || a.order - b.order);
    const current = open.shift();
    if (!current) break;
    if (current.tile.x === to.x && current.tile.y === to.y) {
      const tiles: Tile[] = [];
      for (let node: SearchNode | undefined = current; node; node = node.parent) tiles.push({ ...node.tile });
      return tiles.reverse();
    }
    closed.add(key(current.tile));
    for (const [dx, dy] of [
      [1, 0],
      [0, 1],
      [-1, 0],
      [0, -1],
    ] as const) {
      const tile = { x: current.tile.x + dx, y: current.tile.y + dy };
      const id = key(tile);
      if (!isWalkable(board.kindAt(tile.x, tile.y)) || closed.has(id)) continue;
      const g = current.g + 1;
      const existing = nodes.get(id);
      if (existing) {
        if (g < existing.g) {
          existing.g = g;
          existing.parent = current;
        }
      } else {
        const node: SearchNode = { tile, g, h: heuristic(tile), order: order++, parent: current };
        nodes.set(id, node);
        open.push(node);
      }
    }
  }
  throw new Error(`path: no ground route from (${from.x},${from.y}) to (${to.x},${to.y})`);
}

export function createPolyline(input: readonly Readonly<Tile>[]): Polyline {
  const points = input
    .filter((point, index) => {
      const previous = input[index - 1];
      return !previous || previous.x !== point.x || previous.y !== point.y;
    })
    .map(({ x, y }) => ({ x, y }));
  const first = points[0];
  assert(first, 'path.points: empty polyline');
  const cumulativeLengths = [0];
  let length = 0;
  let previous = first;
  for (const point of points.slice(1)) {
    length += dist(previous.x, previous.y, point.x, point.y);
    cumulativeLengths.push(length);
    previous = point;
  }
  return {
    points,
    cumulativeLengths,
    length,
    positionAt: (distance, segHint = 0) => {
      if (points.length === 1) return { ...first, segIndex: 0 };
      const travel = clamp(distance, 0, length);
      let segIndex = clamp(Math.floor(segHint), 0, points.length - 2);
      // 밀치기로 거리가 줄어든 경우에도 기존 구간 캐시에서 뒤로 탐색한다.
      while (segIndex > 0 && travel < (cumulativeLengths[segIndex] ?? 0)) segIndex -= 1;
      while (segIndex < points.length - 2 && travel >= (cumulativeLengths[segIndex + 1] ?? length))
        segIndex += 1;
      const start = points[segIndex];
      const end = points[segIndex + 1];
      const startDistance = cumulativeLengths[segIndex];
      const endDistance = cumulativeLengths[segIndex + 1];
      assert(
        start && end && startDistance !== undefined && endDistance !== undefined,
        'path: invalid segment',
      );
      const alpha = (travel - startDistance) / (endDistance - startDistance);
      return { x: lerp(start.x, end.x, alpha), y: lerp(start.y, end.y, alpha), segIndex };
    },
  };
}

export function buildRoute(board: Board, route: RouteDef): Polyline {
  const stops = [route.from, ...(route.via ?? []), route.to].map(([x, y]) => ({ x, y }));
  if (route.flying) return createPolyline(stops.map(({ x, y }) => ({ x: x + 0.5, y: y + 0.5 })));
  const tiles: Tile[] = [];
  let previous = stops[0];
  assert(previous, 'path: missing start');
  for (const stop of stops.slice(1)) {
    const segment = findTilePath(board, previous, stop);
    tiles.push(...(tiles.length === 0 ? segment : segment.slice(1)));
    previous = stop;
  }
  const corners = tiles.filter((tile, index) => {
    const before = tiles[index - 1];
    const after = tiles[index + 1];
    if (!before || !after) return true;
    const ax = tile.x - before.x;
    const ay = tile.y - before.y;
    const bx = after.x - tile.x;
    const by = after.y - tile.y;
    // 경유점에서 되돌아가는 180도 회전은 이동 거리를 보존해야 한다.
    return ax * by - ay * bx !== 0 || ax * bx + ay * by <= 0;
  });
  return createPolyline(corners.map(({ x, y }) => ({ x: x + 0.5, y: y + 0.5 })));
}
