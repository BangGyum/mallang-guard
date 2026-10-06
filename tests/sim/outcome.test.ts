import { describe, expect, it } from 'vitest';
import { content } from '../../src/data';
import { createBattle } from '../../src/sim/battle';
import { secToTicks } from '../../src/sim/constants';
import { hashState } from '../../src/sim/hash';
import { removeDead } from '../../src/sim/systems/death';
import { checkOutcome } from '../../src/sim/systems/outcome';
import { spawnEnemies } from '../../src/sim/systems/spawn';
import type { SimEvent } from '../../src/sim/types';
import { laneStage, makeContent, run } from '../helpers';
import { makeFixture, SPAWN } from './battleFixtures';

describe('battle outcome', () => {
  it('실제 stage-1은 21마리를 계획하고 세 번째 누수로 즉시 패배한다', () => {
    const battle = createBattle(content, 'stage-1');
    const events = run(battle, secToTicks(180));
    expect(battle.state.totalEnemies).toBe(21);
    expect(battle.state).toMatchObject({ phase: 'lost', life: 0, leaked: 3, killed: 0, tick: 804 });
    expect(events.filter((event) => event.type === 'enemySpawn')).toHaveLength(6);
    expect(events.filter((event) => event.type === 'enemyLeak').map((event) => event.uid)).toEqual([1, 2, 3]);
    expect(events.at(-1)).toEqual({ type: 'battleEnd', result: 'lost' });
    expect(events.filter((event) => event.type === 'battleEnd')).toHaveLength(1);
    const endedHash = hashState(battle.state);
    expect(run(battle, 300)).toEqual([]);
    expect(hashState(battle.state)).toBe(endedHash);
  });
  it('테스트용 목숨 22에서 stage-1의 21마리가 모두 이동·누수한다', () => {
    const stage = content.stages.get('stage-1');
    if (!stage) throw new Error('fixture missing');
    const battle = createBattle(makeContent({ stages: [{ ...stage, life: 22 }] }), stage.id);
    const events = run(battle, secToTicks(180));
    const spawned = events.filter((event) => event.type === 'enemySpawn');
    expect(spawned).toHaveLength(21);
    expect(spawned.map((event) => event.uid)).toEqual(Array.from({ length: 21 }, (_, index) => index + 1));
    const counts: Record<string, number> = {};
    for (const event of spawned) counts[event.enemyId] = (counts[event.enemyId] ?? 0) + 1;
    expect(counts).toEqual({ jelly: 15, hardJelly: 3, crow: 3 });
    expect(battle.state).toMatchObject({
      phase: 'won',
      life: 1,
      leaked: 21,
      killed: 0,
      enemies: [],
      currentWave: 5,
    });
    expect(battle.state.spawnCursor).toEqual([3, 4, 2, 1, 5, 1, 2, 3]);
  });
  it('치명적 누수 후 같은 틱의 다른 적도 움직이지 않는다', () => {
    const stage = laneStage(['S.G'], [SPAWN, SPAWN], { life: 1 });
    const { battle } = makeFixture(stage, { speed: 60 });
    expect(battle.step()).toEqual([
      { type: 'enemySpawn', uid: 1, enemyId: 'jelly' },
      { type: 'enemySpawn', uid: 2, enemyId: 'jelly' },
      { type: 'enemyLeak', uid: 1, lifeLeft: 0 },
      { type: 'battleEnd', result: 'lost' },
    ]);
    expect(battle.state).toMatchObject({ phase: 'lost', tick: 1, leaked: 1 });
    expect(battle.state.enemies[0]).toMatchObject({ uid: 2, dist: 0, x: 0.5, y: 0.5 });
    expect(battle.step()).toEqual([]);
    expect(battle.state.tick).toBe(1);
  });
  it('lifeDamage를 그대로 차감하고 0 이하에서 패배한다', () => {
    const { battle } = makeFixture(laneStage(['S.G'], [SPAWN], { life: 1 }), { speed: 60, lifeDamage: 2 });
    expect(battle.step().slice(-2)).toEqual([
      { type: 'enemyLeak', uid: 1, lifeLeft: -1 },
      { type: 'battleEnd', result: 'lost' },
    ]);
    expect(battle.state.phase).toBe('lost');
  });
  it('미래 스폰이 남았으면 적이 없는 틱에도 승리하지 않는다', () => {
    const { battle } = makeFixture(laneStage(['S.G'], [SPAWN, { ...SPAWN, atSec: 1 }]), { speed: 60 });
    expect(battle.step().some((event) => event.type === 'battleEnd')).toBe(false);
    run(battle, 29);
    expect(battle.state).toMatchObject({ tick: 30, phase: 'running', enemies: [] });
    expect(battle.step().at(-1)).toEqual({ type: 'battleEnd', result: 'won' });
    expect(battle.state.life).toBe(1);
    expect(battle.step()).toEqual([]);
  });
  it('모든 스폰이 끝나도 살아 있는 적이 있으면 계속 실행한다', () => {
    const { battle } = makeFixture();
    battle.step();
    expect(battle.state.spawnCursor).toEqual([1]);
    expect(battle.state.phase).toBe('running');
  });
  it('마지막 적의 사망 정리 후 승리 이벤트를 한 번만 낸다', () => {
    const { content: db, state, stage } = makeFixture();
    spawnEnemies(stage, state, []);
    const enemy = state.enemies[0];
    if (enemy) enemy.hp = 0;
    const events: SimEvent[] = [];
    removeDead(db, state, events);
    checkOutcome(stage, state, events);
    checkOutcome(stage, state, events);
    expect(events).toEqual([
      { type: 'enemyDie', uid: 1 },
      { type: 'battleEnd', result: 'won' },
    ]);
    expect(state.killed).toBe(1);
    expect(state.leaked).toBe(0);
  });
  it('전체 웨이브와 현재 웨이브는 스폰 시작 틱과 최대 번호를 따른다', () => {
    const stage = laneStage(
      ['S......G'],
      [
        { ...SPAWN, wave: 2, atSec: 1 / 30 },
        { ...SPAWN, wave: 4, atSec: 3 / 30 },
        { ...SPAWN, wave: 1, atSec: 5 / 30 },
      ],
    );
    const { battle } = makeFixture(stage);
    expect(battle.state.totalWaves).toBe(4);
    const waves = Array.from({ length: 7 }, () => {
      battle.step();
      return battle.state.currentWave;
    });
    expect(waves).toEqual([0, 2, 2, 4, 4, 4, 4]);
  });
  it('스폰 그룹이 없는 전투는 첫 틱에 승리한다', () => {
    const { battle } = makeFixture(laneStage(['S.G'], []));
    expect(battle.state).toMatchObject({ totalEnemies: 0, totalWaves: 0, currentWave: 0 });
    expect(battle.step()).toEqual([{ type: 'battleEnd', result: 'won' }]);
    expect(battle.state.tick).toBe(1);
  });
});
