import { assert } from '../../core/assert';
import { dist } from '../../core/math';
import type { ContentDb } from '../../data/types';
import { SPLIT_SPACING, secToTicks } from '../constants';
import type { BattleState, EnemyEntity, SimEvent, StageRuntime } from '../types';
import { spawnEnemy } from './spawn';

function healEnemy(source: EnemyEntity, target: EnemyEntity, amount: number, events: SimEvent[]) {
  const healed = Math.min(amount, target.maxHp - target.hp);
  if (healed <= 0 || target.hp <= 0) return false;
  target.hp += healed;
  events.push({ type: 'enemyHeal', src: source.uid, uid: target.uid, amount: healed });
  return true;
}

export function updateEnemySupport(
  content: ContentDb,
  stage: StageRuntime,
  state: BattleState,
  events: SimEvent[],
): void {
  for (const enemy of [...state.enemies]) {
    if (enemy.hp <= 0 || enemy.stunUntilTick > state.tick) continue;
    const def = content.enemies.get(enemy.enemyId);
    assert(def, 'battle.enemies: missing definition');
    if (def.regenerate) {
      enemy.regenCooldown = Math.max(0, enemy.regenCooldown - 1);
      if (enemy.regenCooldown === 0 && healEnemy(enemy, enemy, def.regenerate.amount, events))
        enemy.regenCooldown = secToTicks(def.regenerate.intervalSec);
    }
    if (def.heal) {
      enemy.healCooldown = Math.max(0, enemy.healCooldown - 1);
      if (enemy.healCooldown === 0) {
        const ability = def.heal;
        const target = state.enemies
          .filter(
            (target) =>
              target.uid !== enemy.uid &&
              target.hp > 0 &&
              target.hp < target.maxHp &&
              dist(enemy.x, enemy.y, target.x, target.y) <= ability.range,
          )
          .sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp || a.uid - b.uid)[0];
        if (target && healEnemy(enemy, target, ability.amount, events))
          enemy.healCooldown = secToTicks(ability.intervalSec);
      }
    }
    if (def.summon && enemy.summonsRemaining > 0) {
      enemy.summonCooldown = Math.max(0, enemy.summonCooldown - 1);
      if (enemy.summonCooldown === 0) {
        const child = content.enemies.get(def.summon.enemy);
        const route = stage.routes.get(enemy.routeId);
        assert(child && route, 'battle.summon: missing child or route');
        for (let i = 0; i < def.summon.count; i++)
          spawnEnemy(
            child,
            enemy.routeId,
            route,
            state,
            events,
            Math.max(0, enemy.dist - (i + 1) * SPLIT_SPACING),
            enemy.uid,
          );
        state.totalEnemies += def.summon.count;
        enemy.summonsRemaining -= 1;
        enemy.summonCooldown = secToTicks(def.summon.intervalSec);
      }
    }
  }
}
