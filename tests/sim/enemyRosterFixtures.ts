import { assert } from '../../src/core/assert';
import { createBattle } from '../../src/sim/battle';
import { spawnEnemy } from '../../src/sim/systems/spawn';
import type { BattleState } from '../../src/sim/types';
import { laneStage, makeContent } from '../helpers';

export function enemyRosterFixture(ids: readonly string[]) {
  const raw = laneStage(
    [`S${'.'.repeat(38)}G`, 'H'.repeat(40)],
    [{ wave: 1, atSec: 999, enemy: 'jelly', count: 1, intervalSec: 0, route: 'ground' }],
    { startDp: 99, life: 99 },
  );
  const content = makeContent({ stages: [raw] });
  const battle = createBattle(content, raw.id);
  battle.enqueue({ type: 'deploy', unitId: 'squirrel', tile: { x: 0, y: 1 }, dir: 'up' });
  battle.flush();
  const state: BattleState = structuredClone(battle.state);
  const unit = state.units[0];
  assert(unit, '검사용 유닛 없음');
  for (const [i, id] of ids.entries()) {
    const def = content.enemies.get(id);
    const route = battle.stage.routes.get(def?.flying ? 'air' : 'ground');
    assert(def && route, '검사용 적 또는 경로 없음');
    spawnEnemy(def, def.flying ? 'air' : 'ground', route, state, [], i * 0.4);
  }
  return { content, battle, stage: battle.stage, state, unit };
}
