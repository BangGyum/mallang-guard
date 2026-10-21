import { describe, expect, it } from 'vitest';
import { attackEnemies } from '../../src/sim/systems/attack';
import type { SimEvent } from '../../src/sim/types';
import { laneStage, run } from '../helpers';
import { makeFixture, SPAWN, unitFixture } from './battleFixtures';
import { combatFixture, placeEnemy } from './combatFixtures';

describe('공격', () => {
  it('첫 대상 즉시 공격하고 30틱 간격으로 공격한다', () => {
    const f = combatFixture();
    f.state.enemies = [placeEnemy(f, 0.8, { hp: 5000 })];
    const events: SimEvent[] = [];
    attackEnemies(f.content, f.stage, f.state, events);
    expect(events.map((event) => event.type)).toEqual(['attack', 'damage']);
    for (let i = 0; i < 29; i++) attackEnemies(f.content, f.stage, f.state, events);
    expect(events.filter((event) => event.type === 'attack')).toHaveLength(1);
    attackEnemies(f.content, f.stage, f.state, events);
    expect(events.filter((event) => event.type === 'attack')).toHaveLength(2);
  });
  it('대상이 없으면 쿨다운은 0이고 죽은 적을 다시 공격하지 않는다', () => {
    const f = combatFixture();
    f.state.enemies = [];
    attackEnemies(f.content, f.stage, f.state, []);
    expect(f.state.units[0]?.atkCooldown).toBe(0);
    f.state.enemies = [placeEnemy(combatFixture(), 0.8, { hp: 1 })];
    f.state.units.push(unitFixture({ uid: 10, dir: 'up' }));
    const events: SimEvent[] = [];
    attackEnemies(f.content, f.stage, f.state, events);
    expect(events.filter((event) => event.type === 'attack')).toHaveLength(1);
  });
  it('명령→이동→자동 공격→사망으로 적을 막고 처치해 승리한다', () => {
    const { battle } = makeFixture(laneStage(['S...G', 'HHHHH'], [SPAWN]));
    battle.enqueue({ type: 'deploy', unitId: 'squirrel', tile: { x: 1, y: 1 }, dir: 'up' });
    const events = run(battle, 200);
    expect(battle.state).toMatchObject({ phase: 'won', killed: 1, leaked: 0, life: 3 });
    expect(
      events
        .filter((event) => event.type === 'attack')
        .every((event) => event.src.kind === 'unit' && event.dst.kind === 'enemy'),
    ).toBe(true);
    expect(events.filter((event) => event.type === 'battleEnd')).toEqual([
      { type: 'battleEnd', result: 'won' },
    ]);
  });
});
