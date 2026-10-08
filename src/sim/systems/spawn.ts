import { assert } from '../../core/assert';
import type { BattleState, SimEvent, StageRuntime } from '../types';

export function spawnEnemies(stage: StageRuntime, state: BattleState, events: SimEvent[]): void {
  for (const [index, group] of stage.spawns.entries()) {
    if (state.tick >= group.atTick) state.currentWave = Math.max(state.currentWave, group.wave);
    const cursor = state.spawnCursor[index];
    assert(cursor !== undefined, 'battle.spawnCursor: missing group');
    if (cursor >= group.count || state.tick !== group.atTick + cursor * group.intervalTicks) continue;
    const { x, y, segIndex } = group.route.positionAt(0);
    const uid = state.nextUid++;
    state.enemies.push({
      uid,
      enemyId: group.enemy.id,
      routeId: group.routeId,
      dist: 0,
      segIndex,
      x,
      y,
      px: x,
      py: y,
      hp: group.enemy.hp,
      maxHp: group.enemy.hp,
      slowAmount: 0,
      slowUntilTick: 0,
      stunUntilTick: 0,
    });
    state.spawnCursor[index] = cursor + 1;
    events.push({ type: 'enemySpawn', uid, enemyId: group.enemy.id, x, y });
  }
}
