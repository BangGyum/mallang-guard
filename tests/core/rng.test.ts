import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../../src/core/rng';

function sequence(state: number, count: number) {
  const values: number[] = [];
  for (let i = 0; i < count; i += 1) {
    const next = mulberry32(state);
    state = next.state;
    values.push(next.value);
  }
  return { state, values };
}

describe('mulberry32', () => {
  // 원본 uint32 알고리즘을 독립적인 BigInt 연산으로 계산한 고정 벡터입니다.
  it.each([
    { seed: 0, expected: [1144304738, 1416247, 958946056, 627933444, 2007157716, 2340967985] },
    { seed: 1, expected: [2693262067, 11749833, 2265367787, 4213581821, 4159151403, 1207330352] },
  ])('시드 $seed에서 고정된 순서를 재현한다', ({ seed, expected }) => {
    const result = sequence(seed, expected.length);
    expect(result.values.map((value) => value * 4294967296)).toEqual(expected);
  });

  it('저장된 상태에서 난수 순서를 이어갈 수 있다', () => {
    const full = sequence(42, 12);
    const first = sequence(42, 5);
    const restored = sequence(first.state, 7);
    expect([...first.values, ...restored.values]).toEqual(full.values);
    expect(restored.state).toBe(full.state);
  });

  it('상태는 uint32 범위, 난수는 0 이상 1 미만을 유지한다', () => {
    let state = 0xffffffff;
    for (let i = 0; i < 64; i += 1) {
      const next = mulberry32(state);
      expect(Number.isInteger(next.state)).toBe(true);
      expect(next.state).toBeGreaterThanOrEqual(0);
      expect(next.state).toBeLessThanOrEqual(0xffffffff);
      expect(next.value).toBeGreaterThanOrEqual(0);
      expect(next.value).toBeLessThan(1);
      state = next.state;
    }
  });
});
