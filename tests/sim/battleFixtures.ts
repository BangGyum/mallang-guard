import type { EnemyDef, SpawnGroup, StageDef } from '../../src/data/types';
import { createBattle } from '../../src/sim/battle';
import type { BattleState, UnitEntity } from '../../src/sim/types';
import { makeRawContent } from '../dataFixtures';
import { laneStage, makeContent } from '../helpers';

export const SPAWN: SpawnGroup = {
  wave: 1,
  atSec: 0,
  enemy: 'jelly',
  count: 1,
  intervalSec: 0,
  route: 'ground',
};

export function makeFixture(
  stage: StageDef = laneStage(['S......G', 'HHHHHHHH'], [SPAWN]),
  patch: Partial<EnemyDef> = {},
) {
  const raw = makeRawContent();
  const enemies = raw.enemies.map((enemy) => (enemy.id === 'jelly' ? { ...enemy, ...patch } : enemy));
  const content = makeContent({ stages: [stage], enemies });
  const battle = createBattle(content, stage.id);
  const state: BattleState = structuredClone(battle.state);
  return { content, battle, state, stage: battle.stage };
}

export function unitFixture(patch: Partial<UnitEntity> = {}): UnitEntity {
  return {
    uid: 2,
    unitId: 'squirrel',
    tile: { x: 1, y: 1 },
    dir: 'right',
    atkCooldown: 0,
    disruptedUntilTick: 0,
    disruptionMul: 1,
    sp: 8,
    skillState: 'charging',
    skillEndTick: -1,
    skillHitCount: 0,
    pulsesLeft: 0,
    nextPulseTick: 0,
    buffs: [],
    ...patch,
  };
}
