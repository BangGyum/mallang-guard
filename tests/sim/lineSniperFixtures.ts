import { assert } from '../../src/core/assert';
import { type Dir, rotateOffset, type Tile } from '../../src/core/grid';
import { createBattle } from '../../src/sim/battle';
import { secToTicks } from '../../src/sim/constants';
import type { EnemyEntity } from '../../src/sim/types';
import { laneStage, makeContent, run } from '../helpers';

export const LINE_TILE = { x: 6, y: 6 };

export function lineBattle(dir: Dir = 'right', tile: Tile = LINE_TILE) {
  const stage = laneStage(
    Array.from({ length: 13 }, (_, y) =>
      Array.from({ length: 13 }, (_, x) =>
        x === tile.x && y === tile.y ? 'H' : y === 12 && x === 0 ? 'S' : y === 12 && x === 12 ? 'G' : '.',
      ).join(''),
    ),
    [{ wave: 1, atSec: 999, enemy: 'jelly', count: 1, intervalSec: 0, route: 'ground' }],
    { startDp: 99 },
  );
  const db = makeContent({ stages: [stage] });
  const battle = createBattle(db, stage.id);
  battle.enqueue({ type: 'deploy', unitId: 'wolf', tile, dir });
  const events = battle.flush();
  assert(
    events.some((event) => event.type === 'unitDeploy'),
    '랑랑 배치 실패',
  );
  const unit = battle.state.units[0];
  const def = db.units.get('wolf');
  const skill = def && db.skills.get(def.skill);
  assert(unit && def && skill, '랑랑의 실제 데이터 없음');
  return { db, battle, unit, def, skill };
}

export function activateLine(f: ReturnType<typeof lineBattle>) {
  run(f.battle, secToTicks(f.skill.spCost - f.skill.spStart));
  f.battle.enqueue({ type: 'activateSkill', uid: f.unit.uid });
  const events = f.battle.flush();
  assert(
    events.some((event) => event.type === 'skillStart'),
    '삼중 조준 발동 실패',
  );
}

export function lineEnemy(uid: number, dx: number, dy = 0, dir: Dir = 'right'): EnemyEntity {
  const [x, y] = rotateOffset([dx, dy], dir);
  return {
    uid,
    enemyId: 'jelly',
    routeId: 'ground',
    dist: dx,
    segIndex: 0,
    x: LINE_TILE.x + x + 0.5,
    y: LINE_TILE.y + y + 0.5,
    px: LINE_TILE.x + x + 0.5,
    py: LINE_TILE.y + y + 0.5,
    hp: 10000,
    maxHp: 10000,
    slowAmount: 0,
    slowUntilTick: 0,
    stunUntilTick: 0,
    abilityCooldown: 0,
  };
}
