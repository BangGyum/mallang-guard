import { describe, expect, it } from 'vitest';
import { content } from '../../src/data';
import { createBattle } from '../../src/sim/battle';
import { moveEnemies } from '../../src/sim/systems/movement';
import { laneStage, makeContent, run } from '../helpers';
import { combatFixture } from './combatFixtures';

describe('고지대 디펜스', () => {
  it.each(content.unitOrder)('%s는 고지대에만 배치되고 체력·저지 상태가 없다', (unitId) => {
    const stage = laneStage(['S...G', 'HHHHH'], [], { startDp: 99 });
    const battle = createBattle(makeContent({ stages: [stage] }), stage.id);
    expect(battle.checkDeploy(unitId, { x: 2, y: 0 })).toEqual({ ok: false, reason: 'badTile' });
    battle.enqueue({ type: 'deploy', unitId, tile: { x: 2, y: 1 }, dir: 'up' });
    expect(battle.flush()[0]?.type).toBe('unitDeploy');
    for (const field of ['hp', 'maxHp', 'blocking']) expect(battle.state.units[0]).not.toHaveProperty(field);
    for (const field of ['hp', 'def', 'res', 'block'])
      expect(content.units.get(unitId)).not.toHaveProperty(field);
  });
  it('가까운 아군이 있어도 적이 길을 따라 계속 이동한다', () => {
    const f = combatFixture();
    for (let i = 0; i < 120; i++) moveEnemies(f.content, f.stage, f.state, []);
    expect(f.state.enemies[0]?.dist).toBeCloseTo(3.6);
    expect(f.state.units).toHaveLength(1);
  });
  it('공격 범위 밖 적은 아군을 해치지 않고 푸딩으로 향한다', () => {
    const stage = laneStage(
      ['S...G', 'HHHHH'],
      [{ wave: 1, atSec: 0, enemy: 'hardJelly', count: 1, intervalSec: 0, route: 'ground' }],
    );
    const battle = createBattle(makeContent({ stages: [stage] }), stage.id);
    battle.enqueue({ type: 'deploy', unitId: 'squirrel', tile: { x: 2, y: 1 }, dir: 'down' });
    const events = run(battle, 300);
    expect(battle.state).toMatchObject({ phase: 'won', leaked: 1, life: 2 });
    expect(battle.state.units).toHaveLength(1);
    expect(events.filter((event) => event.type === 'damage')).toEqual([]);
    expect(battle.state.roster[0]?.state).toBe('deployed');
  });
});
