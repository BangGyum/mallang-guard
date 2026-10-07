import { describe, expect, it } from 'vitest';
import { pickEnemy } from '../../src/sim/targeting';
import { combatFixture, placeEnemy } from './combatFixtures';

describe('대상 선택', () => {
  it('남은 거리 → uid 순서로 고르며 죽은 적은 제외한다', () => {
    const f = combatFixture();
    const unit = f.state.units[0];
    if (!unit) throw new Error('unit');
    const a = placeEnemy(f, 0.7);
    const b = placeEnemy(f, 0.8);
    const dead = placeEnemy(f, 0.9, { hp: 0 });
    f.state.enemies = [a, b, dead];
    expect(pickEnemy(f.content, f.stage, f.state, unit)?.uid).toBe(b.uid);
    a.dist = b.dist;
    expect(pickEnemy(f.content, f.stage, f.state, unit)?.uid).toBe(a.uid);
  });
  it('사거리 밖은 공격하지 않고 비행은 대공 유닛만 공격한다', () => {
    const f = combatFixture();
    const unit = f.state.units[0];
    if (!unit) throw new Error('unit');
    const enemy = placeEnemy(f, 0.8, { enemyId: 'crow', routeId: 'air' });
    f.state.enemies = [enemy];
    expect(pickEnemy(f.content, f.stage, f.state, unit)).toBeUndefined();
    unit.unitId = 'penguin';
    expect(pickEnemy(f.content, f.stage, f.state, unit)?.uid).toBe(enemy.uid);
    enemy.enemyId = 'jelly';
    enemy.x = 6.5;
    unit.unitId = 'squirrel';
    expect(pickEnemy(f.content, f.stage, f.state, unit)).toBeUndefined();
  });
});
