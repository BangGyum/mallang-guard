import { describe, expect, it } from 'vitest';
import { moveEnemies } from '../../src/sim/systems/movement';
import { spawnEnemies } from '../../src/sim/systems/spawn';
import type { SimEvent } from '../../src/sim/types';
import { laneStage } from '../helpers';
import { makeFixture, SPAWN } from './battleFixtures';

describe('enemy movement', () => {
  it('스폰된 틱부터 한 번 이동하며 이전 위치는 시작점이다', () => {
    const { battle } = makeFixture();
    battle.step();
    expect(battle.state.enemies[0]?.dist).toBeCloseTo(0.03, 12);
    expect(battle.state.enemies[0]).toMatchObject({ px: 0.5, py: 0.5, x: 0.53, y: 0.5 });
    battle.step();
    expect(battle.state.enemies[0]?.dist).toBeCloseTo(0.06, 12);
    expect(battle.state.enemies[0]).toMatchObject({ px: 0.53, py: 0.5, x: 0.56, y: 0.5 });
  });
  it('꺾이는 점에서 위치와 구간 캐시를 갱신한다', () => {
    const { battle } = makeFixture(laneStage(['S.', '#G'], [SPAWN]), { speed: 30 });
    battle.step();
    expect(battle.state.enemies[0]).toMatchObject({ dist: 1, x: 1.5, y: 0.5, segIndex: 1, px: 0.5, py: 0.5 });
    expect(battle.step()).toEqual([
      { type: 'enemyLeak', uid: 1, lifeLeft: 2 },
      { type: 'battleEnd', result: 'won' },
    ]);
  });
  it('둔화 비율을 이동 속도에 반영한다', () => {
    const { content, state, stage } = makeFixture();
    spawnEnemies(stage, state, []);
    const enemy = state.enemies[0];
    if (!enemy) throw new Error('fixture missing');
    enemy.slowAmount = 0.5;
    moveEnemies(content, stage, state, []);
    expect(enemy.dist).toBeCloseTo(0.015, 12);
    expect(enemy.x).toBe(0.515);
  });
  it('기절 중에도 이전 위치는 갱신한다', () => {
    const { content, state, stage } = makeFixture();
    spawnEnemies(stage, state, []);
    const enemy = state.enemies[0];
    if (!enemy) throw new Error('fixture missing');
    enemy.stunUntilTick = 2;
    enemy.px = -1;
    enemy.py = -1;
    moveEnemies(content, stage, state, []);
    expect(enemy).toMatchObject({ dist: 0, x: 0.5, y: 0.5, px: 0.5, py: 0.5 });
  });
  it('기절 중에는 멈추고 만료 틱부터 움직인다', () => {
    const { content, state, stage } = makeFixture();
    spawnEnemies(stage, state, []);
    const enemy = state.enemies[0];
    if (!enemy) throw new Error('fixture missing');
    enemy.stunUntilTick = 2;
    moveEnemies(content, stage, state, []);
    state.tick = 1;
    moveEnemies(content, stage, state, []);
    expect(enemy.dist).toBe(0);
    state.tick = 2;
    moveEnemies(content, stage, state, []);
    expect(enemy.dist).toBeCloseTo(0.03, 12);
  });
  it('사망한 적은 이동·누수 없이 사망 정리를 기다린다', () => {
    const { content, state, stage } = makeFixture(laneStage(['S.G'], [SPAWN]), { speed: 90 });
    spawnEnemies(stage, state, []);
    const enemy = state.enemies[0];
    if (!enemy) throw new Error('fixture missing');
    enemy.hp = 0;
    const events: SimEvent[] = [];
    moveEnemies(content, stage, state, events);
    expect(state.life).toBe(3);
    expect(state.leaked).toBe(0);
    expect(events).toEqual([]);
    expect(enemy.dist).toBe(0);
  });
  it('비행 적은 대각선 거리로 직선 경로를 따라간다', () => {
    const { battle } = makeFixture(
      laneStage(['S##', '###', '##G'], [{ ...SPAWN, enemy: 'crow', route: 'air' }], {
        routes: { air: { from: [0, 0], to: [2, 2], flying: true } },
      }),
    );
    battle.step();
    const enemy = battle.state.enemies[0];
    if (!enemy) throw new Error('fixture missing');
    expect(enemy.dist).toBe(0.04);
    expect(enemy.x).toBeCloseTo(0.5 + 0.04 / Math.sqrt(2), 12);
    expect(enemy.y).toBeCloseTo(enemy.x, 12);
  });
});
