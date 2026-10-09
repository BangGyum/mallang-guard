import { dist } from '../../core/math';
import type { ContentDb } from '../../data/types';
import { secToTicks } from '../constants';
import type { BattleState } from '../types';

export function updateEnemyMotion(content: ContentDb, state: BattleState): void {
  const auras = state.enemies.flatMap((enemy) => {
    const haste = content.enemies.get(enemy.enemyId)?.haste;
    return haste && enemy.hp > 0 && enemy.stunUntilTick <= state.tick ? [{ enemy, haste }] : [];
  });
  for (const enemy of state.enemies) {
    enemy.speedMul = 1;
    if (enemy.hp <= 0 || enemy.stunUntilTick > state.tick) continue;
    const rush = content.enemies.get(enemy.enemyId)?.rush;
    if (rush) {
      enemy.rushCooldown = Math.max(0, enemy.rushCooldown - 1);
      if (enemy.rushCooldown === 0) {
        enemy.rushUntilTick = state.tick + secToTicks(rush.durationSec);
        enemy.rushCooldown = secToTicks(rush.intervalSec);
      }
      if (enemy.rushUntilTick > state.tick) enemy.speedMul = rush.speedMul;
    }
    let boost = 1;
    for (const { enemy: source, haste } of auras)
      if (source.uid !== enemy.uid && dist(source.x, source.y, enemy.x, enemy.y) <= haste.range)
        boost = Math.max(boost, haste.speedMul);
    enemy.speedMul *= boost;
  }
}
