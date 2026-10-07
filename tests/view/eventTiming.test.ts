import { describe, expect, it } from 'vitest';
import type { SimEvent } from '../../src/sim/types';
import { impactDelays } from '../../src/view/eventTiming';

const ranged: SimEvent = {
  type: 'attack',
  src: { kind: 'unit', uid: 1 },
  dst: { kind: 'enemy', uid: 3 },
  damageType: 'physical',
  ranged: true,
};
const damage: SimEvent = {
  type: 'damage',
  src: { kind: 'unit', uid: 1 },
  dst: { kind: 'enemy', uid: 3 },
  amount: 100,
  damageType: 'physical',
};
describe('피격 연출 시각', () => {
  it('원거리 피해와 사망을 투사체 도착까지 늦춘다', () => {
    const death: SimEvent = { type: 'enemyDie', uid: 3 };
    const delays = impactDelays([ranged, damage, death]);
    expect(delays.get(damage)).toBe(0.25);
    expect(delays.get(death)).toBe(0.25);
  });
  it('스플래시의 추가 대상도 같은 시각에 피해를 표시한다', () => {
    const splash: SimEvent = { ...damage, dst: { kind: 'enemy', uid: 4 } };
    expect(impactDelays([ranged, damage, splash]).get(splash)).toBe(0.25);
  });
  it('같은 대상의 근접 피해는 늦추지 않는다', () => {
    const melee: SimEvent = { ...damage, src: { kind: 'unit', uid: 2 } };
    expect(impactDelays([ranged, damage, melee]).has(melee)).toBe(false);
  });
  it('원거리 공격보다 먼저 발동한 즉시 펄스도 늦추지 않는다', () => {
    expect(impactDelays([damage, ranged]).has(damage)).toBe(false);
  });
});
