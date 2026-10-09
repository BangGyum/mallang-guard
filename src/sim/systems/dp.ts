import type { ContentDb } from '../../data/types';
import { DP_MAX } from '../constants';
import { rangeTilesFor } from '../queries';
import type { BattleState, EnemyEntity, SimEvent, StageRuntime } from '../types';

export function awardKillBounty(
  content: ContentDb,
  stage: StageRuntime,
  state: BattleState,
  enemy: Readonly<EnemyEntity>,
  events: SimEvent[],
): void {
  let bonus = 0;
  for (const unit of state.units) {
    const value = Math.max(
      0,
      ...unit.buffs.map((effect) => (effect.type === 'killBounty' ? effect.value : 0)),
    );
    if (
      value > bonus &&
      rangeTilesFor(content, stage, unit.unitId, unit.tile, unit.dir, unit.buffs).some(
        (tile) => tile.x === Math.floor(enemy.x) && tile.y === Math.floor(enemy.y),
      )
    )
      bonus = value;
  }
  const amount = Math.min(DP_MAX - state.dp, (content.enemies.get(enemy.enemyId)?.bounty ?? 0) + bonus);
  state.dp += amount;
  if (amount > 0) events.push({ type: 'dpGain', amount, source: 'kill', uid: enemy.uid });
}
