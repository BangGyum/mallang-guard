import { assert } from '../../core/assert';
import type { ContentDb } from '../../data/types';
import { SPLIT_SPACING } from '../constants';
import type { BattleState, SimEvent, StageRuntime } from '../types';
import { awardKillBounty } from './dp';
import { spawnEnemy } from './spawn';

export function removeDead(
  content: ContentDb,
  stage: StageRuntime,
  state: BattleState,
  events: SimEvent[],
): void {
  const dead = state.enemies.filter((enemy) => enemy.hp <= 0);
  state.enemies = state.enemies.filter((enemy) => enemy.hp > 0);
  for (const enemy of dead) {
    state.killed += 1;
    events.push({ type: 'enemyDie', uid: enemy.uid });
    awardKillBounty(content, stage, state, enemy, events);
    const split = content.enemies.get(enemy.enemyId)?.split;
    if (!split) continue;
    const child = content.enemies.get(split.enemy);
    const route = stage.routes.get(enemy.routeId);
    assert(child && route, 'battle.split: missing child or route');
    for (let i = 0; i < split.count; i++)
      spawnEnemy(
        child,
        enemy.routeId,
        route,
        state,
        events,
        Math.max(0, enemy.dist - i * SPLIT_SPACING),
        enemy.uid,
      );
    state.totalEnemies += split.count;
  }
}
