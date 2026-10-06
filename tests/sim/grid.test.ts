import { describe, expect, it } from 'vitest';
import { type Dir, rangeTiles, rotateOffset } from '../../src/core/grid';

describe('rotateOffset', () => {
  it.each<{ dir: Dir; straight: [number, number]; diagonal: [number, number] }>([
    { dir: 'right', straight: [1, 0], diagonal: [1, -1] },
    { dir: 'down', straight: [0, 1], diagonal: [1, 1] },
    { dir: 'left', straight: [-1, 0], diagonal: [-1, 1] },
    { dir: 'up', straight: [0, -1], diagonal: [-1, -1] },
  ])('rotates the specified offsets facing $dir', ({ dir, straight, diagonal }) => {
    expect(rotateOffset([1, 0], dir)).toEqual({ x: straight[0], y: straight[1] });
    expect(rotateOffset([1, -1], dir)).toEqual({ x: diagonal[0], y: diagonal[1] });
  });

  it.each<Dir>(['right', 'down', 'left', 'up'])('normalizes negative zero facing %s', (dir) => {
    expect(rotateOffset([-0, 0], dir)).toEqual({ x: 0, y: 0 });
  });
});

describe('rangeTiles', () => {
  const tile = Object.freeze({ x: 1, y: 1 });
  const offsets = Object.freeze([
    Object.freeze([0, 0] as const),
    Object.freeze([1, 0] as const),
    Object.freeze([0, -1] as const),
    Object.freeze([-1, 0] as const),
    Object.freeze([0, 1] as const),
    Object.freeze([3, 0] as const),
    Object.freeze([-2, 0] as const),
  ]);

  it.each<{ dir: Dir; expected: { x: number; y: number }[] }>([
    {
      dir: 'right',
      expected: [
        { x: 1, y: 1 },
        { x: 2, y: 1 },
        { x: 1, y: 0 },
        { x: 0, y: 1 },
      ],
    },
    {
      dir: 'down',
      expected: [
        { x: 1, y: 1 },
        { x: 2, y: 1 },
        { x: 1, y: 0 },
        { x: 0, y: 1 },
      ],
    },
    {
      dir: 'left',
      expected: [
        { x: 1, y: 1 },
        { x: 0, y: 1 },
        { x: 2, y: 1 },
        { x: 1, y: 0 },
      ],
    },
    {
      dir: 'up',
      expected: [
        { x: 1, y: 1 },
        { x: 1, y: 0 },
        { x: 0, y: 1 },
        { x: 2, y: 1 },
      ],
    },
  ])('clips all edges of a rectangular board in offset order facing $dir', ({ dir, expected }) => {
    expect(rangeTiles(tile, offsets, dir, 3, 2)).toEqual(expected);
  });

  it('does not mutate the origin or shared range offsets', () => {
    rangeTiles(tile, offsets, 'left', 3, 2);

    expect(tile).toEqual({ x: 1, y: 1 });
    expect(offsets).toEqual([
      [0, 0],
      [1, 0],
      [0, -1],
      [-1, 0],
      [0, 1],
      [3, 0],
      [-2, 0],
    ]);
  });

  it('returns an empty range when all tiles fall outside the board', () => {
    expect(rangeTiles({ x: 0, y: 0 }, [[1, 0]], 'left', 3, 2)).toEqual([]);
    expect(rangeTiles(tile, [], 'right', 3, 2)).toEqual([]);
  });
});
