import { describe, expect, it } from 'vitest';
import { assert } from '../../src/core/assert';

describe('assert', () => {
  it('조건이 거짓이면 전달한 메시지로 실패한다', () => {
    expect(() => assert(false, '사거리를 찾을 수 없습니다')).toThrow('사거리를 찾을 수 없습니다');
  });

  it('참인 조건을 검증하고 타입을 좁힌다', () => {
    const value: unknown = 'mallang';
    assert(typeof value === 'string', '문자열이 필요합니다');
    expect(value.toUpperCase()).toBe('MALLANG');
  });
});
