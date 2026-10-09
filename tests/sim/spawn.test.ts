import { describe, expect, it } from 'vitest';
import { spawnEnemies } from '../../src/sim/systems/spawn';
import type { SimEvent } from '../../src/sim/types';
import { laneStage, run } from '../helpers';
import { makeFixture, SPAWN } from './battleFixtures';

describe('enemy spawn', () => {
  it('스폰 단계에서 모든 초기 필드를 설정한다', () => {
    const { state, stage } = makeFixture();
    const events: SimEvent[] = [];
    spawnEnemies(stage, state, events);
    expect(state.enemies).toEqual([
      {
        uid: 1,
        enemyId: 'jelly',
        routeId: 'ground',
        dist: 0,
        segIndex: 0,
        x: 0.5,
        y: 0.5,
        px: 0.5,
        py: 0.5,
        hp: 600,
        maxHp: 600,
        slowAmount: 0,
        slowUntilTick: 0,
        stunUntilTick: 0,
        abilityCooldown: 0,
        shield: 0,
        speedMul: 1,
        rushCooldown: 0,
        rushUntilTick: 0,
        regenCooldown: 0,
        healCooldown: 0,
        summonCooldown: 0,
        summonsRemaining: 0,
      },
    ]);
    expect(events).toEqual([{ type: 'enemySpawn', uid: 1, enemyId: 'jelly', x: 0.5, y: 0.5 }]);
    expect(state.spawnCursor).toEqual([1]);
    expect(state.nextUid).toBe(2);
    expect(state.currentWave).toBe(1);
  });
  it('양수 초 값은 최소 1틱이고 그룹 간격을 개별적으로 반올림한다', () => {
    const { battle } = makeFixture(
      laneStage(['S......G'], [{ ...SPAWN, atSec: 0.001, count: 3, intervalSec: 0.05 }]),
    );
    const spawned: number[] = [];
    for (let tick = 0; tick < 10; tick += 1) {
      const events = battle.step();
      if (events.some((event) => event.type === 'enemySpawn')) spawned.push(tick);
    }
    expect(spawned).toEqual([1, 3, 5]);
    expect(battle.state.spawnCursor).toEqual([3]);
  });
  it('같은 틱의 스폰은 그룹 배열 순서로 uid를 받는다', () => {
    const stage = laneStage(
      ['S......G'],
      [
        { ...SPAWN, wave: 3, count: 2, intervalSec: 1 / 30 },
        { ...SPAWN, wave: 2, enemy: 'hardJelly', count: 2, intervalSec: 1 / 30 },
      ],
    );
    const { battle } = makeFixture(stage);
    const events = run(battle, 2).filter((event) => event.type === 'enemySpawn');
    expect(events).toEqual([
      { type: 'enemySpawn', uid: 1, enemyId: 'jelly', x: 0.5, y: 0.5 },
      { type: 'enemySpawn', uid: 2, enemyId: 'hardJelly', x: 0.5, y: 0.5 },
      { type: 'enemySpawn', uid: 3, enemyId: 'jelly', x: 0.5, y: 0.5 },
      { type: 'enemySpawn', uid: 4, enemyId: 'hardJelly', x: 0.5, y: 0.5 },
    ]);
    expect(battle.state.enemies.map((enemy) => enemy.uid)).toEqual([1, 2, 3, 4]);
    expect(battle.state.currentWave).toBe(3);
  });
  it('공유 uid 카운터의 현재 값부터 시작한다', () => {
    const { state, stage } = makeFixture();
    state.nextUid = 10;
    spawnEnemies(stage, state, []);
    expect(state.enemies[0]?.uid).toBe(10);
    expect(state.nextUid).toBe(11);
  });
  it('비행 적을 비행 경로 시작점에 낸다', () => {
    const stage = laneStage(['S#H', '###', '##G'], [{ ...SPAWN, enemy: 'crow', route: 'air' }], {
      routes: { air: { from: [0, 0], to: [2, 2], flying: true } },
    });
    const { state, stage: runtime } = makeFixture(stage);
    spawnEnemies(runtime, state, []);
    expect(state.enemies[0]).toMatchObject({ enemyId: 'crow', routeId: 'air', x: 0.5, y: 0.5 });
  });
  it('예정된 스폰이 끝나면 중복 스폰하지 않는다', () => {
    const { battle } = makeFixture();
    expect(run(battle, 10).filter((event) => event.type === 'enemySpawn')).toHaveLength(1);
  });
});
