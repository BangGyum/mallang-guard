import { describe, expect, it } from 'vitest';
import { clamp, dist, lerp } from '../../src/core/math';

describe('clamp', () => {
  it.each([
    [-3, 0],
    [0, 0],
    [0.25, 0.25],
    [1, 1],
    [4, 1],
  ])('clamp(%s, 0, 1) = %s', (value, expected) => {
    expect(clamp(value, 0, 1)).toBe(expected);
  });
});

describe('lerp', () => {
  it.each([
    [0, 2],
    [0.25, 4],
    [1, 10],
    [1.5, 14],
  ])('lerp(2, 10, %s) = %s', (alpha, expected) => {
    expect(lerp(2, 10, alpha)).toBe(expected);
  });
});

describe('dist', () => {
  it('두 좌표 사이의 유클리드 거리를 계산한다', () => {
    expect(dist({ x: -1, y: -2 }, { x: 2, y: 2 })).toBe(5);
    expect(dist({ x: 2, y: 2 }, { x: -1, y: -2 })).toBe(5);
  });

  it('같은 좌표의 거리는 0이다', () => {
    expect(dist({ x: 0.5, y: 1.5 }, { x: 0.5, y: 1.5 })).toBe(0);
  });
});
