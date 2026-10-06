import { assert } from '../core/assert';
import type { Tile } from '../core/grid';
import { clamp, dist, lerp } from '../core/math';
import type { RouteDef } from '../data/types';
import type { Board } from './board';

export interface PathPosition extends Tile {
  segIndex: number;
}

export interface Path {
  readonly points: readonly Tile[];
  readonly cumulativeLengths: readonly number[];
  readonly totalLength: number;
  positionAt(distance: number, segHint?: number): PathPosition;
}

interface SearchNode extends Tile {
  g: number;
  h: number;
  closed: boolean;
  parent?: SearchNode;
}

const NEIGHBORS: readonly Tile[] = [
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
  { x: 0, y: -1 },
];

function walkable(board: Board, tile: Tile): boolean {
  const kind = board.kindAt(tile);
  return kind === 'ground' || kind === 'path' || kind === 'spawn' || kind === 'goal';
}

function groundPath(board: Board, from: Tile, to: Tile): Tile[] {
  const failure = `지상 경로를 찾을 수 없습니다: (${from.x}, ${from.y}) → (${to.x}, ${to.y})`;
  assert(walkable(board, from) && walkable(board, to), failure);

  const start: SearchNode = {
    ...from,
    g: 0,
    h: Math.abs(to.x - from.x) + Math.abs(to.y - from.y),
    closed: false,
  };
  const nodes = new Map<number, SearchNode>([[from.y * board.width + from.x, start]]);
  const open = [start];

  while (open.length > 0) {
    let bestIndex = 0;
    let current = open[0];
    if (!current) break;

    for (const [index, candidate] of open.entries()) {
      const candidateF = candidate.g + candidate.h;
      const currentF = current.g + current.h;
      if (candidateF < currentF || (candidateF === currentF && candidate.h < current.h)) {
        current = candidate;
        bestIndex = index;
      }
    }

    open.splice(bestIndex, 1);
    current.closed = true;

    if (current.x === to.x && current.y === to.y) {
      const tiles: Tile[] = [];
      let node: SearchNode | undefined = current;
      while (node) {
        tiles.push({ x: node.x, y: node.y });
        node = node.parent;
      }
      return tiles.reverse();
    }

    for (const offset of NEIGHBORS) {
      const tile = { x: current.x + offset.x, y: current.y + offset.y };
      if (!walkable(board, tile)) continue;

      const key = tile.y * board.width + tile.x;
      const known = nodes.get(key);
      const g = current.g + 1;
      if (known) {
        if (!known.closed && g < known.g) {
          known.g = g;
          known.parent = current;
        }
      } else {
        const next: SearchNode = {
          ...tile,
          g,
          h: Math.abs(to.x - tile.x) + Math.abs(to.y - tile.y),
          closed: false,
          parent: current,
        };
        nodes.set(key, next);
        open.push(next);
      }
    }
  }

  throw new Error(failure);
}

function corners(tiles: readonly Tile[]): Tile[] {
  return tiles.filter((tile, index) => {
    const previous = tiles[index - 1];
    const next = tiles[index + 1];
    return (
      !previous || !next || tile.x - previous.x !== next.x - tile.x || tile.y - previous.y !== next.y - tile.y
    );
  });
}

export function createPath(board: Board, route: RouteDef): Path {
  const from = { x: route.from[0], y: route.from[1] };
  const waypoints = [route.from, ...(route.via ?? []), route.to].map(([x, y]) => ({ x, y }));
  let tiles: Tile[] = [];

  if (route.flying) {
    tiles = waypoints.filter((tile, index) => {
      const previous = waypoints[index - 1];
      return !previous || tile.x !== previous.x || tile.y !== previous.y;
    });
  } else {
    let previous = from;
    for (const waypoint of waypoints.slice(1)) {
      const segment = groundPath(board, previous, waypoint);
      tiles.push(...segment.slice(tiles.length === 0 ? 0 : 1));
      previous = waypoint;
    }
    tiles = corners(tiles);
  }

  const points = tiles.map(({ x, y }) => ({ x: x + 0.5, y: y + 0.5 }));
  const cumulativeLengths: number[] = [];
  let totalLength = 0;
  let previous: Tile | undefined;
  for (const point of points) {
    if (previous) totalLength += dist(previous, point);
    cumulativeLengths.push(totalLength);
    previous = point;
  }

  return {
    points,
    cumulativeLengths,
    totalLength,
    positionAt(distance, segHint = 0) {
      const progress = clamp(distance, 0, totalLength);
      const lastSegment = Math.max(0, points.length - 2);
      let segIndex = clamp(Math.trunc(segHint), 0, lastSegment);

      while (segIndex < lastSegment && progress >= (cumulativeLengths[segIndex + 1] ?? totalLength)) {
        segIndex += 1;
      }
      while (segIndex > 0 && progress < (cumulativeLengths[segIndex] ?? 0)) {
        segIndex -= 1;
      }

      const start = points[segIndex] ?? { x: from.x + 0.5, y: from.y + 0.5 };
      const end = points[segIndex + 1] ?? start;
      const startDistance = cumulativeLengths[segIndex] ?? 0;
      const segmentLength = (cumulativeLengths[segIndex + 1] ?? totalLength) - startDistance;
      const alpha = segmentLength === 0 ? 0 : (progress - startDistance) / segmentLength;
      return { x: lerp(start.x, end.x, alpha), y: lerp(start.y, end.y, alpha), segIndex };
    },
  };
}
