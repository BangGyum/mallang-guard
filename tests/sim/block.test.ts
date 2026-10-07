import { describe, expect, it } from 'vitest';
import { blockEnemies } from '../../src/sim/systems/block';
import { applyCommand } from '../../src/sim/systems/commands';
import { moveEnemies } from '../../src/sim/systems/movement';
import type { SimEvent } from '../../src/sim/types';
import { combatFixture, placeEnemy } from './combatFixtures';

describe('저지', () => {
  it('저지 1은 먼저 도착한 적만 멈추고 나머지는 이동한다', () => {
    const f = combatFixture();
    const a = placeEnemy(f, 0.8);
    const b = placeEnemy(f, 0.7);
    f.state.enemies = [a, b];
    blockEnemies(f.content, f.stage, f.state, []);
    expect(a.blockedBy).toBe(f.state.units[0]?.uid);
    expect(b.blockedBy).toBeNull();
    moveEnemies(f.content, f.stage, f.state, []);
    expect(a.dist).toBe(0.8);
    expect(b.dist).toBeGreaterThan(0.7);
  });
  it('후퇴하면 저지를 풀고 다시 움직인다', () => {
    const f = combatFixture();
    const unit = f.state.units[0];
    if (!unit) throw new Error('unit');
    const slot = f.state.roster[0];
    if (!slot) throw new Error('slot');
    slot.state = 'deployed';
    slot.uid = unit.uid;
    f.state.enemies = [placeEnemy(f, 0.8)];
    blockEnemies(f.content, f.stage, f.state, []);
    const events: SimEvent[] = [];
    applyCommand(f.content, f.stage, f.state, { type: 'retreat', uid: unit.uid }, events);
    expect(events[0]).toMatchObject({ type: 'unblock' });
    moveEnemies(f.content, f.stage, f.state, []);
    expect(f.state.enemies[0]?.dist).toBeGreaterThan(0.8);
  });
  it('비행·이미 지나간 적·저지 비용 초과·죽은 적은 저지하지 않는다', () => {
    for (const kind of ['air', 'behind', 'cost', 'dead']) {
      const f = combatFixture();
      if (kind === 'cost') {
        const def = f.content.enemies.get('jelly');
        if (def) def.blockCost = 2;
      }
      f.state.enemies = [
        placeEnemy(
          f,
          kind === 'behind' ? 1.1 : 0.8,
          kind === 'air' ? { enemyId: 'crow', routeId: 'air' } : kind === 'dead' ? { hp: 0 } : {},
        ),
      ];
      blockEnemies(f.content, f.stage, f.state, []);
      expect(f.state.enemies[0]?.blockedBy).toBeNull();
    }
  });
  it('수용량이 줄면 마지막에 저지한 적부터 풀어준다', () => {
    const f = combatFixture();
    const unit = f.state.units[0];
    if (!unit) throw new Error('unit');
    unit.unitId = 'cat';
    const a = placeEnemy(f, 0.8);
    const b = placeEnemy(f, 0.7);
    f.state.enemies = [a, b];
    blockEnemies(f.content, f.stage, f.state, []);
    unit.unitId = 'squirrel';
    blockEnemies(f.content, f.stage, f.state, []);
    expect([a.blockedBy, b.blockedBy]).toEqual([unit.uid, null]);
  });
});
