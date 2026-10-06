import { assert } from '../../core/assert';
import type { ContentDb } from '../../data/types';
import { TICK_RATE } from '../constants';
import type { BattleState, SimEvent, StageRuntime } from '../types';

export function moveEnemies(
  content: ContentDb,
  stage: StageRuntime,
  state: BattleState,
  events: SimEvent[],
): void {
  for (const enemy of [...state.enemies]) {
    enemy.px = enemy.x;
    enemy.py = enemy.y;
    if (enemy.hp <= 0 || enemy.blockedBy !== null || state.tick < enemy.stunUntilTick) continue;
    const def = content.enemies.get(enemy.enemyId);
    const route = stage.routes.get(enemy.routeId);
    assert(def && route, `적 ${enemy.uid}의 정의 또는 경로가 없습니다`);
    enemy.dist += (def.speed * (1 - enemy.slowAmount)) / TICK_RATE;
    const position = route.positionAt(enemy.dist, enemy.segIndex);
    enemy.x = position.x;
    enemy.y = position.y;
    enemy.segIndex = position.segIndex;
    if (enemy.dist < route.totalLength) continue;
    state.life -= def.lifeDamage;
    state.leaked++;
    state.enemies.splice(state.enemies.indexOf(enemy), 1);
    events.push({ type: 'enemyLeak', uid: enemy.uid, lifeLeft: state.life });
    if (state.life <= 0) {
      state.phase = 'lost';
      events.push({ type: 'battleEnd', result: 'lost' });
      return;
    }
  }
}
