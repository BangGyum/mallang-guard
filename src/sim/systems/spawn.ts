import { assert } from '../../core/assert';
import type { ContentDb } from '../../data/types';
import type { BattleState, SimEvent, StageRuntime } from '../types';

export function spawnEnemies(
  content: ContentDb,
  stage: StageRuntime,
  state: BattleState,
  events: SimEvent[],
): void {
  stage.spawns.forEach((group, groupIndex) => {
    if (state.tick >= group.atTick) state.wave = Math.max(state.wave, group.wave);
    let cursor = state.spawnCursor[groupIndex] ?? 0;
    while (cursor < group.count && state.tick >= group.atTick + cursor * group.intervalTicks) {
      const def = content.enemies.get(group.enemy);
      const route = stage.routes.get(group.route);
      assert(def && route, `스폰 ${groupIndex}의 적 또는 경로가 없습니다`);
      const position = route.positionAt(0);
      const uid = state.nextUid++;
      state.enemies.push({
        uid,
        enemyId: def.id,
        routeId: group.route,
        dist: 0,
        segIndex: position.segIndex,
        x: position.x,
        y: position.y,
        px: position.x,
        py: position.y,
        hp: def.hp,
        maxHp: def.hp,
        atkCooldown: 0,
        blockedBy: null,
        slowAmount: 0,
        slowUntilTick: 0,
        stunUntilTick: 0,
      });
      events.push({ type: 'enemySpawn', uid, enemyId: def.id });
      cursor++;
    }
    state.spawnCursor[groupIndex] = cursor;
  });
}
