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
  it('아크 폭격 피해·사망·분열 표시는 낙하탄 도착을 기다린다', () => {
    const pulse: SimEvent = { type: 'skillPulse', uid: 1 };
    const death: SimEvent = { type: 'enemyDie', uid: 3 };
    const child: SimEvent = { type: 'enemySpawn', uid: 4, enemyId: 'miniJelly', x: 1, y: 1, parentUid: 3 };
    const delays = impactDelays([pulse, damage, death, child]);
    for (const event of [damage, death, child]) expect(delays.get(event)).toBe(0.4);
  });
  it('같은 틱의 폭격과 기본 사격은 각각 0.4초와 0.25초로 구분한다', () => {
    const shotDamage: SimEvent = { ...damage, dst: { kind: 'enemy', uid: 4 } };
    const delays = impactDelays([{ type: 'skillPulse', uid: 1 }, damage, ranged, shotDamage]);
    expect(delays.get(damage)).toBe(0.4);
    expect(delays.get(shotDamage)).toBe(0.25);
    const reverse = impactDelays([ranged, shotDamage, { type: 'skillPulse', uid: 1 }, damage]);
    expect(reverse.get(shotDamage)).toBe(0.25);
    expect(reverse.get(damage)).toBe(0.4);
  });
  it('낙하탄의 예약 시간은 다른 유닛의 즉시 피해로 전파되지 않는다', () => {
    const immediate: SimEvent = { ...damage, src: { kind: 'unit', uid: 2 } };
    expect(impactDelays([{ type: 'skillPulse', uid: 1 }, immediate]).has(immediate)).toBe(false);
  });
  it('분열 자식의 그림도 부모를 맞힌 투사체 도착에 맞춘다', () => {
    const child: SimEvent = { type: 'enemySpawn', uid: 4, enemyId: 'miniJelly', x: 1, y: 1, parentUid: 3 };
    expect(impactDelays([ranged, damage, { type: 'enemyDie', uid: 3 }, child]).get(child)).toBe(0.25);
    expect(impactDelays([{ type: 'enemyDie', uid: 3 }, child]).get(child)).toBe(0);
  });
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
