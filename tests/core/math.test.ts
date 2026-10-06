import { describe, expect, it } from 'vitest';
import { clamp, dist, lerp } from '../../src/core/math';

describe('clamp', () => {
  it.each([
    { value: -1, expected: 0 },
    { value: 0, expected: 0 },
    { value: 5, expected: 5 },
    { value: 10, expected: 10 },
    { value: 11, expected: 10 },
  ])('$value를 닫힌 범위로 제한한다', ({ value, expected }) => {
    expect(clamp(value, 0, 10)).toBe(expected);
  });
});

describe('lerp', () => {
  it.each([
    { alpha: 0, expected: -10 },
    { alpha: 0.25, expected: -5 },
    { alpha: 1, expected: 10 },
  ])('$alpha 비율로 보간한다', ({ alpha, expected }) => {
    expect(lerp(-10, 10, alpha)).toBe(expected);
  });
});

describe('dist', () => {
  it('음수와 소수 좌표 사이의 유클리드 거리를 계산한다', () => {
    expect(dist(-1.5, 2.5, 1.5, 6.5)).toBe(5);
  });

  it('같은 위치의 거리는 0이다', () => {
    expect(dist(2, 3, 2, 3)).toBe(0);
  });
});
