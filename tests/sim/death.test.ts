import { describe, expect, it } from 'vitest';
import { removeDead } from '../../src/sim/systems/death';
import { spawnEnemies } from '../../src/sim/systems/spawn';
import type { SimEvent } from '../../src/sim/types';
import { laneStage } from '../helpers';
import { makeFixture, SPAWN } from './battleFixtures';

describe('death cleanup', () => {
  it('죽은 적만 uid 순서로 정리하고 중복 카운트하지 않는다', () => {
    const { state, stage } = makeFixture(laneStage(['S......G'], [SPAWN, SPAWN, SPAWN]));
    spawnEnemies(stage, state, []);
    const first = state.enemies[0];
    const last = state.enemies[2];
    if (first) first.hp = 0;
    if (last) last.hp = -20;
    const events: SimEvent[] = [];
    removeDead(state, events);
    removeDead(state, events);
    expect(events).toEqual([
      { type: 'enemyDie', uid: 1 },
      { type: 'enemyDie', uid: 3 },
    ]);
    expect(state.enemies.map((enemy) => enemy.uid)).toEqual([2]);
    expect(state.killed).toBe(2);
    expect(state.leaked).toBe(0);
  });
});
