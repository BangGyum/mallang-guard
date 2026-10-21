import { describe, expect, it } from 'vitest';
import stageJson from '../../src/data/stages/stage-1.json';
import type { RouteDef } from '../../src/data/types';
import { parseBoard } from '../../src/sim/board';
import { buildRoute } from '../../src/sim/path';

const board = parseBoard(stageJson.map);
const groundRoute: RouteDef = {
  ...stageJson.routes.ground,
  from: stageJson.routes.ground.from as [number, number],
  to: stageJson.routes.ground.to as [number, number],
};
const airRoute: RouteDef = {
  ...stageJson.routes.air,
  from: stageJson.routes.air.from as [number, number],
  to: stageJson.routes.air.to as [number, number],
};

describe('buildRoute', () => {
  it('matches stage-1 ground corners, cumulative lengths, and total length', () => {
    const path = buildRoute(board, groundRoute);

    expect(path.points).toEqual([
      { x: 0.5, y: 1.5 },
      { x: 4.5, y: 1.5 },
      { x: 4.5, y: 3.5 },
      { x: 6.5, y: 3.5 },
      { x: 6.5, y: 1.5 },
      { x: 9.5, y: 1.5 },
      { x: 9.5, y: 3.5 },
      { x: 10.5, y: 3.5 },
    ]);
    expect(path.cumulativeLengths).toEqual([0, 4, 6, 8, 10, 13, 15, 16]);
    expect(path.length).toBe(16);
  });

  it('flies directly across terrain between tile centers', () => {
    const path = buildRoute(board, airRoute);

    expect(path.points).toEqual([
      { x: 0.5, y: 1.5 },
      { x: 10.5, y: 3.5 },
    ]);
    expect(path.length).toBeCloseTo(Math.sqrt(104), 12);
    expect(path.positionAt(path.length / 2)).toEqual({ x: 5.5, y: 2.5, segIndex: 0 });
  });

  it('uses right/down/left/up and first-opened ties on equally short detours', () => {
    const path = buildRoute(parseBoard(['...', 'S#G', '...']), { from: [0, 1], to: [2, 1] });

    expect(path.points).toEqual([
      { x: 0.5, y: 1.5 },
      { x: 0.5, y: 2.5 },
      { x: 2.5, y: 2.5 },
      { x: 2.5, y: 1.5 },
    ]);
    expect(path.length).toBe(4);
  });

  it('prefers the earlier right neighbor on an open board', () => {
    expect(buildRoute(parseBoard(['S..', '..G']), { from: [0, 0], to: [2, 1] }).points).toEqual([
      { x: 0.5, y: 0.5 },
      { x: 2.5, y: 0.5 },
      { x: 2.5, y: 1.5 },
    ]);
  });

  it('joins waypoints without duplicate tiles and preserves a reversing turn', () => {
    const route: RouteDef = {
      from: [0, 0],
      via: [
        [2, 0],
        [2, 0],
      ],
      to: [1, 0],
    };
    const path = buildRoute(parseBoard(['S.G']), route);

    expect(path.points).toEqual([
      { x: 0.5, y: 0.5 },
      { x: 2.5, y: 0.5 },
      { x: 1.5, y: 0.5 },
    ]);
    expect(path.cumulativeLengths).toEqual([0, 2, 3]);
    expect(path.positionAt(2.5)).toEqual({ x: 2, y: 0.5, segIndex: 1 });
    expect(route).toEqual({
      from: [0, 0],
      via: [
        [2, 0],
        [2, 0],
      ],
      to: [1, 0],
    });
  });

  it('joins flying waypoints as straight segments and removes repeated waypoints', () => {
    const path = buildRoute(parseBoard(['S#H', '##G']), {
      from: [0, 0],
      via: [
        [2, 0],
        [2, 0],
      ],
      to: [2, 1],
      flying: true,
    });

    expect(path.points).toEqual([
      { x: 0.5, y: 0.5 },
      { x: 2.5, y: 0.5 },
      { x: 2.5, y: 1.5 },
    ]);
    expect(path.cumulativeLengths).toEqual([0, 2, 3]);
    expect(path.length).toBe(3);
  });

  it('walks across ground, path, spawn, and goal tiles', () => {
    const path = buildRoute(parseBoard(['S,.G']), { from: [0, 0], to: [3, 0] });
    expect(path.points).toEqual([
      { x: 0.5, y: 0.5 },
      { x: 3.5, y: 0.5 },
    ]);
    expect(path.length).toBe(3);
  });

  it.each(['S#G', 'SHG'])('throws when ground route %s is unreachable', (map) => {
    expect(() => buildRoute(parseBoard([map]), { from: [0, 0], to: [2, 0] })).toThrow(/path/);
  });

  it('rejects invalid endpoints and unreachable intermediate waypoints', () => {
    const smallBoard = parseBoard(['S#G']);
    expect(() => buildRoute(smallBoard, { from: [-1, 0], to: [0, 0] })).toThrow(/path/);
    expect(() => buildRoute(smallBoard, { from: [0, 0], to: [1, 0] })).toThrow(/path/);
    expect(() => buildRoute(smallBoard, { from: [0, 0], via: [[2, 0]], to: [0, 0] })).toThrow(/path/);
  });

  it.each([false, true])('supports a zero-length route with flying=%s', (flying) => {
    const path = buildRoute(parseBoard(['S']), { from: [0, 0], to: [0, 0], flying });
    expect(path.points).toEqual([{ x: 0.5, y: 0.5 }]);
    expect(path.cumulativeLengths).toEqual([0]);
    expect(path.length).toBe(0);
    expect(path.positionAt(10)).toEqual({ x: 0.5, y: 0.5, segIndex: 0 });
  });
});

describe('positionAt', () => {
  const path = buildRoute(board, groundRoute);

  it.each([
    [0, 0.5, 1.5, 0],
    [4, 4.5, 1.5, 1],
    [6, 4.5, 3.5, 2],
    [8, 6.5, 3.5, 3],
    [10, 6.5, 1.5, 4],
    [13, 9.5, 1.5, 5],
    [15, 9.5, 3.5, 6],
    [16, 10.5, 3.5, 6],
  ])('returns the exact boundary at distance %i', (distance, x, y, segIndex) => {
    expect(path.positionAt(distance)).toEqual({ x, y, segIndex });
  });

  it.each([
    [2, 2.5, 1.5, 0],
    [5, 4.5, 2.5, 1],
    [9, 6.5, 2.5, 3],
    [11.5, 8, 1.5, 4],
    [15.5, 10, 3.5, 6],
  ])('interpolates along the current segment at distance %s', (distance, x, y, segIndex) => {
    expect(path.positionAt(distance)).toEqual({ x, y, segIndex });
  });

  it('clamps distance to the endpoints', () => {
    expect(path.positionAt(-3)).toEqual({ x: 0.5, y: 1.5, segIndex: 0 });
    expect(path.positionAt(20)).toEqual({ x: 10.5, y: 3.5, segIndex: 6 });
  });

  it('moves forward or backward from a cached segment hint', () => {
    expect(path.positionAt(14, 0)).toEqual({ x: 9.5, y: 2.5, segIndex: 5 });
    expect(path.positionAt(5, 6)).toEqual({ x: 4.5, y: 2.5, segIndex: 1 });
    expect(path.positionAt(4, 6)).toEqual({ x: 4.5, y: 1.5, segIndex: 1 });
  });
});
