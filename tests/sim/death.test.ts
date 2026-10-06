import { describe, expect, it } from 'vitest';
import { removeDead } from '../../src/sim/systems/death';
import { spawnEnemies } from '../../src/sim/systems/spawn';
import type { SimEvent } from '../../src/sim/types';
import { laneStage } from '../helpers';
import { makeFixture, SPAWN, unitFixture } from './battleFixtures';

describe('death cleanup', () => {
  it('죽은 적만 uid 순서로 정리하고 중복 카운트하지 않는다', () => {
    const { content, state, stage } = makeFixture(laneStage(['S......G'], [SPAWN, SPAWN, SPAWN]));
    spawnEnemies(stage, state, []);
    const first = state.enemies[0];
    const last = state.enemies[2];
    if (first) first.hp = 0;
    if (last) last.hp = -20;
    const events: SimEvent[] = [];
    removeDead(content, state, events);
    removeDead(content, state, events);
    expect(events).toEqual([
      { type: 'enemyDie', uid: 1 },
      { type: 'enemyDie', uid: 3 },
    ]);
    expect(state.enemies.map((enemy) => enemy.uid)).toEqual([2]);
    expect(state.killed).toBe(2);
    expect(state.leaked).toBe(0);
  });
  it('적 사망 시 저지 해제 이벤트를 사망보다 먼저 낸다', () => {
    const { content, state, stage } = makeFixture();
    spawnEnemies(stage, state, []);
    const enemy = state.enemies[0];
    if (!enemy) throw new Error('fixture missing');
    enemy.blockedBy = 2;
    enemy.hp = 0;
    state.units.push(unitFixture({ blocking: [1] }));
    const events: SimEvent[] = [];
    removeDead(content, state, events);
    expect(events).toEqual([
      { type: 'unblock', unit: 2, enemy: 1 },
      { type: 'enemyDie', uid: 1 },
    ]);
    expect(state.units[0]?.blocking).toEqual([]);
  });
  it('유닛 사망 시 저지를 풀고 환급 없이 재배치 대기로 바꾼다', () => {
    const { content, state, stage } = makeFixture();
    spawnEnemies(stage, state, []);
    const enemy = state.enemies[0];
    const slot = state.roster.find((entry) => entry.unitId === 'squirrel');
    if (!enemy || !slot) throw new Error('fixture missing');
    enemy.blockedBy = 2;
    state.units.push(unitFixture({ hp: 0, blocking: [1] }));
    slot.state = 'deployed';
    slot.uid = 2;
    const events: SimEvent[] = [];
    removeDead(content, state, events);
    expect(events).toEqual([
      { type: 'unblock', unit: 2, enemy: 1 },
      { type: 'unitDie', uid: 2 },
    ]);
    expect(state.units).toEqual([]);
    expect(enemy.blockedBy).toBeNull();
    expect(slot).toMatchObject({ state: 'cooldown', cooldownTicks: 900, uid: null });
    expect(state.dp).toBe(10);
  });
  it('같은 틱의 적·유닛 사망은 저지를 한 번만 해제한다', () => {
    const { content, state, stage } = makeFixture();
    spawnEnemies(stage, state, []);
    const enemy = state.enemies[0];
    const slot = state.roster.find((entry) => entry.unitId === 'squirrel');
    if (!enemy || !slot) throw new Error('fixture missing');
    enemy.blockedBy = 2;
    enemy.hp = 0;
    state.units.push(unitFixture({ hp: 0, blocking: [1] }));
    slot.state = 'deployed';
    slot.uid = 2;
    const events: SimEvent[] = [];
    removeDead(content, state, events);
    expect(events).toEqual([
      { type: 'unblock', unit: 2, enemy: 1 },
      { type: 'enemyDie', uid: 1 },
      { type: 'unitDie', uid: 2 },
    ]);
    expect([state.enemies.length, state.units.length, state.killed]).toEqual([0, 0, 1]);
  });
});
