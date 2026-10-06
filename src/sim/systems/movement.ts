import { assert } from '../../core/assert';
import type { ContentDb } from '../../data/types';
import { TICK_RATE } from '../constants';
import type { BattleState, SimEvent, StageRuntime } from '../types';
import { endBattle } from './outcome';

export function moveEnemies(
  content: ContentDb,
  stage: StageRuntime,
  state: BattleState,
  events: SimEvent[],
): void {
  for (let index = 0; index < state.enemies.length; ) {
    const enemy = state.enemies[index];
    assert(enemy, 'battle.enemies: missing entity');
    enemy.px = enemy.x;
    enemy.py = enemy.y;
    if (enemy.hp <= 0 || enemy.blockedBy !== null || state.tick < enemy.stunUntilTick) {
      index += 1;
      continue;
    }
    const definition = content.enemies.get(enemy.enemyId);
    const route = stage.routes.get(enemy.routeId);
    assert(definition && route, 'battle.enemies: missing definition or route');
    enemy.dist += (definition.speed * (1 - enemy.slowAmount)) / TICK_RATE;
    if (enemy.dist >= route.length) {
      state.life -= definition.lifeDamage;
      state.leaked += 1;
      state.enemies.splice(index, 1);
      events.push({ type: 'enemyLeak', uid: enemy.uid, lifeLeft: state.life });
      if (state.life <= 0) {
        endBattle(state, 'lost', events);
        return;
      }
      continue;
    }
    const position = route.positionAt(enemy.dist, enemy.segIndex);
    enemy.x = position.x;
    enemy.y = position.y;
    enemy.segIndex = position.segIndex;
    index += 1;
  }
}
