import { assert } from '../../core/assert';
import type { EnemyDef } from '../../data/types';
import { secToTicks } from '../constants';
import type { Polyline } from '../path';
import type { BattleState, SimEvent, StageRuntime } from '../types';

export function spawnEnemy(
  enemy: EnemyDef,
  routeId: string,
  route: Polyline,
  state: BattleState,
  events: SimEvent[],
  distance = 0,
  parentUid?: number,
) {
  const { x, y, segIndex } = route.positionAt(distance);
  const uid = state.nextUid++;
  state.enemies.push({
    uid,
    enemyId: enemy.id,
    routeId,
    dist: distance,
    segIndex,
    x,
    y,
    px: x,
    py: y,
    hp: enemy.hp,
    maxHp: enemy.hp,
    slowAmount: 0,
    slowUntilTick: 0,
    stunUntilTick: 0,
    abilityCooldown: enemy.disrupt ? secToTicks(enemy.disrupt.intervalSec) : 0,
    shield: enemy.shieldHp ?? 0,
    speedMul: 1,
    rushCooldown: enemy.rush ? secToTicks(enemy.rush.intervalSec) : 0,
    rushUntilTick: 0,
    regenCooldown: enemy.regenerate ? secToTicks(enemy.regenerate.intervalSec) : 0,
    healCooldown: enemy.heal ? secToTicks(enemy.heal.intervalSec) : 0,
    summonCooldown: enemy.summon ? secToTicks(enemy.summon.intervalSec) : 0,
    summonsRemaining: enemy.summon?.maxCasts ?? 0,
  });
  events.push({
    type: 'enemySpawn',
    uid,
    enemyId: enemy.id,
    x,
    y,
    ...(parentUid === undefined ? {} : { parentUid }),
  });
}

export function spawnEnemies(stage: StageRuntime, state: BattleState, events: SimEvent[]): void {
  for (const [index, group] of stage.spawns.entries()) {
    if (state.tick >= group.atTick) state.currentWave = Math.max(state.currentWave, group.wave);
    const cursor = state.spawnCursor[index];
    assert(cursor !== undefined, 'battle.spawnCursor: missing group');
    if (cursor >= group.count || state.tick !== group.atTick + cursor * group.intervalTicks) continue;
    spawnEnemy(group.enemy, group.routeId, group.route, state, events);
    state.spawnCursor[index] = cursor + 1;
  }
}
