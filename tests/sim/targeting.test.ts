import { describe, expect, it } from 'vitest';
import { pickAlly, pickEnemy } from '../../src/sim/targeting';
import { unitFixture } from './battleFixtures';
import { combatFixture, placeEnemy } from './combatFixtures';

describe('대상 선택', () => {
  it('저지 순서 → 남은 거리 → uid 순서로 고르며 죽은 적은 제외한다', () => {
    const f = combatFixture();
    const unit = f.state.units[0];
    if (!unit) throw new Error('unit');
    const a = placeEnemy(f, 0.7);
    const b = placeEnemy(f, 0.8);
    const dead = placeEnemy(f, 0.9, { hp: 0 });
    f.state.enemies = [a, b, dead];
    expect(pickEnemy(f.content, f.stage, f.state, unit)?.uid).toBe(b.uid);
    unit.blocking = [a.uid];
    expect(pickEnemy(f.content, f.stage, f.state, unit)?.uid).toBe(a.uid);
    unit.blocking = [];
    a.dist = b.dist;
    expect(pickEnemy(f.content, f.stage, f.state, unit)?.uid).toBe(a.uid);
  });
  it('저지된 적은 사거리 밖이어도 공격하고 비행은 대공 유닛만 공격한다', () => {
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
    unit.blocking = [enemy.uid];
    expect(pickEnemy(f.content, f.stage, f.state, unit)?.uid).toBe(enemy.uid);
  });
  it('메딕은 HP 비율이 낮은 아군·uid를 우선하고 다친 아군이 없으면 기다린다', () => {
    const f = combatFixture();
    const medic = unitFixture({ uid: 10, unitId: 'bunny', tile: { x: 1, y: 0 }, dir: 'right' });
    const a = unitFixture({ uid: 2, tile: { x: 2, y: 0 }, hp: 500, maxHp: 1000 });
    const b = unitFixture({ uid: 3, tile: { x: 3, y: 0 }, hp: 200, maxHp: 1000 });
    f.state.units = [a, b, medic];
    expect(pickAlly(f.content, f.stage, f.state, medic)?.uid).toBe(3);
    a.hp = 200;
    expect(pickAlly(f.content, f.stage, f.state, medic)?.uid).toBe(2);
    a.hp = a.maxHp;
    b.hp = b.maxHp;
    expect(pickAlly(f.content, f.stage, f.state, medic)).toBeUndefined();
  });
});
