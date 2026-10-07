import { describe, expect, it } from 'vitest';
import { damageAmount } from '../../src/sim/formulas';

describe('피해와 회복', () => {
  it('물리 피해와 최소 5% 피해를 계산한다', () => {
    expect(damageAmount('physical', 280, 50, 0)).toBe(230);
    expect(damageAmount('physical', 280, 300, 0)).toBe(14);
  });
  it('마법 저항·최소 피해·고정 피해를 계산한다', () => {
    expect(damageAmount('magic', 420, 900, 15)).toBe(357);
    expect(damageAmount('magic', 420, 0, 100)).toBe(21);
    expect(damageAmount('true', 420, 900, 100)).toBe(420);
  });
});
