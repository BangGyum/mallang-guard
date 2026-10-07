import { describe, expect, it } from 'vitest';
import { attackEnemies } from '../../src/sim/systems/attack';
import { attackUnits } from '../../src/sim/systems/enemyAttack';
import type { SimEvent } from '../../src/sim/types';
import { laneStage, run } from '../helpers';
import { makeFixture, SPAWN, unitFixture } from './battleFixtures';
import { combatFixture, placeEnemy } from './combatFixtures';

describe('공격', () => {
  it('저지가 풀린 동안에도 적 쿨다운이 감소해 다시 접촉하면 즉시 공격할 수 있다', () => {
    const f = combatFixture();
    const unit = f.state.units[0];
    if (!unit) throw new Error('unit');
    const enemy = placeEnemy(f, 0.8, { atkCooldown: 2 });
    f.state.enemies = [enemy];
    const events: SimEvent[] = [];
    attackUnits(f.content, f.state, events);
    expect(enemy.atkCooldown).toBe(1);
    attackUnits(f.content, f.state, events);
    expect(enemy.atkCooldown).toBe(0);
    expect(events).toEqual([]);
    enemy.blockedBy = unit.uid;
    attackUnits(f.content, f.state, events);
    expect(events.filter((event) => event.type === 'attack')).toHaveLength(1);
  });
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
    f.state.units.push(unitFixture({ uid: 10, dir: 'left' }));
    const events: SimEvent[] = [];
    attackEnemies(f.content, f.stage, f.state, events);
    expect(events.filter((event) => event.type === 'attack')).toHaveLength(1);
  });
  it('저지된 적만 반격하며 기절은 쿨다운도 멈추고 atk 0은 공격하지 않는다', () => {
    const f = combatFixture();
    const unit = f.state.units[0];
    if (!unit) throw new Error('unit');
    const enemy = placeEnemy(f, 0.8);
    f.state.enemies = [enemy];
    const events: SimEvent[] = [];
    attackUnits(f.content, f.state, events);
    expect(events).toHaveLength(0);
    enemy.blockedBy = unit.uid;
    attackUnits(f.content, f.state, events);
    expect(unit.hp).toBe(990);
    expect(enemy.atkCooldown).toBe(51);
    enemy.stunUntilTick = 5;
    attackUnits(f.content, f.state, events);
    expect(enemy.atkCooldown).toBe(51);
    enemy.stunUntilTick = 0;
    enemy.enemyId = 'crow';
    enemy.atkCooldown = 0;
    attackUnits(f.content, f.state, events);
    expect(events.filter((event) => event.type === 'attack')).toHaveLength(1);
  });
  it('메딕이 회복하며 최대 HP를 넘지 않는다', () => {
    const f = combatFixture();
    const ally = unitFixture({ uid: 1, tile: { x: 2, y: 0 }, hp: 1090 });
    f.state.units = [ally, unitFixture({ uid: 2, unitId: 'bunny', dir: 'right' })];
    const events: SimEvent[] = [];
    attackEnemies(f.content, f.stage, f.state, events);
    expect(ally.hp).toBe(1100);
    expect(events).toContainEqual({
      type: 'heal',
      src: { kind: 'unit', uid: 2 },
      dst: { kind: 'unit', uid: 1 },
      amount: 10,
    });
  });
  it('명령→이동→저지→공격→사망으로 적을 막고 처치해 승리한다', () => {
    const { battle } = makeFixture(laneStage(['S...G'], [SPAWN]));
    battle.enqueue({ type: 'deploy', unitId: 'squirrel', tile: { x: 1, y: 0 }, dir: 'left' });
    const events = run(battle, 200);
    expect(battle.state).toMatchObject({ phase: 'won', killed: 1, leaked: 0, life: 3 });
    expect(events.some((event) => event.type === 'block')).toBe(true);
    expect(events.filter((event) => event.type === 'battleEnd')).toEqual([
      { type: 'battleEnd', result: 'won' },
    ]);
  });
});
