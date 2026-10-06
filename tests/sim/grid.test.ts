import { describe, expect, it } from 'vitest';
import { rangeTiles, rotateOffset } from '../../src/core/grid';

const directions = [
  { dir: 'right', axial: [1, 0], diagonal: [1, -1] },
  { dir: 'down', axial: [0, 1], diagonal: [1, 1] },
  { dir: 'left', axial: [-1, 0], diagonal: [-1, 1] },
  { dir: 'up', axial: [0, -1], diagonal: [-1, -1] },
] as const;

const ranges = [
  {
    dir: 'right',
    expected: [
      [2, 2],
      [3, 2],
      [3, 1],
      [4, 2],
      [2, 3],
    ],
  },
  {
    dir: 'down',
    expected: [
      [2, 2],
      [2, 3],
      [3, 3],
      [2, 4],
      [1, 2],
    ],
  },
  {
    dir: 'left',
    expected: [
      [2, 2],
      [1, 2],
      [1, 3],
      [0, 2],
      [2, 1],
    ],
  },
  {
    dir: 'up',
    expected: [
      [2, 2],
      [2, 1],
      [1, 1],
      [2, 0],
      [3, 2],
    ],
  },
] as const;

const offsets = [
  [0, 0],
  [1, 0],
  [1, -1],
  [2, 0],
  [0, 1],
] as const;

describe('rotateOffset', () => {
  it.each(directions)('$dir 방향으로 앞 칸을 회전한다', ({ dir, axial }) => {
    expect(rotateOffset([1, 0], dir)).toEqual(axial);
  });

  it.each(directions)('$dir 방향으로 대각선 칸을 회전한다', ({ dir, diagonal }) => {
    expect(rotateOffset([1, -1], dir)).toEqual(diagonal);
  });

  it.each(directions)('$dir 방향에서도 자기 칸은 같다', ({ dir }) => {
    expect(rotateOffset([0, 0], dir)).toEqual([0, 0]);
  });
});

describe('rangeTiles', () => {
  it.each(ranges)('$dir 방향으로 회전한 사거리를 유닛 위치로 옮긴다', ({ dir, expected }) => {
    expect(rangeTiles({ x: 2, y: 2 }, offsets, dir, 5, 5)).toEqual(expected.map(([x, y]) => ({ x, y })));
  });

  it('맵의 네 경계 밖을 제외하고 마지막 행과 열은 포함한다', () => {
    const edgeOffsets = [
      [0, 0],
      [-1, 0],
      [0, -1],
      [3, 0],
      [0, 2],
      [2, 1],
    ] as const;
    expect(rangeTiles({ x: 0, y: 0 }, edgeOffsets, 'right', 3, 2)).toEqual([
      { x: 0, y: 0 },
      { x: 2, y: 1 },
    ]);
  });

  it('회전한 결과를 기준으로 맵 밖 좌표를 제외한다', () => {
    expect(
      rangeTiles(
        { x: 0, y: 0 },
        [
          [1, 0],
          [1, -1],
          [0, 0],
        ],
        'left',
        3,
        3,
      ),
    ).toEqual([{ x: 0, y: 0 }]);
  });

  it('비어 있는 사거리는 비어 있는 결과를 반환한다', () => {
    expect(rangeTiles({ x: 1, y: 1 }, [], 'down', 3, 3)).toEqual([]);
  });

  it('입력 타일과 오프셋을 변경하지 않는다', () => {
    const tile = Object.freeze({ x: 2, y: 2 });
    const range = Object.freeze([Object.freeze([1, -1] as const)]);
    expect(rangeTiles(tile, range, 'down', 5, 5)).toEqual([{ x: 3, y: 3 }]);
    expect(tile).toEqual({ x: 2, y: 2 });
    expect(range).toEqual([[1, -1]]);
  });
});
