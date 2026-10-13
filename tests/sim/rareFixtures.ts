import { assert } from '../../src/core/assert';
import type { Dir } from '../../src/core/grid';
import { createBattle } from '../../src/sim/battle';
import { secToTicks } from '../../src/sim/constants';
import type { BattleState } from '../../src/sim/types';
import { laneStage, makeContent, run } from '../helpers';
import { LINE_TILE } from './lineSniperFixtures';

export function rareFixture(unitId: string, active = false, dir: Dir = 'right') {
  const stage = laneStage(
    Array.from({ length: 13 }, (_, y) =>
      Array.from({ length: 13 }, (_, x) =>
        x === 6 && y === 6 ? 'H' : y === 12 && x === 0 ? 'S' : y === 12 && x === 12 ? 'G' : '.',
      ).join(''),
    ),
    [{ wave: 1, atSec: 999, enemy: 'jelly', count: 1, intervalSec: 0, route: 'ground' }],
    { startDp: 99 },
  );
  const ground = stage.routes.ground;
  assert(ground, '검사 경로 없음');
  stage.routes.air = { ...ground, flying: true };
  const content = makeContent({ stages: [stage] });
  const battle = createBattle(content, stage.id);
  battle.enqueue({ type: 'deploy', unitId, tile: LINE_TILE, dir });
  const deployment = battle.flush();
  const deployed = battle.state.units[0];
  const def = content.units.get(unitId);
  const skill = def && content.skills.get(def.skill);
  assert(deployed && def && skill, '희귀 캐릭터 배치 실패');
  if (active) {
    run(battle, secToTicks(skill.spCost - skill.spStart));
    battle.enqueue({ type: 'activateSkill', uid: deployed.uid });
    assert(
      battle.flush().some((event) => event.type === 'skillStart'),
      '스킬 발동 실패',
    );
  }
  const state: BattleState = structuredClone(battle.state);
  const unit = state.units[0];
  assert(unit, '희귀 캐릭터 없음');
  return { content, battle, state, unit, def, skill, stage: battle.stage, deployment };
}
