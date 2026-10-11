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
  it.each([
    [300, 200, 0, 100],
    [300, 200, 50, 150],
    [300, 200, 100, 200],
    [300, 200, 200, 300],
    [300, 200, 500, 300],
    [300, 0, 100, 300],
    [300, 500, 100, 15],
    [300, 500, 200, 15],
    [300, 500, 300, 100],
    [280, 300, 30, 14],
    [280, 300, 50, 30],
    [585, 1000, 120, 29.25],
  ])('공격 %s·방어 %s·관통 %s의 물리 피해는 %s다', (atk, def, pen, damage) => {
    expect(damageAmount('physical', atk, def, 0, pen)).toBe(damage);
  });
  it('마법과 고정 피해에는 관통력이 영향을 주지 않는다', () => {
    expect(damageAmount('magic', 420, 900, 15, 1000)).toBe(357);
    expect(damageAmount('magic', 420, 900, 100, 1000)).toBe(21);
    expect(damageAmount('true', 420, 900, 100, 1000)).toBe(420);
  });
});
