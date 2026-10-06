import { describe, expect, it } from 'vitest';
import stage from '../../src/data/stages/stage-1.json';
import { isWalkable, parseBoard } from '../../src/sim/board';

describe('board', () => {
  it('stage-1 크기와 지형을 파싱한다', () => {
    const board = parseBoard(stage.map);
    expect([board.width, board.height]).toEqual([11, 6]);
    expect(board.kindAt(0, 1)).toBe('spawn');
    expect(board.kindAt(10, 3)).toBe('goal');
    expect(board.kindAt(2, 0)).toBe('high');
    expect(board.kindAt(1, 1)).toBe('ground');
    expect(board.kindAt(0, 0)).toBe('blocked');
  });
  it('path와 범위 밖 좌표를 구분한다', () => {
    const board = parseBoard(['S,G']);
    expect(board.kindAt(1, 0)).toBe('path');
    for (const [x, y] of [
      [-1, 0],
      [3, 0],
      [0, -1],
      [0, 1],
    ])
      expect(board.kindAt(x ?? 0, y ?? 0)).toBeUndefined();
  });
  it('입력 배열의 이후 변경에 영향을 받지 않는다', () => {
    const map = ['S.G'];
    const board = parseBoard(map);
    map[0] = '###';
    expect(board.kindAt(1, 0)).toBe('ground');
  });
  it.each([[], [''], ['S.G', '##'], ['S?G']].map((map) => ({ map })))(
    '잘못된 맵 $map을 거부한다',
    ({ map }) => {
      expect(() => parseBoard(map)).toThrow('board.map');
    },
  );
  it.each(['ground', 'path', 'spawn', 'goal'] as const)('%s는 이동 가능하다', (kind) => {
    expect(isWalkable(kind)).toBe(true);
  });
  it.each(['high', 'blocked', undefined] as const)('%s는 이동할 수 없다', (kind) => {
    expect(isWalkable(kind)).toBe(false);
  });
});
