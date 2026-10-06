import { describe, expect, it } from 'vitest';
import { parseBoard } from '../../src/sim/board';

describe('보드 파싱', () => {
  it('스펙의 타일 문자와 맵 크기를 읽는다', () => {
    const board = parseBoard(['.,H', '#SG']);
    expect([board.width, board.height]).toEqual([3, 2]);
    expect(board.kindAt({ x: 0, y: 0 })).toBe('ground');
    expect(board.kindAt({ x: 1, y: 0 })).toBe('path');
    expect(board.kindAt({ x: 2, y: 0 })).toBe('high');
    expect(board.kindAt({ x: 0, y: 1 })).toBe('blocked');
    expect(board.kindAt({ x: 1, y: 1 })).toBe('spawn');
    expect(board.kindAt({ x: 2, y: 1 })).toBe('goal');
  });

  it('맵 밖과 정수가 아닌 타일을 거부한다', () => {
    const board = parseBoard(['SG']);
    for (const tile of [
      { x: -1, y: 0 },
      { x: 2, y: 0 },
      { x: 0, y: 1 },
      { x: 0.5, y: 0 },
    ]) {
      expect(board.kindAt(tile)).toBeUndefined();
    }
  });

  it.each([[], [''], ['..', '.'], ['?']].map((map) => ({ map })))(
    '잘못된 맵 $map에서 실패한다',
    ({ map }) => {
      expect(() => parseBoard(map)).toThrow();
    },
  );
});
